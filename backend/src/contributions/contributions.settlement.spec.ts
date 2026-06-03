import { ContributionSettlementService } from './contributions.settlement'

const CONTRIB = {
  externalref: 'c:f1:1:u1',
  fundId: 'f1',
  userId: 'u1',
  cycle: 1,
  amount: 50000,
  fee: 100,
  reference: null,
  status: 'initiated',
  receiptSentAt: null,
}

function makeDeps(contributionStates: unknown[]) {
  const tx = {
    contribution: { findUnique: jest.fn().mockResolvedValue({ ...CONTRIB }), update: jest.fn().mockResolvedValue({}) },
    member: { updateMany: jest.fn().mockResolvedValue({}) },
    activityItem: { create: jest.fn().mockResolvedValue({}) },
  }
  const contributionFind = jest.fn()
  contributionStates.forEach((s) => contributionFind.mockResolvedValueOnce(s))
  const db = {
    contribution: { findUnique: contributionFind, update: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue({ phone: '+233241234567', language: 'en' }) },
    fund: { findUnique: jest.fn().mockResolvedValue({ name: 'Kumasi Traders' }) },
    $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  }
  const ledger = {
    getOrCreateAccount: jest.fn().mockImplementation((type: string) => Promise.resolve({ id: type })),
    post: jest.fn().mockResolvedValue(undefined),
  }
  const notifications = { sendReceipt: jest.fn().mockResolvedValue(undefined) }
  const dispatcher = { register: jest.fn() }
  const svc = new ContributionSettlementService(db as never, ledger as never, notifications as never, dispatcher as never)
  return { svc, db, tx, ledger, notifications, dispatcher }
}

beforeEach(() => jest.clearAllMocks())

describe('ContributionSettlementService', () => {
  it('registers the ContributionSettled handler on init', () => {
    const { svc, dispatcher } = makeDeps([])
    svc.onModuleInit()
    expect(dispatcher.register).toHaveBeenCalledWith('ContributionSettled', expect.any(Function))
  })

  it('settles once: posts a balanced ledger tx, marks member paid, sends a receipt', async () => {
    const settled = { ...CONTRIB, status: 'settled', receiptSentAt: null }
    const { svc, tx, ledger, notifications, db } = makeDeps([{ ...CONTRIB }, settled])
    await svc.settle('c:f1:1:u1', 'TX1')

    // balanced ledger posting
    expect(ledger.post).toHaveBeenCalledTimes(1)
    const postings = ledger.post.mock.calls[0][0].postings as Array<{ accountId: string; amount: number }>
    expect(postings.reduce((s, p) => s + p.amount, 0)).toBe(0)
    expect(postings.find((p) => p.accountId === 'fund_pot')!.amount).toBe(-50000)
    expect(postings.find((p) => p.accountId === 'moolre_float')!.amount).toBe(50100)

    // state + receipt
    expect(tx.contribution.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'settled' }) }))
    expect(tx.member.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }))
    expect(notifications.sendReceipt).toHaveBeenCalledTimes(1)
    expect(db.contribution.update).toHaveBeenCalledWith(expect.objectContaining({ data: { receiptSentAt: expect.any(Date) } }))
  })

  it('is idempotent: an already-settled contribution does not post the ledger again', async () => {
    const settled = { ...CONTRIB, status: 'settled', receiptSentAt: new Date() }
    const { svc, ledger, notifications, db } = makeDeps([settled, settled])
    await svc.settle('c:f1:1:u1', 'TX1')
    expect(ledger.post).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(notifications.sendReceipt).not.toHaveBeenCalled()
  })

  it('does nothing for a failed contribution', async () => {
    const { svc, ledger, db } = makeDeps([{ ...CONTRIB, status: 'failed' }])
    await svc.settle('c:f1:1:u1', null)
    expect(ledger.post).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
