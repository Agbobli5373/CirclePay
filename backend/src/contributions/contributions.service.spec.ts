import { ContributionsService } from './contributions.service'
import { ConfigService } from '@nestjs/config'
import { MoolreError } from '../moolre/moolre.client'

const config = { get: () => undefined } as unknown as ConfigService

function baseDb(over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', phone: '+233241234567', network: 'MTN', language: 'en' }) },
    member: { findUnique: jest.fn().mockResolvedValue({ fundStatus: 'active' }) },
    fund: { findUnique: jest.fn().mockResolvedValue({ status: 'active', susu: { currentCycle: 1, contribution: 50000 } }) },
    contribution: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    ...over,
  }
}

function makeSvc(db: unknown, moolre: unknown) {
  return new ContributionsService(db as never, moolre as never, config)
}

beforeEach(() => jest.clearAllMocks())

describe('ContributionsService.initiate', () => {
  it('requires an Idempotency-Key header', async () => {
    const svc = makeSvc(baseDb(), { collect: jest.fn() })
    await expect(svc.initiate('u1', { fundId: 'f1' } as never, undefined)).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REQUIRED' },
    })
  })

  it('replays a stored terminal response on duplicate key', async () => {
    const db = baseDb()
    db.idempotencyKey.findUnique = jest.fn().mockResolvedValue({ statusCode: 202, response: { state: 'initiated', externalref: 'c:f1:1:u1' } })
    const moolre = { collect: jest.fn() }
    const out = await makeSvc(db, moolre).initiate('u1', { fundId: 'f1' } as never, 'key1')
    expect(out).toEqual({ statusCode: 202, body: { state: 'initiated', externalref: 'c:f1:1:u1' } })
    expect(moolre.collect).not.toHaveBeenCalled()
  })

  it('initiates (TR099) → 202 initiated, stores idempotency + a Contribution', async () => {
    const db = baseDb()
    const moolre = { collect: jest.fn().mockResolvedValue({ otpRequired: false, raw: { data: { transactionid: 'TX1' } } }) }
    const out = await makeSvc(db, moolre).initiate('u1', { fundId: 'f1' } as never, 'key1')
    expect(out.statusCode).toBe(202)
    expect(out.body).toMatchObject({ state: 'initiated', externalref: 'c:f1:1:u1', amount: 50000, total: 50000 })
    expect(db.contribution.upsert).toHaveBeenCalled()
    expect(db.idempotencyKey.create).toHaveBeenCalled()
    expect(moolre.collect).toHaveBeenCalledWith(
      expect.objectContaining({ channel: '13', payer: '233241234567', amount: '500.00', externalref: 'c:f1:1:u1' }),
    )
  })

  it('returns otp_required (200) and does NOT store idempotency (client must resubmit)', async () => {
    const db = baseDb()
    const moolre = { collect: jest.fn().mockResolvedValue({ otpRequired: true, raw: { data: {} } }) }
    const out = await makeSvc(db, moolre).initiate('u1', { fundId: 'f1' } as never, 'key1')
    expect(out).toMatchObject({ statusCode: 200, body: { state: 'otp_required' } })
    expect(db.idempotencyKey.create).not.toHaveBeenCalled()
  })

  it('short-circuits to settled when the contribution already settled', async () => {
    const db = baseDb()
    db.contribution.findUnique = jest.fn().mockResolvedValue({ status: 'settled' })
    const moolre = { collect: jest.fn() }
    const out = await makeSvc(db, moolre).initiate('u1', { fundId: 'f1' } as never, 'key1')
    expect(out).toMatchObject({ statusCode: 200, body: { state: 'settled' } })
    expect(moolre.collect).not.toHaveBeenCalled()
  })

  it('resolves a duplicate externalref (TP13) via status instead of double-charging', async () => {
    const db = baseDb()
    const moolre = {
      collect: jest.fn().mockRejectedValue(new MoolreError('dup', 'TP13', {} as never)),
      isSettled: jest.fn().mockResolvedValue(true),
    }
    const out = await makeSvc(db, moolre).initiate('u1', { fundId: 'f1' } as never, 'key1')
    expect(out).toMatchObject({ statusCode: 202, body: { state: 'settled' } })
    expect(moolre.isSettled).toHaveBeenCalledWith('c:f1:1:u1')
  })

  it('rejects a non-member with 403 NOT_MEMBER', async () => {
    const db = baseDb()
    db.member.findUnique = jest.fn().mockResolvedValue(null)
    await expect(makeSvc(db, { collect: jest.fn() }).initiate('u1', { fundId: 'f1' } as never, 'key1')).rejects.toMatchObject({
      response: { code: 'NOT_MEMBER' },
    })
  })
})
