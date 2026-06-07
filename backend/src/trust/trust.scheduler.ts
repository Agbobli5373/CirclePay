import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { shortfallPostings } from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'
import { LockService } from '../outbox/lock.service'
import { LedgerService } from '../ledger/ledger.service'
import { OutboxService } from '../outbox/outbox.service'
import { NotificationsService } from '../notifications/notifications.service'
import { emitCycleFundedIfReady } from '../common/cycle-funded'

const LOCK_KEY = 1_002

/**
 * E6 — Susu default lifecycle. Single-flight (advisory lock) sweep that drives the
 * pending → overdue → grace → defaulted transitions off each member's cycle due date,
 * and applies the platform-wide trust lock on default (CirclePay's core deterrent).
 *
 * Phase 2 — on default it also covers the missed cycle from the defaulter's deposit
 * (then the safety pool) so the cycle's payee is still paid in full, emitting
 * ShortfallCovered and funding the cycle when that completes it.
 */
@Injectable()
export class TrustScheduler {
  private readonly logger = new Logger(TrustScheduler.name)

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly lock: LockService,
    private readonly ledger: LedgerService,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async run(): Promise<void> {
    await this.lock.tryWithLock(LOCK_KEY, () => this.sweep())
  }

  async sweep(): Promise<void> {
    const graceHours = Number(this.config.get<string>('GRACE_HOURS') ?? 48)
    const now = new Date()
    const defaultBefore = new Date(now.getTime() - graceHours * 60 * 60 * 1000)
    const inStartedSusu = { fund: { status: 'active', susu: { is: { startedAt: { not: null } } } } } as const

    // 1) Defaults — unpaid past the grace window → defaulted + platform-wide lock.
    const defaulters = await this.db.member.findMany({
      where: {
        fundStatus: { in: ['active', 'grace'] },
        status: { in: ['pending', 'overdue'] },
        dueAt: { lt: defaultBefore },
        ...inStartedSusu,
      },
      include: { user: true, fund: true },
    })
    for (const m of defaulters) {
      // Can we cover this cycle from the defaulter's deposit (then the safety pool)?
      // Resolve accounts + read balances BEFORE the tx (account upserts/balance reads
      // commit independently — same pattern as contribution settlement).
      const susu = await this.db.susuDetail.findUnique({ where: { fundId: m.fundId } })
      let coverage: { potId: string; depId: string; poolId: string; useDeposit: number; usePool: number; cycle: number } | null = null
      if (susu?.startedAt && susu.contribution > 0 && m.status !== 'paid') {
        const [depAcc, poolAcc, potAcc] = await Promise.all([
          this.ledger.getOrCreateAccount('deposit', m.userId),
          this.ledger.getOrCreateAccount('safety_pool'),
          this.ledger.getOrCreateAccount('fund_pot', m.fundId),
        ])
        const need = susu.contribution
        // Holdings are negative balances; available = how much we hold for them.
        const depositAvail = Math.max(0, -(await this.ledger.balance(depAcc.id)))
        const useDeposit = Math.min(need, depositAvail)
        const poolAvail = Math.max(0, -(await this.ledger.balance(poolAcc.id)))
        const usePool = Math.min(need - useDeposit, poolAvail)
        if (useDeposit + usePool >= need) {
          coverage = { potId: potAcc.id, depId: depAcc.id, poolId: poolAcc.id, useDeposit, usePool, cycle: susu.currentCycle }
        }
      }

      await this.db.$transaction(async (tx) => {
        await tx.member.update({ where: { id: m.id }, data: { fundStatus: 'defaulted' } })
        await tx.trustScore.update({ where: { userId: m.userId }, data: { standing: 'locked' } })
        await tx.activityItem.create({
          data: {
            userId: m.userId,
            type: 'joined',
            title: 'Account locked — missed contribution',
            detail: m.fund.name,
            reference: m.fundId,
          },
        })

        if (coverage) {
          const ref = `sf:${m.fundId}:${coverage.cycle}:${m.userId}`
          await this.ledger.post(
            {
              kind: 'adjustment',
              externalref: ref,
              postings: shortfallPostings({
                fundPotAccountId: coverage.potId,
                depositAccountId: coverage.depId,
                depositUsed: coverage.useDeposit,
                safetyPoolAccountId: coverage.poolId,
                poolUsed: coverage.usePool,
              }),
            },
            tx,
          )
          // The cycle obligation is now met (via coverage), though the member stays defaulted.
          await tx.member.update({ where: { id: m.id }, data: { status: 'paid', paidAt: new Date() } })
          await tx.activityItem.create({
            data: {
              userId: m.userId,
              type: 'contribution',
              title: 'Cycle covered from your deposit',
              detail: m.fund.name,
              amount: coverage.useDeposit + coverage.usePool,
              direction: 'out_',
              reference: ref,
            },
          })
          await this.outbox.emit(
            'ShortfallCovered',
            { fundId: m.fundId, cycle: coverage.cycle, userId: m.userId, shortfall: coverage.useDeposit + coverage.usePool, depositUsed: coverage.useDeposit, poolUsed: coverage.usePool },
            tx,
          )
          // Funding this seat may complete the cycle → pay the current payee.
          await emitCycleFundedIfReady(tx, this.outbox, m.fundId)
        }
      })

      this.logger.warn(`Member defaulted → locked: user ${m.userId} (fund ${m.fundId})${coverage ? ' — cycle covered from deposit' : ''}`)
      await this.safeSms(
        m.user.phone,
        coverage
          ? `CirclePay: your ${m.fund.name} contribution was overdue, so your security deposit covered this cycle. Your account is locked across CirclePay until resolved — reply to appeal.`
          : `CirclePay: your ${m.fund.name} contribution is overdue past the grace window. Your account is now locked across CirclePay until resolved — reply to appeal.`,
      )
    }

    // 2) Overdue (still within grace) — flag + nudge.
    const overdue = await this.db.member.findMany({
      where: { fundStatus: 'active', status: 'pending', dueAt: { lt: now, gte: defaultBefore }, ...inStartedSusu },
      include: { user: true, fund: true },
    })
    for (const m of overdue) {
      await this.db.member.update({ where: { id: m.id }, data: { status: 'overdue', fundStatus: 'grace' } })
      await this.safeSms(
        m.user.phone,
        `CirclePay: your ${m.fund.name} contribution is overdue. Please pay within ${graceHours}h to avoid a platform-wide lock.`,
      )
    }

    if (defaulters.length || overdue.length) {
      this.logger.log(`Trust sweep: ${overdue.length} overdue, ${defaulters.length} defaulted`)
    }
  }

  private async safeSms(phone: string, message: string): Promise<void> {
    try {
      await this.notifications.sendSms(phone, message, 'trust')
    } catch (err) {
      this.logger.warn(`Trust SMS failed: ${(err as Error).message}`)
    }
  }
}
