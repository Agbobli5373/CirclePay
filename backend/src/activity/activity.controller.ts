import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiCookieAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import type { AuthUser } from '../common/auth/auth-user'
import { ActivityService } from './activity.service'
import { ActivityItemDto } from './dto/activity-responses.dto'

@ApiTags('activity')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @ApiOperation({ summary: "The current user's activity feed (most recent first)" })
  @ApiOkResponse({ type: [ActivityItemDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.activity.list(user.id)
  }
}
