import { Body, Controller, HttpCode, Logger, Param, Post, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiExcludeController } from '@nestjs/swagger'
import { UssdService } from './ussd.service'
import { parseInbound, formatReply, type UssdInboundBody } from './ussd.adapter'

/**
 * Inbound USSD endpoint (E10). The carrier/aggregator gateway POSTs one request per
 * keypress to /api/ussd/<USSD_GATEWAY_SECRET> and expects a `CON `/`END ` text reply.
 *
 * Security mirrors the Moolre webhook: a secret path token guards this public endpoint
 * (no JwtAuthGuard — a USSD call carries no cookie). The PIN entered in-session is the
 * real authorization gate, verified via the shared auth lockout.
 */
@ApiExcludeController()
@Controller('ussd')
export class UssdController {
  private readonly logger = new Logger(UssdController.name)

  constructor(
    private readonly config: ConfigService,
    private readonly ussd: UssdService,
  ) {}

  @Post(':secret')
  @HttpCode(200)
  async handle(@Param('secret') secret: string, @Body() body: UssdInboundBody): Promise<string> {
    const expected = this.config.get<string>('USSD_GATEWAY_SECRET')
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid USSD secret')
    }
    const req = parseInbound(body ?? {})
    const reply = await this.ussd.handle(req)
    return formatReply(reply)
  }
}
