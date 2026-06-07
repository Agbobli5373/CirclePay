import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { contributionPostings } from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'
import { LedgerService } from '../ledger/ledger.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OutboxDispatcher } from '../outbox/outbox.dispatcher'
import { OutboxService } from '../outbox/outbox.service'
import { emitCycleFundedIfReady } from '../common/cycle-funded'

/**
 * E4-S2/S3 — settle a contribution (idempotent) and send the SMS receipt.
 *
 * This is the registered handler for the `ContributionSettled` outbox event.
 * Settlement CONFIRMATION is the enqueuer's responsibility: the webhook receiver
 * (E2-S4) re-confirms via MoolreService.isSettled() before queueing the event,
 * and the reconciliation cron (E12) will do the same. This handler therefore
 * trusts the event and is guarded purely on Contribution.status, so it can be
 * safely retried / replayed.
 */
@Injectable()
export class ContributionSettlementService implements OnModuleInit {
  private readonly logger = new Logger(ContributionSettlementService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly dispatcher: OutboxDispatcher,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register('ContributionSettled', (payload) => this.handle(payload))
  }

  private async handle(payload: unknown): Promise<void> {
    const p = (payload ?? {}) as { externalref?: string; transactionid?: string | null }
    if (typeof p.externalref !== 'string' || !p.externalref.startsWith('c:')) return
    await this.settle(p.externalref, p.transactionid ?? null)
  }

  /**
   * Idempotently finalise a contribution:
   *  - one balanced LedgerTransaction (moolre_float += total−moolreFee, fund_pot −= amount,
   *    platform_fee −= fee, moolre_fee += moolreFee)
   *  - Contribution → settled, Member current cycle → paid, activity item
   *  - exactly-once-ish SMS receipt (guarded by Contribution.receiptSentAt)
   */
  async settle(externalref: string, transactionid: string | null): Promise<void> {
    const c = await this.db.contribution.findUnique({ where: { externalref } })
    if (!c) {
      this.logger.warn(`settle: no contribution for ${externalref}`)
      return
    }
    if (c.status === 'failed') return

    if (c.status !== 'settled') {
      // Ensure ledger accounts (idempotent upserts) before opening the transaction.
      const [floatAcc, potAcc, feeAcc] = await Promise.all([
        this.ledger.getOrCreateAccount('moolre_float'),
        this.ledger.getOrCreateAccount('fund_pot', c.fundId),
        this.ledger.getOrCreateAccount('platform_fee'),
      ])
      const moolreFee = 0 // E12: read the real Moolre collection fee from settlement status.
      const postings = contributionPostings({
        moolreFloatAccountId: floatAcc.id,
        fundPotAccountId: potAcc.id,
        platformFeeAccountId: feeAcc.id,
        amount: c.amount,
        platformFee: c.fee,
        moolreFee,
      })

      await this.db.$transaction(async (tx) => {
        // Serialise per-fund so concurrent settlements can't both fire CycleFunded.
        await tx.$queryRaw`SELECT id FROM "Fund" WHERE id = ${c.fundId} FOR UPDATE`

        const fresh = await tx.contribution.findUnique({ where: { externalref } })
        if (!fresh || fresh.status === 'settled') return // lost the race — no double post
        await this.ledger.post(
          { kind: 'contribution', externalref, reference: c.reference ?? undefined, postings },
          tx,
        )
        await tx.contribution.update({
          where: { externalref },
          data: { status: 'settled', settledAt: new Date(), transactionId: transactionid ?? c.transactionId },
        })
        // Mark the member paid (clears any overdue/grace) and update on-time trust scoring.
        const mem = await tx.member.findUnique({
          where: { fundId_userId: { fundId: c.fundId, userId: c.userId } },
        })
        const onTime = !mem?.dueAt || new Date() <= mem.dueAt
        await tx.member.update({
          where: { fundId_userId: { fundId: c.fundId, userId: c.userId } },
          data: { status: 'paid', paidAt: new Date(), fundStatus: 'active' },
        })
        const ts = await tx.trustScore.findUnique({ where: { userId: c.userId } })
        if (ts) {
          const total = ts.contributionsTotal + 1
          const onTimeCount = ts.contributionsOnTime + (onTime ? 1 : 0)
          await tx.trustScore.update({
            where: { userId: c.userId },
            data: {
              contributionsTotal: total,
              contributionsOnTime: onTimeCount,
              onTimeRate: Math.round((onTimeCount / total) * 100),
            },
          })
        }
        await tx.activityItem.create({
          data: {
            userId: c.userId,
            type: 'contribution',
            title: 'Contribution received',
            detail: `Cycle ${c.cycle ?? '-'}`,
            amount: c.amount,
            direction: 'in_',
            reference: externalref,
          },
        })

        // E5-S1: when every member's obligation for this cycle is met, fund the cycle.
        if (await emitCycleFundedIfReady(tx, this.outbox, c.fundId)) {
          this.logger.log(`Cycle funded → CycleFunded ${c.fundId}`)
        }
      })
      this.logger.log(`Settled contribution ${externalref}`)
    }

    await this.ensureReceipt(externalref)
  }

  /** Best-effort SMS receipt, sent at most once (guarded by receiptSentAt). */
  private async ensureReceipt(externalref: string): Promise<void> {
    const c = await this.db.contribution.findUnique({ where: { externalref } })
    if (!c || c.status !== 'settled' || c.receiptSentAt) return

    const [user, fund] = await Promise.all([
      this.db.user.findUnique({ where: { id: c.userId } }),
      this.db.fund.findUnique({ where: { id: c.fundId } }),
    ])
    if (!user || !fund) return

    try {
      await this.notifications.sendReceipt(
        user.phone,
        { fundName: fund.name, cycle: c.cycle ?? 0, amountPesewas: c.amount, externalref },
        user.language,
      )
      await this.db.contribution.update({ where: { externalref }, data: { receiptSentAt: new Date() } })
    } catch (err) {
      // Don't block settlement on SMS (sandbox/no-VASKEY). receiptSentAt stays null for a later resend.
      this.logger.warn(`Receipt SMS failed for ${externalref}: ${(err as Error).message}`)
    }
  }
}
