import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { LockService } from '../outbox/lock.service'
import { NotificationsService } from '../notifications/notifications.service'

const LOCK_KEY = 1_002

/**
 * E6 — Susu default lifecycle. Single-flight (advisory lock) sweep that drives the
 * pending → overdue → grace → defaulted transitions off each member's cycle due date,
 * and applies the platform-wide trust lock on default (CirclePay's core deterrent).
 *
 * Shortfall coverage (deposit/safety-pool) is a later phase; this handles detection,
 * member state, the lock, and SMS nudges.
 */
@Injectable()
export class TrustScheduler {
  private readonly logger = new Logger(TrustScheduler.name)

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly lock: LockService,
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
      })
      this.logger.warn(`Member defaulted → locked: user ${m.userId} (fund ${m.fundId})`)
      await this.safeSms(
        m.user.phone,
        `CirclePay: your ${m.fund.name} contribution is overdue past the grace window. Your account is now locked across CirclePay until resolved — reply to appeal.`,
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
