import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/** Protects routes — requires a valid `access_token` cookie. Returns 401 otherwise. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
