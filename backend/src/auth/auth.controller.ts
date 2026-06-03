import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiCookieAuth, ApiOperation } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { RequestOtpDto, VerifyOtpDto, SetPinDto, LoginDto } from './dto/auth.dto'
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
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto)
  }

  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the OTP; sets a session (existing user) or reg-token (new)' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyOtp(dto, res)
  }

  @Post('set-pin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create account + PIN from a registration token; issues a session' })
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
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res)
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the session using the refresh cookie' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(refreshCookie(req), res)
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the session' })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(refreshCookie(req), res)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user)
  }
}
