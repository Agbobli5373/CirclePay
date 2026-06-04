import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Protects routes — requires a valid `access_token` cookie. Returns 401 otherwise.
 * References the `'jwt'` passport strategy by name; the strategy itself is registered
 * by AuthModule. Lives in `common` (infra) so any feature can guard its routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
