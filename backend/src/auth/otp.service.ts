import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { RedisService } from '../redis/redis.service'

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'EXPIRED' | 'INVALID' | 'TOO_MANY_ATTEMPTS' }

/**
 * OTP lifecycle in Redis (TTL-based):
 *   otp:{phone}    → JSON { codeHash, attempts }   (EXPIRE = OTP_TTL_SECONDS)
 *   otp:rl:{phone} → request counter               (EXPIRE = OTP_RATE_WINDOW_SECONDS)
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name)

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private key(phone: string): string {
    return `otp:${phone}`
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
  async generate(phone: string): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = await argon2.hash(code, { type: argon2.argon2id })
    const ttl = this.num('OTP_TTL_SECONDS', 300)
    await this.redis.setEx(this.key(phone), JSON.stringify({ codeHash, attempts: 0 }), ttl)
    return code
  }

  async verify(phone: string, code: string): Promise<OtpVerifyResult> {
    const raw = await this.redis.get(this.key(phone))
    if (!raw) return { ok: false, reason: 'EXPIRED' }

    const { codeHash, attempts } = JSON.parse(raw) as { codeHash: string; attempts: number }
    const max = this.num('OTP_MAX_ATTEMPTS', 5)
    if (attempts >= max) {
      await this.redis.del(this.key(phone))
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
    }

    const valid = await argon2.verify(codeHash, code)
    if (!valid) {
      // increment attempts, keeping the remaining TTL
      const ttl = this.num('OTP_TTL_SECONDS', 300)
      await this.redis.setEx(
        this.key(phone),
        JSON.stringify({ codeHash, attempts: attempts + 1 }),
        ttl,
      )
      return { ok: false, reason: 'INVALID' }
    }

    await this.redis.del(this.key(phone))
    return { ok: true }
  }
}
