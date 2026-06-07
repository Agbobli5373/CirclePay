import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common'
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
import { CreateFundDto, InviteMembersDto, SetMemberCountDto, ReorderPayoutDto } from './dto/funds.dto'
import {
  FundSummaryDto,
  FundDetailDto,
  InviteResultDto,
  InviteDto,
  MyInviteDto,
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

  @Get(':id/invites')
  @ApiOperation({ summary: "List a fund's invites with status + shareable join links (admin only)" })
  @ApiOkResponse({ type: [InviteDto] })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only' })
  listInvites(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.funds.listInvites(user.id, id)
  }

  @Post(':id/invites/:inviteId/resend')
  @ApiOperation({ summary: 'Resend a pending invite SMS (admin only)' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only / Susu started' })
  @ApiNotFoundResponse({ description: 'INVITE_NOT_FOUND' })
  resendInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.funds.resendInvite(user.id, id, inviteId)
  }

  @Delete(':id/invites/:inviteId')
  @ApiOperation({ summary: 'Revoke an invite, freeing the seat (admin only)' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only' })
  @ApiNotFoundResponse({ description: 'INVITE_NOT_FOUND' })
  revokeInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.funds.revokeInvite(user.id, id, inviteId)
  }

  @Get('invites/mine')
  @ApiOperation({ summary: 'Pending invites addressed to me (in-app invitation inbox)' })
  @ApiOkResponse({ type: [MyInviteDto] })
  myInvites(@CurrentUser() user: AuthUser) {
    return this.funds.myInvites(user.id)
  }

  @Post('invites/:inviteId/decline')
  @ApiOperation({ summary: 'Decline an invite addressed to me (frees the seat)' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiForbiddenResponse({ description: 'INVITE_PHONE_MISMATCH — invite was sent to a different number' })
  @ApiNotFoundResponse({ description: 'INVITE_NOT_FOUND' })
  declineInvite(@CurrentUser() user: AuthUser, @Param('inviteId') inviteId: string) {
    return this.funds.declineInvite(user.id, inviteId)
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

  @Post(':id/start')
  @ApiOperation({ summary: 'Start the Susu now with whoever has joined (organizer only)' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiForbiddenResponse({ description: 'NOT_ORGANIZER' })
  @ApiConflictResponse({ description: 'ALREADY_STARTED / FUND_INACTIVE' })
  @ApiBadRequestResponse({ description: 'TOO_FEW_MEMBERS — need at least 2 members' })
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.funds.startNow(user.id, id)
  }

  @Patch(':id/member-count')
  @ApiOperation({ summary: 'Resize the circle before it starts (organizer only)' })
  @ApiOkResponse({ description: '{ ok: true, memberCount }' })
  @ApiForbiddenResponse({ description: 'NOT_ORGANIZER' })
  @ApiConflictResponse({ description: 'ALREADY_STARTED — can only resize before start' })
  @ApiBadRequestResponse({ description: "TOO_SMALL — below the members already in" })
  setMemberCount(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetMemberCountDto) {
    return this.funds.setMemberCount(user.id, id, dto.memberCount)
  }

  @Patch(':id/payout-order')
  @ApiOperation({ summary: 'Arrange / reorder the payout order — strictly-future cycles during a run (organizer only)' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiForbiddenResponse({ description: 'NOT_ORGANIZER' })
  @ApiConflictResponse({ description: 'LOCKED_POSITION — already-paid/current cycle frozen / FUND_INACTIVE' })
  @ApiBadRequestResponse({ description: 'INVALID_ORDER — must list each current member once' })
  arrangePayoutOrder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReorderPayoutDto) {
    return this.funds.arrangePayoutOrder(user.id, id, dto.order)
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
