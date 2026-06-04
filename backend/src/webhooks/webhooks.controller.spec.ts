import { WebhooksController } from './webhooks.controller'
import { UnauthorizedException } from '@nestjs/common'

const mockConfig = (secret = 'my-secret') => ({
  get: (k: string) => (k === 'MOOLRE_WEBHOOK_SECRET' ? secret : undefined),
})

const mockMoolre = (settled = false) => ({
  isSettled: jest.fn().mockResolvedValue(settled),
})

const mockDb = () => ({
  outboxEvent: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  $transaction: jest.fn().mockImplementation((fn: (tx: any) => Promise<any>) =>
    fn({ outboxEvent: { create: jest.fn() } }),
  ),
})

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
})
