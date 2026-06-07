import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { depositPostings } from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'
import { LedgerService } from '../ledger/ledger.service'
import { OutboxDispatcher } from '../outbox/outbox.dispatcher'

/**
 * Settle a member's security deposit (idempotent). Registered handler for the
 * `DepositSettled` outbox event (the webhook receiver re-confirms via
 * MoolreService.isSettled() before queueing). Guarded purely on Member.depositPaid,
 * so it can be safely retried / replayed.
 *
 * Posts one balanced transaction: moolre_float += amount, deposit(user) -= amount
 * (the member's deposit is held as a liability, like the pot holds contributions).
 */
@Injectable()
export class DepositSettlementService implements OnModuleInit {
  private readonly logger = new Logger(DepositSettlementService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly dispatcher: OutboxDispatcher,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register('DepositSettled', (payload) => this.handle(payload))
  }

  private async handle(payload: unknown): Promise<void> {
    const p = (payload ?? {}) as { externalref?: string }
    if (typeof p.externalref !== 'string' || !p.externalref.startsWith('d:')) return
    await this.settle(p.externalref)
  }

  async settle(externalref: string): Promise<void> {
    const parts = externalref.split(':')
    if (parts.length !== 3) return
    const [, fundId, userId] = parts

    const member = await this.db.member.findUnique({ where: { fundId_userId: { fundId, userId } } })
    if (!member) {
      this.logger.warn(`deposit settle: no member for ${externalref}`)
      return
    }
    if (member.depositPaid) return // already settled — idempotent

    const susu = await this.db.susuDetail.findUnique({ where: { fundId } })
    if (!susu || susu.depositAmount <= 0) return
    const amount = susu.depositAmount

    const [floatAcc, depAcc] = await Promise.all([
      this.ledger.getOrCreateAccount('moolre_float'),
      this.ledger.getOrCreateAccount('deposit', userId),
    ])
    const moolreFee = 0 // E12: read the real Moolre collection fee from settlement status.
    const postings = depositPostings({
      moolreFloatAccountId: floatAcc.id,
      depositAccountId: depAcc.id,
      amount,
      moolreFee,
    })

    await this.db.$transaction(async (tx) => {
      const fresh = await tx.member.findUnique({ where: { fundId_userId: { fundId, userId } } })
      if (!fresh || fresh.depositPaid) return // lost the race — no double post
      await this.ledger.post({ kind: 'contribution', externalref, postings }, tx)
      await tx.member.update({ where: { fundId_userId: { fundId, userId } }, data: { depositPaid: true } })
      await tx.activityItem.create({
        data: {
          userId,
          type: 'contribution',
          title: 'Security deposit paid',
          detail: 'Susu safety deposit',
          amount,
          direction: 'in_',
          reference: externalref,
        },
      })
    })
    this.logger.log(`Settled deposit ${externalref}`)
  }
}
