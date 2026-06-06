import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiExcludeController } from '@nestjs/swagger'
import { MoolreService } from '../moolre/moolre.service'
import { OutboxDispatcher } from '../outbox/outbox.dispatcher'
import { PrismaService } from '../prisma/prisma.service'

interface MoolreWebhookBody {
  status?: number | string
  code?: string
  data?: {
    externalref?: string
    transactionid?: string
    txstatus?: number
    txtype?: number
    payer?: string
    amount?: string
  }
}

/**
 * Receives Moolre payment callbacks.
 * Register this URL in your Moolre dashboard:
 *   https://yourapi.com/api/webhooks/moolre/<MOOLRE_WEBHOOK_SECRET>
 *
 * Security:
 *  1. The secret path token guards the endpoint (Moolre sends no signature).
 *  2. We re-confirm via MoolreService.isSettled() before emitting any events.
 *  3. Idempotent: duplicate webhooks for the same externalref are no-ops.
 *
 * See moolre-integration/references/webhooks.md for the full model.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(
    private readonly config: ConfigService,
    private readonly moolre: MoolreService,
    private readonly dispatcher: OutboxDispatcher,
    private readonly db: PrismaService,
  ) {}

  @Post('moolre/:secret')
  @HttpCode(200)
  async handleMoolre(
    @Param('secret') secret: string,
    @Body() body: MoolreWebhookBody,
  ): Promise<{ ok: boolean }> {
    // 1. Guard the secret path token.
    const expected = this.config.get<string>('MOOLRE_WEBHOOK_SECRET')
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret')
    }

    const externalref = body.data?.externalref
    if (!externalref) {
      // Nothing to process — ack immediately.
      return { ok: true }
    }

    // 2. Re-confirm with Moolre (never credit off the inbound body alone).
    const settled = await this.moolre.isSettled(externalref)
    if (!settled) {
      this.logger.debug(`Webhook for ${externalref} — not yet settled, skipping`)
      return { ok: true }
    }

    // 3. Determine the event type from the externalref scheme:
    //    c:fundId:cycle:userId  → ContributionSettled
    //    p:fundId:cycle         → PayoutSettled
    //    d:fundId:userId        → DepositSettled
    //    mp:fundId:batch        → MedicalPayoutSettled
    const eventType = resolveEventType(externalref)
    if (!eventType) {
      this.logger.warn(`Unknown externalref scheme: ${externalref}`)
      return { ok: true }
    }

    // 4. Idempotency: check if already dispatched/pending for this ref.
    const already = await this.db.outboxEvent.findFirst({
      where: {
        type: eventType,
        // Use JSON path to check the payload externalref.
        payload: { path: ['externalref'], equals: externalref },
        status: { in: ['pending', 'dispatched'] },
      },
    })
    if (already) {
      this.logger.debug(`Duplicate webhook for ${externalref} — already queued`)
      return { ok: true }
    }

    // 5. Emit the settlement event into the outbox within its own transaction.
    //    Feature handlers (contributions, payouts) process it asynchronously.
    await this.db.$transaction(async (tx) => {
      await tx.outboxEvent.create({
        data: {
          type: eventType,
          payload: {
            externalref,
            transactionid: body.data?.transactionid ?? null,
            txtype: body.data?.txtype ?? null,
            amount: body.data?.amount ?? null,
          },
          status: 'pending',
          attempts: 0,
        },
      })
    })

    this.logger.log(`Queued ${eventType} for ${externalref}`)
    return { ok: true }
  }
}

/** Map the externalref prefix to the correct DomainEventType. */
function resolveEventType(ref: string): string | null {
  if (ref.startsWith('c:')) return 'ContributionSettled'
  if (ref.startsWith('p:')) return 'PayoutSettled'
  if (ref.startsWith('d:')) return 'DepositSettled'
  if (ref.startsWith('mp:')) return 'MedicalPayoutSettled'
  if (ref.startsWith('mc:')) return 'DonationSettled' // medical donation (handled by fundraisers)
  return null
}
