import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  cyclePayoutAmount,
  payoutPostings,
  trustStanding,
  type TrustStanding,
} from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'
import { MoolreService } from '../moolre/moolre.service'
import { LedgerService } from '../ledger/ledger.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OutboxDispatcher } from '../outbox/outbox.dispatcher'
import { OutboxService } from '../outbox/outbox.service'
import { transferChannelFor, toMoolrePayer, ghs } from '../moolre/moolre.format'

/** Shared rules use 'new'; Prisma's enum uses 'new_'. */
function toPrismaStanding(s: TrustStanding): string {
  return s === 'new' ? 'new_' : s
}

/**
 * E5 — Susu cycle engine & payouts. Registers three outbox handlers:
 *  - CycleFunded   → disburse the pot to the cycle recipient (exactly once).
 *  - PayoutSettled → post the payout to the ledger, advance the cycle / complete the fund, SMS.
 *  - FundCompleted → terminal log hook (consumer lands in a later epic).
 *
 * Exactly-once payout = unique Payout.externalref (p:{fundId}:{cycle}) + the dispatcher's
 * single-flight advisory lock + status guards. INFRA-only deps; no other feature imported.
 */
@Injectable()
export class PayoutsService implements OnModuleInit {
  private readonly logger = new Logger(PayoutsService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly moolre: MoolreService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly dispatcher: OutboxDispatcher,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register('CycleFunded', (p) => this.disburse(p))
    this.dispatcher.register('PayoutSettled', (p) => this.settle(p))
    this.dispatcher.register('FundCompleted', (p) => this.onFundCompleted(p))
  }

  // ---------- S2: disburse ----------

  async disburse(payload: unknown): Promise<void> {
    const p = (payload ?? {}) as { fundId?: string; cycle?: number }
    if (!p.fundId || !p.cycle) return
    const { fundId, cycle } = p
    const externalref = `p:${fundId}:${cycle}`

    const fund = await this.db.fund.findUnique({ where: { id: fundId }, include: { susu: true } })
    if (!fund || !fund.susu) {
      this.logger.warn(`disburse: no susu fund ${fundId}`)
      return
    }
    const amount = cyclePayoutAmount(fund.susu.contribution, fund.susu.memberCount)
    const order = Array.isArray(fund.susu.payoutOrder) ? (fund.susu.payoutOrder as string[]) : []
    const payeeUserId = order[cycle - 1]
    if (!payeeUserId) {
      this.logger.error(`disburse: no payee for ${externalref}`)
      return
    }

    // Find-or-create the Payout — unique externalref makes this exactly-once.
    let payout = await this.db.payout.findUnique({ where: { externalref } })
    if (!payout) {
      try {
        payout = await this.db.payout.create({
          data: { fundId, cycle, payeeUserId, amount, externalref, status: 'initiated' },
        })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          payout = await this.db.payout.findUnique({ where: { externalref } })
        } else throw e
      }
    }
    if (!payout) return
    if (payout.status === 'settled' || payout.transactionId) return // already attempted/settled

    const payee = await this.db.user.findUnique({ where: { id: payeeUserId } })
    if (!payee) {
      this.logger.error(`disburse: payee ${payeeUserId} not found`)
      return
    }

    // Best-effort float guard — never attempt a partial transfer.
    try {
      const bal = await this.moolre.getBalance()
      const available = Number(bal.data?.balance ?? 0) * 100 // GHS → pesewas
      if (available > 0 && available < amount) {
        this.logger.error(`HOLD payout ${externalref}: float ${available} < pot ${amount}`)
        throw new Error('INSUFFICIENT_FLOAT')
      }
    } catch (err) {
      if ((err as Error).message === 'INSUFFICIENT_FLOAT') throw err
      // getBalance unavailable (sandbox) — proceed; settlement is still gated on Moolre.
    }

