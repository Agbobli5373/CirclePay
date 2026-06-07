import { WebhooksController } from './webhooks.controller'
import { UnauthorizedException } from '@nestjs/common'

const mockConfig = (secret = 'my-secret') => ({
  get: (k: string) => (k === 'MOOLRE_WEBHOOK_SECRET' ? secret : undefined),
})

const mockMoolre = (settled = false) => ({
  isSettled: jest.fn().mockResolvedValue(settled),
})

const mockDb = () => {
  const create = jest.fn()
  return {
    create, // the inner outboxEvent.create invoked inside $transaction (exposed for assertions)
    outboxEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((fn: (tx: any) => Promise<any>) => fn({ outboxEvent: { create } })),
  }
}

const mockDispatcher = () => ({})

describe('WebhooksController', () => {
  it('rejects a wrong secret with 401', async () => {
    const ctrl = new WebhooksController(
      mockConfig('correct') as any,
      mockMoolre() as any,
      mockDispatcher() as any,
      mockDb() as any,
    )
    await expect(ctrl.handleMoolre('wrong', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('acks silently when externalref is absent', async () => {
    const ctrl = new WebhooksController(
      mockConfig() as any,
      mockMoolre() as any,
      mockDispatcher() as any,
      mockDb() as any,
    )
    const result = await ctrl.handleMoolre('my-secret', {})
    expect(result).toEqual({ ok: true })
  })

  it('acks without emitting when Moolre reports not settled', async () => {
    const db = mockDb()
    const ctrl = new WebhooksController(
      mockConfig() as any,
      mockMoolre(false) as any,
      mockDispatcher() as any,
      db as any,
    )
    const result = await ctrl.handleMoolre('my-secret', {
      data: { externalref: 'c:fund:1:user' },
    })
    expect(result).toEqual({ ok: true })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('emits ContributionSettled when settled and externalref starts with c:', async () => {
    const db = mockDb()
    const ctrl = new WebhooksController(
      mockConfig() as any,
      mockMoolre(true) as any,
      mockDispatcher() as any,
      db as any,
    )
    const result = await ctrl.handleMoolre('my-secret', {
      data: { externalref: 'c:kumasi-traders:3:ama' },
    })
    expect(result).toEqual({ ok: true })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — skips emit when already queued', async () => {
    const db = mockDb()
    db.outboxEvent.findFirst = jest.fn().mockResolvedValue({ id: 'existing' })
    const ctrl = new WebhooksController(
      mockConfig() as any,
      mockMoolre(true) as any,
      mockDispatcher() as any,
      db as any,
    )
    const result = await ctrl.handleMoolre('my-secret', {
      data: { externalref: 'c:kumasi-traders:3:ama' },
    })
    expect(result).toEqual({ ok: true })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  // ----- doc-driven fixtures: the real Moolre P01 payload shape + externalref routing -----

  it('handles the full documented P01 payload and queues ContributionSettled with its fields', async () => {
    const db = mockDb()
    const ctrl = new WebhooksController(mockConfig() as any, mockMoolre(true) as any, mockDispatcher() as any, db as any)
    // Cast as any: a real Moolre callback carries extra fields (accountnumber, ts, …) the
    // handler must tolerate but the typed body doesn't enumerate.
    const result = await ctrl.handleMoolre('my-secret', {
      status: 1,
      code: 'P01',
      message: 'Transaction Successful',
      data: { txstatus: 1, txtype: 1, accountnumber: '100000100002', payer: '0209151872', amount: '50', transactionid: '31772290', externalref: 'c:kumasi:2:ama', ts: '2023-11-21 03:57:25' },
    } as any)
    expect(result).toEqual({ ok: true })
    expect(db.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ContributionSettled',
          payload: expect.objectContaining({ externalref: 'c:kumasi:2:ama', transactionid: '31772290', amount: '50' }),
        }),
      }),
    )
  })

  it.each([
    ['d:f1:u1', 'DepositSettled'],
    ['p:f1:1', 'PayoutSettled'],
    ['mp:f1:1', 'MedicalPayoutSettled'],
    ['mc:f1:42', 'DonationSettled'],
  ])('routes externalref %s → %s', async (externalref, type) => {
    const db = mockDb()
    const ctrl = new WebhooksController(mockConfig() as any, mockMoolre(true) as any, mockDispatcher() as any, db as any)
    await ctrl.handleMoolre('my-secret', { code: 'P01', data: { txstatus: 1, externalref, transactionid: 'tx1' } })
    expect(db.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type }) }))
  })

  it('acks an unknown externalref scheme without emitting', async () => {
    const db = mockDb()
    const ctrl = new WebhooksController(mockConfig() as any, mockMoolre(true) as any, mockDispatcher() as any, db as any)
    const result = await ctrl.handleMoolre('my-secret', { code: 'P01', data: { txstatus: 1, externalref: 'zzz:f1:1', transactionid: 'tx1' } })
    expect(result).toEqual({ ok: true })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
