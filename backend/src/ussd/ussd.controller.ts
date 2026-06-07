import { Body, Controller, HttpCode, Logger, Param, Post, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
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
@ApiTags('USSD')
@Controller('ussd')
export class UssdController {
  private readonly logger = new Logger(UssdController.name)

  constructor(
    private readonly config: ConfigService,
    private readonly ussd: UssdService,
  ) {}

  @Post(':secret')
  @HttpCode(200)
  @ApiOperation({
    summary: 'USSD gateway callback (*714#)',
    description:
      'The carrier/aggregator POSTs one request per keypress with {sessionId, phone, text}. The reply is ' +
      'plain text: "CON ..." keeps the session open, "END ..." closes it. Reuse one sessionId across calls; ' +
      '`text` is the latest entry ("" on the first/dial request). Needs a registered user + their PIN; ' +
      'guarded by the USSD_GATEWAY_SECRET path token.',
  })
  @ApiParam({ name: 'secret', description: 'Must equal USSD_GATEWAY_SECRET', example: 'dev-ussd-secret' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'phone'],
      properties: {
        sessionId: { type: 'string', example: 'demo-1', description: 'Stable id for the whole USSD session' },
        phone: { type: 'string', example: '+233241234567', description: "Caller's number (must match a registered user)" },
        text: { type: 'string', example: '', description: 'Latest keypad input; empty on the first (dial) request' },
      },
    },
  })
  @ApiOkResponse({ description: 'Plain-text USSD reply, e.g. "CON Welcome to CirclePay\\nEnter your PIN:"' })
  async handle(@Param('secret') secret: string, @Body() body: UssdInboundBody): Promise<string> {
    // The gateway is semi-trusted: this secret path token is the only network guard
    // (set USSD_GATEWAY_SECRET in .env). The in-session PIN is the real authorization.
    const expected = this.config.get<string>('USSD_GATEWAY_SECRET')
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid USSD secret')
    }
    const req = parseInbound(body ?? {})
    const reply = await this.ussd.handle(req)
    return formatReply(reply)
  }
}
