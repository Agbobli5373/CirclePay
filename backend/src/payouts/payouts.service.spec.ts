import { PayoutsService } from './payouts.service'

const POT = 100000 // 50000 × 2

function disburseDeps(payout: unknown) {
  const db = {
    fund: { findUnique: jest.fn().mockResolvedValue({ susu: { contribution: 50000, memberCount: 2, payoutOrder: ['u1', 'u2'] } }) },
    payout: {
      findUnique: jest.fn().mockResolvedValue(payout),
      create: jest.fn().mockResolvedValue({ externalref: 'p:f1:1', status: 'initiated', transactionId: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ phone: '+233240000001', network: 'MTN' }) },
  }
  const moolre = {
    getBalance: jest.fn().mockResolvedValue({ data: { balance: 100000 } }),
    transfer: jest.fn().mockResolvedValue({ data: { transactionid: 'OBGH-1' } }),
  }
  const deps = [db, moolre, {}, {}, { register: jest.fn() }, { emit: jest.fn() }] as const
  const svc = new PayoutsService(...(deps as unknown as ConstructorParameters<typeof PayoutsService>))
  return { svc, db, moolre }
}

beforeEach(() => jest.clearAllMocks())

describe('PayoutsService.onModuleInit', () => {
  it('registers CycleFunded, PayoutSettled and FundCompleted handlers', () => {
    const dispatcher = { register: jest.fn() }
    const svc = new PayoutsService(
      {} as never, {} as never, {} as never, {} as never, dispatcher as never, {} as never,
    )
    svc.onModuleInit()
    const types = dispatcher.register.mock.calls.map((c) => c[0])
    expect(types).toEqual(expect.arrayContaining(['CycleFunded', 'PayoutSettled', 'FundCompleted']))
  })
})

describe('PayoutsService.disburse', () => {
  it('creates one Payout and transfers once', async () => {
    const { svc, db, moolre } = disburseDeps(null)
    await svc.disburse({ fundId: 'f1', cycle: 1 })
    expect(db.payout.create).toHaveBeenCalledTimes(1)
    expect(moolre.transfer).toHaveBeenCalledTimes(1)
    expect(moolre.transfer).toHaveBeenCalledWith(
      expect.objectContaining({ channel: '1', receiver: '233240000001', amount: '1000.00', externalref: 'p:f1:1' }),
    )
    expect(db.payout.update).toHaveBeenCalledWith(expect.objectContaining({ data: { transactionId: 'OBGH-1' } }))
  })

  it('does not transfer again when a payout was already attempted (transactionId set)', async () => {
    const { svc, db, moolre } = disburseDeps({ externalref: 'p:f1:1', status: 'initiated', transactionId: 'OBGH-1' })
    await svc.disburse({ fundId: 'f1', cycle: 1 })
    expect(db.payout.create).not.toHaveBeenCalled()
    expect(moolre.transfer).not.toHaveBeenCalled()
  })

  it('does not transfer when the payout is already settled', async () => {
    const { svc, moolre } = disburseDeps({ externalref: 'p:f1:1', status: 'settled', transactionId: 'OBGH-1' })
    await svc.disburse({ fundId: 'f1', cycle: 1 })
    expect(moolre.transfer).not.toHaveBeenCalled()
  })
})

describe('PayoutsService.settle', () => {
  function settleDeps(opts: { totalCycles: number; topPayout?: unknown }) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      payout: { findUnique: jest.fn().mockResolvedValue({ status: 'initiated' }), update: jest.fn().mockResolvedValue({}) },
      activityItem: { create: jest.fn().mockResolvedValue({}) },
      susuDetail: { findUnique: jest.fn().mockResolvedValue({ totalCycles: opts.totalCycles, currentCycle: 1 }), update: jest.fn().mockResolvedValue({}) },
      member: {
        updateMany: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
      },
      fund: { update: jest.fn().mockResolvedValue({}) },
      trustScore: { findUnique: jest.fn().mockResolvedValue({ fundsCompleted: 0 }), update: jest.fn().mockResolvedValue({}) },
    }
    const top = opts.topPayout ?? { externalref: 'p:f1:1', fundId: 'f1', cycle: 1, amount: POT, payeeUserId: 'u1', status: 'initiated' }
    const db = {
      payout: { findUnique: jest.fn().mockResolvedValueOnce(top).mockResolvedValue({ status: 'settled', payeeUserId: 'u1', fundId: 'f1', amount: POT }) },
      user: { findUnique: jest.fn().mockResolvedValue({ phone: '+233240000001', network: 'MTN' }) },
      fund: { findUnique: jest.fn().mockResolvedValue({ name: 'Kumasi Traders' }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    }
    const ledger = {
      getOrCreateAccount: jest.fn().mockImplementation((type: string) => Promise.resolve({ id: type })),
      post: jest.fn().mockResolvedValue(undefined),
    }
    const notifications = { sendSms: jest.fn().mockResolvedValue(undefined) }
    const outbox = { emit: jest.fn().mockResolvedValue(undefined) }
    const svc = new PayoutsService(db as never, {} as never, ledger as never, notifications as never, { register: jest.fn() } as never, outbox as never)
    return { svc, db, tx, ledger, notifications, outbox }
  }

  it('posts a balanced payout and advances the cycle (mid-run)', async () => {
    const { svc, tx, ledger, notifications } = settleDeps({ totalCycles: 3 })
    await svc.settle({ externalref: 'p:f1:1', transactionid: 'OBGH-1' })

    const postings = ledger.post.mock.calls[0][0].postings as Array<{ accountId: string; amount: number }>
    expect(postings.reduce((s, p) => s + p.amount, 0)).toBe(0)
    expect(postings.find((p) => p.accountId === 'fund_pot')!.amount).toBe(POT)
    expect(postings.find((p) => p.accountId === 'moolre_float')!.amount).toBe(-POT)
    expect(tx.susuDetail.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentCycle: 2 } }))
    expect(tx.member.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'pending', paidAt: null } }))
    expect(tx.fund.update).not.toHaveBeenCalled()
    expect(notifications.sendSms).toHaveBeenCalledTimes(1)
  })

  it('completes the fund + bumps trust on the final cycle', async () => {
    const { svc, tx, outbox } = settleDeps({ totalCycles: 1 })
    await svc.settle({ externalref: 'p:f1:1', transactionid: 'OBGH-1' })
    expect(tx.fund.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'completed' } }))
    expect(tx.trustScore.update).toHaveBeenCalledTimes(2)
    expect(outbox.emit).toHaveBeenCalledWith('FundCompleted', { fundId: 'f1' }, expect.anything())
  })

  it('is idempotent: an already-settled payout does not post again', async () => {
    const { svc, db, ledger } = settleDeps({ totalCycles: 3, topPayout: { externalref: 'p:f1:1', fundId: 'f1', cycle: 1, amount: POT, status: 'settled' } })
    await svc.settle({ externalref: 'p:f1:1', transactionid: 'OBGH-1' })
    expect(ledger.post).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
