import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import {
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import type { AuthUser } from '../common/auth/auth-user'
import { FundraisersService } from './fundraisers.service'
import { CreateMedicalFundDto, VerifyPayeeDto, InviteContributorsDto, ThankContributorsDto } from './dto/fundraisers.dto'
import { FundraiserDto, MyFundraiserDto } from './dto/fundraisers-responses.dto'

@ApiTags('fundraisers')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('fundraisers')
export class FundraisersController {
  constructor(private readonly fundraisers: FundraisersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a medical fundraiser (organizer). hospital_momo | hospital_bank only.' })
  @ApiCreatedResponse({ type: FundraiserDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMedicalFundDto) {
    return this.fundraisers.createMedical(user.id, dto)
  }

  @Get('mine')
  @ApiOperation({ summary: 'Medical fundraisers the current user organizes' })
  @ApiOkResponse({ type: [MyFundraiserDto] })
  mine(@CurrentUser() user: AuthUser) {
    return this.fundraisers.myFundraisers(user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fundraiser detail (in-app) — progress, contributors, owner/verify flags' })
  @ApiOkResponse({ type: FundraiserDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fundraisers.detail(user.id, id)
  }

  @Post(':id/verify-payee')
  @ApiOperation({ summary: 'Ops: verify or reject the payee (ops admin only)' })
  @ApiOkResponse({ description: '{ ok, verificationStatus }' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — ops admin only' })
  verifyPayee(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: VerifyPayeeDto) {
    return this.fundraisers.verifyPayee(user.id, id, dto)
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Release the payout (organizer). Hospital routes need a verified payee; individual MoMo does not.' })
  @ApiOkResponse({ description: '{ ok, externalref, amount }' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — organizer only' })
  @ApiConflictResponse({ description: 'PAYEE_UNVERIFIED / INSUFFICIENT_FLOAT' })
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fundraisers.release(user.id, id)
  }

  @Post(':id/invites')
  @ApiOperation({ summary: 'Invite family/friends to contribute (SMS with the donate link) — organizer only' })
  @ApiOkResponse({ description: '{ invited }' })
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: InviteContributorsDto) {
    return this.fundraisers.inviteContributors(user.id, id, dto)
  }

  @Get(':id/invites')
  @ApiOperation({ summary: 'List contributor invites + derived status (invited | contributed)' })
  @ApiOkResponse({ description: 'FundraiserInvite[]' })
  invites(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fundraisers.listInvites(user.id, id)
  }

  @Post(':id/invites/:inviteId/remind')
  @ApiOperation({ summary: 'Re-send the invite SMS (manual reminder; rate-limited) — organizer only' })
  @ApiOkResponse({ description: '{ ok }' })
  @ApiConflictResponse({ description: 'ALREADY_CONTRIBUTED' })
  remind(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.fundraisers.remindInvite(user.id, id, inviteId)
  }

  @Delete(':id/invites/:inviteId')
  @ApiOperation({ summary: 'Remove a contributor invite — organizer only' })
  @ApiOkResponse({ description: '{ ok }' })
  cancelInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.fundraisers.cancelInvite(user.id, id, inviteId)
  }

  @Post(':id/thank')
  @ApiOperation({ summary: 'Send a thank-you SMS to all settled contributors (organizer only)' })
  @ApiOkResponse({ description: '{ sent }' })
  thank(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ThankContributorsDto) {
    return this.fundraisers.thankContributors(user.id, id, dto)
  }
}
