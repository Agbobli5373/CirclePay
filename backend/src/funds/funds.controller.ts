import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common'
import {
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import type { AuthUser } from '../common/auth/auth-user'
import { FundsService } from './funds.service'
import { CreateFundDto, InviteMembersDto } from './dto/funds.dto'
import {
  FundSummaryDto,
  FundDetailDto,
  InviteResultDto,
  JoinResultDto,
} from './dto/funds-responses.dto'

@ApiTags('funds')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('funds')
export class FundsController {
  constructor(private readonly funds: FundsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Susu fund (creator becomes the first admin member)' })
  @ApiCreatedResponse({ type: FundSummaryDto })
  @ApiForbiddenResponse({ description: 'TRUST_LOCKED — a locked account cannot create funds' })
  @ApiBadRequestResponse({ description: 'VALIDATION — invalid fields' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFundDto) {
    return this.funds.createSusu(user.id, dto)
  }

  @Post(':id/invites')
  @ApiOperation({ summary: 'Invite members by MoMo number (admin only, before the Susu starts)' })
  @ApiOkResponse({ type: InviteResultDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — not admin or Susu already started' })
  @ApiBadRequestResponse({ description: 'SEATS_EXCEEDED — more invites than remaining seats' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — fund does not exist' })
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: InviteMembersDto) {
    return this.funds.invite(user.id, id, dto)
  }

  @Post('join/:token')
  @ApiOperation({ summary: 'Accept a Susu invite by token (invite-only join)' })
  @ApiOkResponse({ type: JoinResultDto })
  @ApiForbiddenResponse({ description: 'TRUST_LOCKED / INVITE_PHONE_MISMATCH' })
  @ApiConflictResponse({ description: 'FUND_FULL / FUND_INACTIVE' })
  @ApiNotFoundResponse({ description: 'INVITE_INVALID — bad or expired invite link' })
  acceptInvite(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.funds.acceptInvite(user.id, token)
  }

  @Post(':id/dev/expire')
  @ApiExcludeEndpoint() // dev-only demo affordance
  devExpire(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { mode?: 'overdue' | 'default' }) {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException()
    return this.funds.devExpire(user.id, id, body?.mode === 'default' ? 'default' : 'overdue')
  }

  @Get()
  @ApiOperation({ summary: 'List the Susu funds the current user belongs to' })
  @ApiOkResponse({ type: [FundSummaryDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.funds.list(user.id, 'mine')
  }

  @Get(':id')
  @ApiOperation({ summary: 'Susu detail — members, payout order, cycle progress (members only)' })
  @ApiOkResponse({ type: FundDetailDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — non-members cannot view a private Susu' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — fund does not exist' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.funds.detail(user.id, id)
  }
}
