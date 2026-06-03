import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Request } from 'express'
import type { AccessClaims } from './token.service'

export interface AuthUser {
  id: string
  isOpsAdmin: boolean
}

/** Reads the access token from the httpOnly `access_token` cookie. */
function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies
  return cookies?.access_token ?? null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    })
  }

  validate(payload: AccessClaims): AuthUser {
    return { id: payload.sub, isOpsAdmin: payload.isOpsAdmin }
  }
}
