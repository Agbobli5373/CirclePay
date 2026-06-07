import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import type { Response } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OtpService } from './otp.service'
import { TokenService } from './token.service'
import type { RequestOtpDto, VerifyOtpDto, SetPinDto, LoginDto, ChangePinDto, ResetPinDto } from './dto/auth.dto'
import type { AuthUser } from '../common/auth/auth-user'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get isProd() {
    return this.config.get<string>('NODE_ENV') === 'production'
  }

  /** Always returns { ok: true } (no number enumeration). In dev, includes devCode. */
  async requestOtp(dto: RequestOtpDto): Promise<{ ok: true; devCode?: string }> {
    const purpose = dto.purpose ?? 'auth'
    const within = await this.otp.withinRateLimit(dto.phone)
    if (!within) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many requests, try again later' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    // Always generate/send (no account-existence check here) so requesting a code
    // never reveals whether a number is registered. Reset is gated at verify time.
    const code = await this.otp.generate(dto.phone, purpose)
    await this.notifications.sendOtp(dto.phone, code)
    if (!this.isProd) {
      this.logger.debug(`DEV OTP for ${dto.phone} (${purpose}): ${code}`)
      return { ok: true, devCode: code }
    }
    return { ok: true }
  }

  /**
   * Verify the code.
   *   purpose 'auth'  → existing user gets a session; new user gets a reg-token.
   *   purpose 'reset' → existing user gets a short-lived reset-token (no session yet).
   * Reaching the reset branch requires the real OTP (phone control), so signalling
   * NO_ACCOUNT there is not an enumeration leak — and it's clearer for the user.
   */
  async verifyOtp(dto: VerifyOtpDto, res: Response): Promise<{ registered: boolean; reset?: boolean }> {
    const purpose = dto.purpose ?? 'auth'
    const result = await this.otp.verify(dto.phone, dto.code, purpose)
    if (!result.ok) {
      const code =
        result.reason === 'EXPIRED'
          ? 'OTP_EXPIRED'
          : result.reason === 'TOO_MANY_ATTEMPTS'
            ? 'OTP_TOO_MANY_ATTEMPTS'
            : 'OTP_INVALID'
      throw new BadRequestException({ code, message: 'Invalid or expired code' })
    }

    const user = await this.db.user.findUnique({ where: { phone: dto.phone } })

    if (purpose === 'reset') {
      if (!user) {
        throw new BadRequestException({ code: 'NO_ACCOUNT', message: 'No CirclePay account uses this number' })
      }
      const resetToken = this.tokens.signResetToken(dto.phone)
      this.tokens.setResetCookie(res, resetToken)
      return { registered: true, reset: true }
    }

    if (user) {
      await this.tokens.issueSession(res, { id: user.id, isOpsAdmin: user.isOpsAdmin })
      return { registered: true }
    }

    const regToken = this.tokens.signRegToken(dto.phone)
    this.tokens.setRegCookie(res, regToken)
    return { registered: false }
  }

  /** Create the user + PIN from a valid registration token, then issue a session. */
  async setPin(regToken: string | undefined, dto: SetPinDto, res: Response): Promise<{ ok: true }> {
    if (!regToken) {
      throw new UnauthorizedException({ code: 'REG_TOKEN_INVALID', message: 'Restart onboarding' })
    }
    const { phone } = this.tokens.verifyRegToken(regToken)

    // Guard against a race where the user was created between verify-otp and set-pin.
    const existing = await this.db.user.findUnique({ where: { phone } })
    if (existing) {
      throw new BadRequestException({ code: 'ALREADY_REGISTERED', message: 'Account already exists' })
    }

    const pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id })
    const user = await this.db.user.create({
      data: {
        phone,
        network: dto.network,
        language: dto.language ?? 'en',
        name: dto.name ?? null,
        pinHash,
        trustScore: { create: {} }, // defaults: standing new_, onTimeRate 100
      },
    })
    await this.tokens.issueSession(res, { id: user.id, isOpsAdmin: user.isOpsAdmin })
    return { ok: true }
  }

  /** Login with phone + PIN, with failed-attempt lockout. */
  async login(dto: LoginDto, res: Response): Promise<{ ok: true }> {
    const user = await this.db.user.findUnique({ where: { phone: dto.phone } })
    // Constant-ish behaviour whether or not the user exists.
    if (!user || !user.pinHash) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: 'Invalid phone or PIN' })
    }

    const lockKey = `pin:lock:${user.id}`
    if (await this.redis.exists(lockKey)) {
      throw new HttpException({ code: 'LOCKED', message: 'Too many attempts, try later' }, HttpStatus.LOCKED)
    }

    const valid = await argon2.verify(user.pinHash, dto.pin)
    if (!valid) {
      const max = Number(this.config.get<string>('PIN_MAX_ATTEMPTS') ?? 5)
      const lockSecs = Number(this.config.get<string>('PIN_LOCK_SECONDS') ?? 900)
      const fails = await this.redis.incrWithTtl(`pin:fail:${user.id}`, lockSecs)
      if (fails >= max) {
        await this.redis.setEx(lockKey, '1', lockSecs)
        await this.redis.del(`pin:fail:${user.id}`)
        throw new HttpException({ code: 'LOCKED', message: 'Too many attempts, try later' }, HttpStatus.LOCKED)
      }
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: 'Invalid phone or PIN' })
    }

    await this.redis.del(`pin:fail:${user.id}`)
    await this.tokens.issueSession(res, { id: user.id, isOpsAdmin: user.isOpsAdmin })
    return { ok: true }
  }

  async refresh(refreshToken: string | undefined, res: Response): Promise<{ ok: true }> {
    await this.tokens.rotate(res, refreshToken, async (id) => {
      const u = await this.db.user.findUnique({ where: { id } })
      return u ? { id: u.id, isOpsAdmin: u.isOpsAdmin } : null
    })
    return { ok: true }
  }

  async logout(refreshToken: string | undefined, res: Response): Promise<{ ok: true }> {
    await this.tokens.clearSession(res, refreshToken)
    return { ok: true }
  }

  /**
   * Change PIN while signed in: verify the current PIN, then set a new one.
   * Reuses the login lockout (`pin:fail` / `pin:lock`) so the current-PIN check
   * can't be brute-forced from an authenticated session.
   */
  async changePin(authUser: AuthUser, dto: ChangePinDto): Promise<{ ok: true }> {
    const user = await this.db.user.findUnique({ where: { id: authUser.id } })
    if (!user || !user.pinHash) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: 'Session invalid' })
    }

    const lockKey = `pin:lock:${user.id}`
    if (await this.redis.exists(lockKey)) {
      throw new HttpException({ code: 'LOCKED', message: 'Too many attempts, try later' }, HttpStatus.LOCKED)
    }

    const valid = await argon2.verify(user.pinHash, dto.currentPin)
    if (!valid) {
      const max = Number(this.config.get<string>('PIN_MAX_ATTEMPTS') ?? 5)
      const lockSecs = Number(this.config.get<string>('PIN_LOCK_SECONDS') ?? 900)
      const fails = await this.redis.incrWithTtl(`pin:fail:${user.id}`, lockSecs)
      if (fails >= max) {
        await this.redis.setEx(lockKey, '1', lockSecs)
        await this.redis.del(`pin:fail:${user.id}`)
        throw new HttpException({ code: 'LOCKED', message: 'Too many attempts, try later' }, HttpStatus.LOCKED)
      }
      throw new UnauthorizedException({ code: 'PIN_INVALID', message: 'Current PIN is incorrect' })
    }

    const pinHash = await argon2.hash(dto.newPin, { type: argon2.argon2id })
    await this.db.user.update({ where: { id: user.id }, data: { pinHash } })
    await this.redis.del(`pin:fail:${user.id}`)
    return { ok: true }
  }

  /**
   * Reset the PIN after a verified `purpose:'reset'` OTP — no current PIN required.
   * Gated by the short-lived reset token (not a session), so an ordinary live
   * session can't silently replace the PIN and lock out the owner. Clears the
   * login lockout (the point of recovery) and signs the user in.
   */
  async resetPin(resetToken: string | undefined, dto: ResetPinDto, res: Response): Promise<{ ok: true }> {
    if (!resetToken) {
      throw new UnauthorizedException({ code: 'RESET_TOKEN_INVALID', message: 'Restart the PIN reset' })
    }
    const { phone } = this.tokens.verifyResetToken(resetToken)
    const user = await this.db.user.findUnique({ where: { phone } })
    if (!user) {
      throw new UnauthorizedException({ code: 'RESET_TOKEN_INVALID', message: 'Restart the PIN reset' })
    }

    const pinHash = await argon2.hash(dto.newPin, { type: argon2.argon2id })
    await this.db.user.update({ where: { id: user.id }, data: { pinHash } })
    // Clear any failed-attempt lockout — recovery is the whole point.
    await this.redis.del(`pin:fail:${user.id}`, `pin:lock:${user.id}`)
    // Consume the reset token and sign them in.
    this.tokens.clearResetCookie(res)
    await this.tokens.issueSession(res, { id: user.id, isOpsAdmin: user.isOpsAdmin })
    return { ok: true }
  }

  /** Update editable profile fields (name) and return the refreshed profile. */
  async updateProfile(authUser: AuthUser, dto: { name: string }) {
    await this.db.user.update({ where: { id: authUser.id }, data: { name: dto.name } })
    return this.me(authUser)
  }

  async me(authUser: AuthUser) {
    const user = await this.db.user.findUnique({
      where: { id: authUser.id },
      include: { trustScore: true },
    })
    if (!user) throw new UnauthorizedException({ code: 'AUTH_INVALID', message: 'Session invalid' })
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      network: user.network,
      language: user.language,
      isOpsAdmin: user.isOpsAdmin,
      trust: user.trustScore
        ? {
            standing: user.trustScore.standing,
            onTimeRate: user.trustScore.onTimeRate,
            fundsCompleted: user.trustScore.fundsCompleted,
          }
        : null,
    }
  }
}