    const res = await this.moolre.transfer({
      channel: transferChannelFor(payee.network),
      receiver: toMoolrePayer(payee.phone),
      amount: ghs(amount),
      externalref,
      sublistid: process.env.MOOLRE_SUBLIST_ID ?? '',
    })
    const txId = res.data?.transactionid
    if (txId) await this.db.payout.update({ where: { externalref }, data: { transactionId: String(txId) } })
    this.logger.log(`Disbursed ${externalref} → ${amount} pesewas`)
  }

  // ---------- S2/S3: settle + advance ----------

  async settle(payload: unknown): Promise<void> {
    const p = (payload ?? {}) as { externalref?: string; transactionid?: string | null }
    if (typeof p.externalref !== 'string' || !p.externalref.startsWith('p:')) return
    const externalref = p.externalref

    const payout = await this.db.payout.findUnique({ where: { externalref } })
    if (!payout || !payout.fundId || payout.cycle == null) return
    if (payout.status === 'failed') return

    let completed = false
    if (payout.status !== 'settled') {
      const [floatAcc, potAcc] = await Promise.all([
        this.ledger.getOrCreateAccount('moolre_float'),
        this.ledger.getOrCreateAccount('fund_pot', payout.fundId),
      ])
      const postings = payoutPostings({
        moolreFloatAccountId: floatAcc.id,
        fundPotAccountId: potAcc.id,
        amount: payout.amount,
        moolreFee: 0, // E12: read the real transfer fee from settlement status.
      })

      completed = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Fund" WHERE id = ${payout.fundId} FOR UPDATE`
        const fresh = await tx.payout.findUnique({ where: { externalref } })
        if (!fresh || fresh.status === 'settled') return false

        await this.ledger.post({ kind: 'payout', externalref, postings }, tx)
        await tx.payout.update({
          where: { externalref },
          data: { status: 'settled', settledAt: new Date(), transactionId: p.transactionid ?? payout.transactionId },
        })
        if (payout.payeeUserId) {
          await tx.activityItem.create({
            data: {
              userId: payout.payeeUserId,
              type: 'payout',
              title: 'Susu payout sent',
              detail: `Cycle ${payout.cycle}`,
              amount: payout.amount,
              direction: 'out_',
              reference: externalref,
            },
          })
        }

        const susu = await tx.susuDetail.findUnique({ where: { fundId: payout.fundId } })
        if (!susu) return false
        if (payout.cycle! < susu.totalCycles) {
          // Advance to the next cycle; reset EVERY in-rotation member for the new round —
          // including defaulted members, so a deposit-covered defaulter doesn't carry a stale
          // status='paid' into later cycles (which would over-count the funded check and over-pay).
          await tx.susuDetail.update({ where: { fundId: payout.fundId }, data: { currentCycle: payout.cycle! + 1 } })
          await tx.member.updateMany({
            where: { fundId: payout.fundId, fundStatus: { in: ['active', 'grace', 'defaulted'] } },
            data: { status: 'pending', paidAt: null },
          })
          return false
        }
        // Final cycle → complete the fund + credit trust.
        await tx.fund.update({ where: { id: payout.fundId }, data: { status: 'completed' } })
        const members = await tx.member.findMany({ where: { fundId: payout.fundId, fundStatus: 'active' } })
        for (const m of members) {
          const ts = await tx.trustScore.findUnique({ where: { userId: m.userId } })
          const fundsCompleted = (ts?.fundsCompleted ?? 0) + 1
          const segmentsFilled = Math.min(5, fundsCompleted)
          await tx.trustScore.update({
            where: { userId: m.userId },
            data: { fundsCompleted, segmentsFilled, standing: toPrismaStanding(trustStanding(segmentsFilled)) as never },
          })
        }
        await this.outbox.emit('FundCompleted', { fundId: payout.fundId }, tx)
        return true
      })
      this.logger.log(`Settled payout ${externalref}${completed ? ' (fund completed)' : ''}`)

      // SMS only on the actual transition (best-effort).
      await this.sendPayoutSms(externalref)
    }
  }

  private async sendPayoutSms(externalref: string): Promise<void> {
    const payout = await this.db.payout.findUnique({ where: { externalref } })
    if (!payout || payout.status !== 'settled' || !payout.payeeUserId) return
    const [payee, fund] = await Promise.all([
      this.db.user.findUnique({ where: { id: payout.payeeUserId } }),
      this.db.fund.findUnique({ where: { id: payout.fundId } }),
    ])
    if (!payee || !fund) return
    try {
      await this.notifications.sendSms(
        payee.phone,
        `CirclePay: Your ${fund.name} payout of GHS ${ghs(payout.amount)} is on the way to your MoMo. Powered by Moolre.`,
        `payout:${externalref}`,
      )
    } catch (err) {
      this.logger.warn(`Payout SMS failed for ${externalref}: ${(err as Error).message}`)
    }
  }

  // ---------- FundCompleted (terminal hook) ----------

  private async onFundCompleted(payload: unknown): Promise<void> {
    const fundId = (payload as { fundId?: string })?.fundId
    this.logger.log(`Fund completed: ${fundId ?? '?'}`)
  }
}
