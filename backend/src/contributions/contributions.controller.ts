import { Body, Controller, Get, Headers, Param, Post, Res, UseGuards } from '@nestjs/common'
import {
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import type { AuthUser } from '../common/auth/auth-user'
import { ContributionsService } from './contributions.service'
import { InitiateContributionDto } from './dto/contributions.dto'
import { InitiateContributionResultDto, ContributionStatusDto } from './dto/contributions-responses.dto'

@ApiTags('contributions')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate a cycle contribution via MoMo (with OTP). Requires Idempotency-Key.' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique per payment attempt; replays the first terminal response.' })
  @ApiResponse({ status: 202, description: 'initiated — collection accepted, awaiting settlement', type: InitiateContributionResultDto })
  @ApiResponse({ status: 200, description: 'otp_required (resubmit with otpcode) or already settled', type: InitiateContributionResultDto })
  @ApiBadRequestResponse({ description: 'IDEMPOTENCY_KEY_REQUIRED / VALIDATION' })
  @ApiForbiddenResponse({ description: 'NOT_MEMBER — not an active member of the fund' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — fund/user not found' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiateContributionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { statusCode, body } = await this.contributions.initiate(user.id, dto, idempotencyKey)
    res.status(statusCode)
    return body
  }

  @Get(':externalref')
  @ApiOperation({ summary: 'Contribution status (poll until settled). Owner only.' })
  @ApiOkResponse({ type: ContributionStatusDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — not your contribution' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  status(@CurrentUser() user: AuthUser, @Param('externalref') externalref: string) {
    return this.contributions.getOne(user.id, externalref)
  }
}
