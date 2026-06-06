import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
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
import { CreateMedicalFundDto, VerifyPayeeDto } from './dto/fundraisers.dto'
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
  @ApiOperation({ summary: 'Release the single verified payout to the hospital (organizer only)' })
  @ApiOkResponse({ description: '{ ok, externalref, amount }' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — organizer only' })
  @ApiConflictResponse({ description: 'PAYEE_UNVERIFIED / INSUFFICIENT_FLOAT' })
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fundraisers.release(user.id, id)
  }
}
