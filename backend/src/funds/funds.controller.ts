import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
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
  ApiQuery,
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

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a Susu (active immediately, or pending a required deposit)' })
  @ApiOkResponse({ type: JoinResultDto })
  @ApiForbiddenResponse({ description: 'TRUST_LOCKED / FORBIDDEN' })
  @ApiConflictResponse({ description: 'FUND_FULL / ALREADY_MEMBER / FUND_INACTIVE' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — fund does not exist' })
  join(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.funds.join(user.id, id)
  }

  @Get()
  @ApiOperation({ summary: 'List Susu funds — mine (default) or all active' })
  @ApiQuery({ name: 'mine', required: false, example: 'true' })
  @ApiOkResponse({ type: [FundSummaryDto] })
  list(@CurrentUser() user: AuthUser, @Query('mine') mine?: string) {
    const scope = mine === 'false' || mine === 'all' ? 'all' : 'mine'
    return this.funds.list(user.id, scope)
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
