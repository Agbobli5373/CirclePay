import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, type JwtSignOptions } from '@nestjs/jwt'
import { randomUUID, createHash } from 'crypto'
import type { Response } from 'express'
import { RedisService } from '../redis/redis.service'

export interface AccessClaims {
  sub: string // userId
  isOpsAdmin: boolean
  typ: 'access'
}
export interface RefreshClaims {
  sub: string
  jti: string
  typ: 'refresh'
}
export interface RegClaims {
  phone: string
  phase: 'set-pin'
  typ: 'reg'
}

const ACCESS_COOKIE = 'access_token'
const REFRESH_COOKIE = 'refresh_token'
const REG_COOKIE = 'reg_token'

/**
 * Issues/verifies JWTs and manages refresh-sessions in Redis.
 *   sess:{userId}:{jti} → sha256(refreshToken)   (EXPIRE = refresh TTL)
 * Rotation deletes the old jti and creates a new one. Reuse of a rotated token
 * (valid JWT, jti absent) triggers logout-all for that user.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private get accessSecret() {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
  }
  private get refreshSecret() {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET')
  }
  private get isProd() {
    return this.config.get<string>('NODE_ENV') === 'production'
  }
  private sessKey(userId: string, jti: string) {
    return `sess:${userId}:${jti}`
  }
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
  /** env durations like "15m"/"30d" are valid for jsonwebtoken at runtime; cast the type. */
  private ttl(envKey: string, fallback: string): JwtSignOptions['expiresIn'] {
    return (this.config.get<string>(envKey) ?? fallback) as JwtSignOptions['expiresIn']
  }

  private refreshTtlSeconds(): number {
    // store sessions slightly longer than the JWT to be safe; parse "30d"/"15m"/seconds
    return parseDuration(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d')
  }

  // ---- Registration token (between verify-otp and set-pin) ----

  signRegToken(phone: string): string {
    const claims: RegClaims = { phone, phase: 'set-pin', typ: 'reg' }
    return this.jwt.sign(claims, {
      secret: this.accessSecret,
      expiresIn: this.ttl('REG_TOKEN_TTL', '10m'),
    })
  }

  verifyRegToken(token: string): RegClaims {
    try {
      const claims = this.jwt.verify<RegClaims>(token, { secret: this.accessSecret })
      if (claims.typ !== 'reg' || claims.phase !== 'set-pin') throw new Error('bad reg token')
      return claims
    } catch {
      throw new UnauthorizedException({ code: 'REG_TOKEN_INVALID', message: 'Restart onboarding' })
    }
  }

  // ---- Session (access + rotating refresh) ----

  /** Issue a fresh access+refresh pair, persist the refresh session, and set cookies. */
  async issueSession(
    res: Response,
    user: { id: string; isOpsAdmin: boolean },
  ): Promise<void> {
    const access = this.jwt.sign(
      { sub: user.id, isOpsAdmin: user.isOpsAdmin, typ: 'access' } as AccessClaims,
      { secret: this.accessSecret, expiresIn: this.ttl('JWT_ACCESS_TTL', '15m') },
    )
    const jti = randomUUID()
    const refresh = this.jwt.sign({ sub: user.id, jti, typ: 'refresh' } as RefreshClaims, {
      secret: this.refreshSecret,
      expiresIn: this.ttl('JWT_REFRESH_TTL', '30d'),
    })
    await this.redis.setEx(this.sessKey(user.id, jti), this.hash(refresh), this.refreshTtlSeconds())
    this.setCookie(res, ACCESS_COOKIE, access)
    this.setCookie(res, REFRESH_COOKIE, refresh)
  }

  /** Rotate using the presented refresh token; detects reuse. */
  async rotate(
    res: Response,
    refreshToken: string | undefined,
    loadUser: (id: string) => Promise<{ id: string; isOpsAdmin: boolean } | null>,
  ): Promise<void> {
    if (!refreshToken) throw this.unauth()
    let claims: RefreshClaims
    try {
      claims = this.jwt.verify<RefreshClaims>(refreshToken, { secret: this.refreshSecret })
    } catch {
      throw this.unauth()
    }
    if (claims.typ !== 'refresh') throw this.unauth()

    const key = this.sessKey(claims.sub, claims.jti)
    const stored = await this.redis.get(key)

    // Reuse detection: a structurally-valid refresh whose jti is gone means it was
    // already rotated (or revoked) → treat as compromise, revoke ALL sessions.
    if (!stored || stored !== this.hash(refreshToken)) {
      await this.redis.delByPattern(`sess:${claims.sub}:*`)
      throw this.unauth()
    }

    const user = await loadUser(claims.sub)
    if (!user) throw this.unauth()

    await this.redis.del(key) // consume old session
    await this.issueSession(res, user)
  }

  async revokeAll(userId: string): Promise<void> {
    await this.redis.delByPattern(`sess:${userId}:*`)
  }

  /** Clear the session: drop this jti from Redis and clear cookies. */
  async clearSession(res: Response, refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      try {
        const claims = this.jwt.verify<RefreshClaims>(refreshToken, { secret: this.refreshSecret })
        await this.redis.del(this.sessKey(claims.sub, claims.jti))
      } catch {
        /* ignore — clearing anyway */
      }
    }
    this.clearCookie(res, ACCESS_COOKIE)
    this.clearCookie(res, REFRESH_COOKIE)
    this.clearCookie(res, REG_COOKIE)
  }

  // ---- Cookie helpers ----

  setRegCookie(res: Response, token: string): void {
    this.setCookie(res, REG_COOKIE, token, 10 * 60 * 1000)
  }

  private setCookie(res: Response, name: string, value: string, maxAgeMs?: number): void {
    res.cookie(name, value, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
    })
  }

  private clearCookie(res: Response, name: string): void {
    res.clearCookie(name, { httpOnly: true, secure: this.isProd, sameSite: 'lax', path: '/' })
  }

  private unauth(): UnauthorizedException {
    return new UnauthorizedException({ code: 'AUTH_INVALID', message: 'Session invalid' })
  }
}

/** Parse "30d" / "15m" / "300s" / plain seconds → seconds. */
function parseDuration(input: string): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(input.trim())
  if (!m) return 2592000
  const n = Number(m[1])
  switch (m[2]) {
    case 's':
      return n
    case 'm':
      return n * 60
    case 'h':
      return n * 3600
    case 'd':
      return n * 86400
    default:
      return n
  }
}
