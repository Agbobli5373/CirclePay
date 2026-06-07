import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import type { OtpPurpose } from '@circlepay/shared'
import { RedisService } from '../redis/redis.service'

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'EXPIRED' | 'INVALID' | 'TOO_MANY_ATTEMPTS' }

/**
 * OTP lifecycle in Redis (TTL-based):
 *   otp:{phone}:{purpose} → JSON { codeHash, attempts }  (EXPIRE = OTP_TTL_SECONDS)
 *   otp:rl:{phone}        → request counter              (EXPIRE = OTP_RATE_WINDOW_SECONDS)
 *
 * The code is keyed by `purpose` ('auth' | 'reset') so a login OTP can never be
 * replayed to drive a PIN reset, and vice-versa. Rate limiting stays per-phone.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name)

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private key(phone: string, purpose: OtpPurpose = 'auth'): string {
    return `otp:${phone}:${purpose}`
  }
  private rlKey(phone: string): string {
    return `otp:rl:${phone}`
  }

  private num(name: string, fallback: number): number {
    return Number(this.config.get<string>(name) ?? fallback)
  }

  /** Returns true if under the rate limit (and records the attempt), false if exceeded. */
  async withinRateLimit(phone: string): Promise<boolean> {
    const max = this.num('OTP_RATE_MAX', 3)
    const window = this.num('OTP_RATE_WINDOW_SECONDS', 600)
    const count = await this.redis.incrWithTtl(this.rlKey(phone), window)
    return count <= max
  }

  /**
   * Generate + store a 6-digit code. Returns the plain code so the caller can SMS it.
   * In non-production the caller may surface it for testing.
   */
  async generate(phone: string, purpose: OtpPurpose = 'auth'): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = await argon2.hash(code, { type: argon2.argon2id })
    const ttl = this.num('OTP_TTL_SECONDS', 300)
    await this.redis.setEx(this.key(phone, purpose), JSON.stringify({ codeHash, attempts: 0 }), ttl)
    return code
  }

  async verify(phone: string, code: string, purpose: OtpPurpose = 'auth'): Promise<OtpVerifyResult> {
    const raw = await this.redis.get(this.key(phone, purpose))
    if (!raw) return { ok: false, reason: 'EXPIRED' }

    const { codeHash, attempts } = JSON.parse(raw) as { codeHash: string; attempts: number }
    const max = this.num('OTP_MAX_ATTEMPTS', 5)
    if (attempts >= max) {
      await this.redis.del(this.key(phone, purpose))
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
    }

    const valid = await argon2.verify(codeHash, code)
    if (!valid) {
      // increment attempts, keeping the remaining TTL
      const ttl = this.num('OTP_TTL_SECONDS', 300)
      await this.redis.setEx(
        this.key(phone, purpose),
        JSON.stringify({ codeHash, attempts: attempts + 1 }),
        ttl,
      )
      return { ok: false, reason: 'INVALID' }
    }

    await this.redis.del(this.key(phone, purpose))
    return { ok: true }
  }
}
