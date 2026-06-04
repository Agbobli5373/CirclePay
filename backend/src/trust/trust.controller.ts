import { Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common'
import { ApiTags, ApiCookieAuth, ApiOperation, ApiOkResponse, ApiForbiddenResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import type { AuthUser } from '../common/auth/auth-user'
import { TrustService } from './trust.service'

@ApiTags('trust')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('trust')
export class TrustController {
  constructor(private readonly trust: TrustService) {}

  @Post(':userId/unlock')
  @ApiOperation({ summary: 'Appeal upheld: unlock a defaulted user platform-wide (ops only)' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — ops only' })
  unlock(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    if (!user.isOpsAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Ops only' })
    }
    return this.trust.unlock(userId)
  }
}
