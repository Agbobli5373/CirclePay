import { Body, Controller, Get, Headers, Param, Post, Res, UseGuards } from '@nestjs/common'
import {
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard'
import { CurrentUser } from '../common/auth/current-user.decorator'
import type { AuthUser } from '../common/auth/auth-user'
import { DepositsService } from './deposits.service'
import { InitiateDepositDto } from './dto/deposits.dto'

@ApiTags('deposits')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('deposits')
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  @Post()
  @ApiOperation({ summary: 'Pay a Susu security deposit via MoMo (with OTP). Requires Idempotency-Key.' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique per payment attempt; replays the first terminal response.' })
  @ApiResponse({ status: 202, description: 'initiated — collection accepted, awaiting settlement' })
  @ApiResponse({ status: 200, description: 'otp_required (resubmit with otpcode) or already settled' })
  @ApiForbiddenResponse({ description: 'NOT_MEMBER — not a member of the fund' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — fund/user not found' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiateDepositDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { statusCode, body } = await this.deposits.initiate(user.id, dto, idempotencyKey)
    res.status(statusCode)
    return body
  }

  @Get(':externalref')
  @ApiOperation({ summary: 'Deposit status (poll until settled). Owner only.' })
  @ApiOkResponse({ description: 'Deposit status' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — not your deposit' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  status(@CurrentUser() user: AuthUser, @Param('externalref') externalref: string) {
    return this.deposits.getOne(user.id, externalref)
  }
}
