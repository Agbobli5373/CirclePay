import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import {
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { RequestOtpDto, VerifyOtpDto, SetPinDto, LoginDto } from './dto/auth.dto'
import { OkResponseDto, VerifyOtpResponseDto, MeResponseDto } from './dto/auth-responses.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthUser } from './jwt.strategy'

function regCookie(req: Request): string | undefined {
  return (req as Request & { cookies?: Record<string, string> }).cookies?.reg_token
}
function refreshCookie(req: Request): string | undefined {
  return (req as Request & { cookies?: Record<string, string> }).cookies?.refresh_token
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send an SMS OTP to a Ghana MoMo number' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED — too many OTP requests' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto)
  }

  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the OTP; sets a session (existing user) or reg-token (new)' })
  @ApiOkResponse({ type: VerifyOtpResponseDto })
  @ApiBadRequestResponse({ description: 'OTP_INVALID / OTP_EXPIRED / OTP_TOO_MANY_ATTEMPTS' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyOtp(dto, res)
  }

  @Post('set-pin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create account + PIN from a registration token; issues a session' })
  @ApiCreatedResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'REG_TOKEN_INVALID — restart onboarding' })
  @ApiBadRequestResponse({ description: 'PIN_INVALID / ALREADY_REGISTERED' })
  setPin(
    @Body() dto: SetPinDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.setPin(regCookie(req), dto, res)
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with phone + PIN' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_INVALID — wrong phone or PIN' })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res)
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the session using the refresh cookie' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_INVALID — invalid/replayed refresh token' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(refreshCookie(req), res)
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the session' })
  @ApiOkResponse({ type: OkResponseDto })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(refreshCookie(req), res)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Current authenticated user' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'No/invalid session' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user)
  }
}
