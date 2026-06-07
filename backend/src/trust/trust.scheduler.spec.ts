import { TrustScheduler } from './trust.scheduler'
import { ConfigService } from '@nestjs/config'

const config = { get: () => '48' } as unknown as ConfigService

type Opts = { susu?: unknown; balances?: Record<string, number>; paidCount?: number }

function deps(defaulters: unknown[], overdue: unknown[], opts: Opts = {}) {
  const tx = {
    member: { update: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(opts.paidCount ?? 0) },
    trustScore: { update: jest.fn().mockResolvedValue({}) },
    activityItem: { create: jest.fn().mockResolvedValue({}) },
    susuDetail: { findUnique: jest.fn().mockResolvedValue(opts.susu ?? null) },
    payout: { findUnique: jest.fn().mockResolvedValue(null) },
  }
  const db = {
    member: {
      findMany: jest.fn().mockResolvedValueOnce(defaulters).mockResolvedValueOnce(overdue),
      update: jest.fn().mockResolvedValue({}),
    },
    susuDetail: { findUnique: jest.fn().mockResolvedValue(opts.susu ?? null) },
    $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  }
  const lock = { tryWithLock: jest.fn(async (_k: number, fn: () => Promise<void>) => fn()) }
  const notifications = { sendSms: jest.fn().mockResolvedValue(undefined) }
  const ledger = {
    getOrCreateAccount: jest.fn(async (type: string, owner?: string) => ({ id: `${type}:${owner ?? 'GLOBAL'}` })),
    balance: jest.fn(async (id: string) => opts.balances?.[id] ?? 0),
    post: jest.fn().mockResolvedValue(undefined),
  }
  const outbox = { emit: jest.fn().mockResolvedValue(undefined) }
  const svc = new TrustScheduler(db as never, config, lock as never, ledger as never, outbox as never, notifications as never)
  return { svc, db, tx, notifications, ledger, outbox }
}

const member = (id: string, userId: string, fundStatus: string = 'active') => ({
  id,
  userId,
  fundId: 'f1',
  status: 'overdue',
  fundStatus,
  user: { phone: '+233240000001' },
  fund: { name: 'Kumasi Traders' },
})

const startedSusu = { startedAt: new Date(), contribution: 50000, currentCycle: 1, memberCount: 3, payoutOrder: ['u9'] }

describe('TrustScheduler.sweep', () => {
  it('defaults an unpaid member past grace and locks them platform-wide', async () => {
    const { svc, tx, notifications } = deps([member('m1', 'u1')], [])
    await svc.sweep()
    expect(tx.member.update).toHaveBeenCalledWith(expect.objectContaining({ data: { fundStatus: 'defaulted' } }))
    expect(tx.trustScore.update).toHaveBeenCalledWith(expect.objectContaining({ data: { standing: 'locked' } }))
    expect(notifications.sendSms).toHaveBeenCalled()
  })

  it('flags an overdue member (within grace) without locking', async () => {
    const { svc, db, tx } = deps([], [member('m2', 'u2')])
    await svc.sweep()
    expect(db.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'overdue', fundStatus: 'grace' } }),
    )
    expect(tx.trustScore.update).not.toHaveBeenCalled()
  })

  it('covers the missed cycle from the defaulter deposit and emits ShortfallCovered', async () => {
    const { svc, tx, ledger, outbox } = deps([member('m1', 'u1')], [], {
      susu: startedSusu,
      balances: { 'deposit:u1': -50000, 'safety_pool:GLOBAL': 0 }, // holds a GHS 500 deposit
      paidCount: 1, // still short of memberCount → focuses the assertion on coverage
    })
    await svc.sweep()
    expect(ledger.post).toHaveBeenCalledWith(expect.objectContaining({ kind: 'adjustment' }), tx)
    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }),
    )
    expect(outbox.emit).toHaveBeenCalledWith(
      'ShortfallCovered',
      expect.objectContaining({ depositUsed: 50000, poolUsed: 0 }),
      tx,
    )
  })

  it('does NOT cover when deposit + pool cannot meet the full contribution', async () => {
    const { svc, ledger, outbox } = deps([member('m1', 'u1')], [], {
      susu: startedSusu,
      balances: { 'deposit:u1': -10000, 'safety_pool:GLOBAL': 0 }, // only GHS 100 held; needs 500
    })
    await svc.sweep()
    expect(ledger.post).not.toHaveBeenCalled()
    expect(outbox.emit).not.toHaveBeenCalled()
  })

  it('re-covers an ALREADY-defaulted member in a later cycle without re-locking', async () => {
    const { svc, tx, ledger, outbox } = deps([member('m1', 'u1', 'defaulted')], [], {
      susu: { ...startedSusu, currentCycle: 2 },
      balances: { 'deposit:u1': -50000, 'safety_pool:GLOBAL': 0 }, // deposit still has funds
      paidCount: 1,
    })
    await svc.sweep()
    // Coverage recurs for the new cycle…
    expect(ledger.post).toHaveBeenCalledWith(expect.objectContaining({ kind: 'adjustment' }), tx)
    expect(outbox.emit).toHaveBeenCalledWith('ShortfallCovered', expect.objectContaining({ cycle: 2 }), tx)
    expect(tx.member.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }))
    // …but the member is NOT re-locked (already defaulted).
    expect(tx.trustScore.update).not.toHaveBeenCalled()
    expect(tx.member.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { fundStatus: 'defaulted' } }))
  })
})
