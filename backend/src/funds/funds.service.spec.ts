import { FundsService } from './funds.service'
import { ConfigService } from '@nestjs/config'

const config = { get: () => 'http://localhost:3000' } as unknown as ConfigService
const notifications = { sendSms: jest.fn().mockResolvedValue(undefined) }

function makeSvc(db: unknown) {
  return new FundsService(db as never, notifications as never, config)
}

/** Builds a fund-with-relations result (as returned by `fundInclude`). */
function fund(opts: {
  id?: string
  payoutRule?: string
  requiresDeposit?: boolean
  depositAmount?: number
  memberCount?: number
  currentCycle?: number
  status?: string
  members?: Array<{ userId: string; role?: string; standing?: string; joinedAtMs?: number; status?: string }>
  startedAt?: Date | null
  payoutOrder?: string[] | null
}) {
  const members = (opts.members ?? []).map((m, i) => ({
    userId: m.userId,
    role: m.role ?? 'member',
    fundStatus: 'active',
    status: m.status ?? 'pending',
    depositPaid: false,
    joinedAt: new Date(m.joinedAtMs ?? 1_000 + i),
    user: { name: m.userId.toUpperCase(), trustScore: { standing: m.standing ?? 'good' } },
  }))
  return {
    id: opts.id ?? 'f1',
    name: 'Kumasi Traders',
    type: 'Susu',
    status: opts.status ?? 'active',
    susu: {
      contribution: 50000,
      frequency: 'monthly',
      memberCount: opts.memberCount ?? 6,
      currentCycle: opts.currentCycle ?? 1,
      totalCycles: opts.memberCount ?? 6,
      payoutRule: opts.payoutRule ?? 'rotating',
      requiresDeposit: opts.requiresDeposit ?? false,
      depositAmount: opts.depositAmount ?? 0,
      startedAt: opts.startedAt ?? null,
      payoutOrder: opts.payoutOrder ?? null,
    },
    members,
  }
}

beforeEach(() => jest.clearAllMocks())

describe('FundsService.createSusu', () => {
  it('creates a fund + susu + admin member with totalCycles = memberCount', async () => {
    const created = fund({ memberCount: 4, members: [{ userId: 'u1', role: 'admin' }] })
    const tx = { fund: { create: jest.fn().mockResolvedValue(created) } }
    const db = {
      trustScore: { findUnique: jest.fn().mockResolvedValue({ standing: 'good' }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    }
    const out = await makeSvc(db).createSusu('u1', {
      type: 'Susu',
      name: 'Kumasi Traders',
      contribution: 50000,
      frequency: 'monthly',
      memberCount: 4,
      startDate: new Date(),
      payoutRule: 'rotating',
      requiresDeposit: false,
      depositAmount: 0,
    } as never)

    const arg = tx.fund.create.mock.calls[0][0]
    expect(arg.data.susu.create.totalCycles).toBe(4)
    expect(arg.data.members.create.role).toBe('admin')
    expect(arg.data.members.create.depositPaid).toBe(true) // no deposit required
    expect(out.totalCycles).toBe(4)
    expect(out.potPesewas).toBe(50000 * 4)
  })

  it('rejects a locked user with 403 TRUST_LOCKED and never opens a transaction', async () => {
    const db = {
      trustScore: { findUnique: jest.fn().mockResolvedValue({ standing: 'locked' }) },
      $transaction: jest.fn(),
    }
    await expect(makeSvc(db).createSusu('u1', { memberCount: 3 } as never)).rejects.toMatchObject({
      response: { code: 'TRUST_LOCKED' },
    })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('rejects requiresDeposit until deposit collection is built (400)', async () => {
    const db = {
      trustScore: { findUnique: jest.fn().mockResolvedValue({ standing: 'good' }) },
      $transaction: jest.fn(),
    }
    await expect(
      makeSvc(db).createSusu('u1', { requiresDeposit: true, memberCount: 3 } as never),
    ).rejects.toMatchObject({ response: { code: 'DEPOSIT_NOT_SUPPORTED' } })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('FundsService.acceptInvite', () => {
  const user = { id: 'u2', phone: '+233240000002' }
  function inviteDb(invite: unknown, existingMember: unknown = null) {
    return {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      invite: { findUnique: jest.fn().mockResolvedValue(invite), update: jest.fn().mockResolvedValue({}) },
      member: { findUnique: jest.fn().mockResolvedValue(existingMember) },
    }
  }

  it('rejects an invalid/expired invite token', async () => {
    await expect(makeSvc(inviteDb(null)).acceptInvite('u2', 'tok')).rejects.toMatchObject({
      response: { code: 'INVITE_INVALID' },
    })
  })

  it('rejects when the invite was sent to a different number', async () => {
    const inv = { fundId: 'f1', phone: '+233240000099', status: 'pending' }
    await expect(makeSvc(inviteDb(inv)).acceptInvite('u2', 'tok')).rejects.toMatchObject({
      response: { code: 'INVITE_PHONE_MISMATCH' },
    })
  })

  it('is idempotent when already a member, and marks the invite accepted', async () => {
    const inv = { id: 'i1', fundId: 'f1', phone: '+233240000002', status: 'pending' }
    const db = inviteDb(inv, { userId: 'u2' })
    const out = await makeSvc(db).acceptInvite('u2', 'tok')
    expect(out).toEqual({ status: 'active', fundId: 'f1' })
    expect(db.invite.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { status: 'accepted' } })
  })
})

describe('FundsService.invite', () => {
  const adminFund = () => ({
    id: 'f1',
    name: 'Kumasi Traders',
    susu: { memberCount: 6, currentCycle: 1 },
    createdBy: { name: 'Ama' },
  })

  it('creates invites + sends SMS for the admin, capped by remaining seats', async () => {
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue(adminFund()) },
      member: {
        findUnique: jest.fn().mockResolvedValue({ role: 'admin' }),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      invite: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({ token: 'tok' }) },
    }
    const out = await makeSvc(db).invite('admin', 'f1', {
      phones: ['+233240000001', '+233240000002'],
    } as never)
    expect(out).toEqual({ invited: 2 })
    expect(db.invite.upsert).toHaveBeenCalledTimes(2)
    expect(notifications.sendSms).toHaveBeenCalledTimes(2)
  })

  it('dedupes phones and skips existing members', async () => {
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue(adminFund()) },
      member: {
        findUnique: jest.fn().mockResolvedValue({ role: 'admin' }),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ phone: '+233240000002' }]) },
      invite: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({ token: 'tok' }) },
    }
    const out = await makeSvc(db).invite('admin', 'f1', {
      phones: ['+233240000001', '+233240000001', '+233240000002'],
    } as never)
    expect(out).toEqual({ invited: 1 }) // dup removed, existing member removed
    expect(db.invite.upsert).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-admin with 403 FORBIDDEN', async () => {
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue(adminFund()) },
      member: { findUnique: jest.fn().mockResolvedValue({ role: 'member' }) },
    }
    await expect(
      makeSvc(db).invite('u2', 'f1', { phones: ['+233240000001'] } as never),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('rejects more invites than remaining seats with 400 SEATS_EXCEEDED', async () => {
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue({ ...adminFund(), susu: { memberCount: 2, currentCycle: 1 } }) },
      member: {
        findUnique: jest.fn().mockResolvedValue({ role: 'admin' }),
        count: jest.fn().mockResolvedValue(1), // 1 seat left
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      invite: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    }
    await expect(
      makeSvc(db).invite('admin', 'f1', { phones: ['+233240000001', '+233240000002'] } as never),
    ).rejects.toMatchObject({ response: { code: 'SEATS_EXCEEDED' } })
  })

  it('counts pending invites against capacity (one invite per seat)', async () => {
    // memberCount 3, 1 active member, 2 pending → 0 open seats; a 3rd new phone is rejected.
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue({ ...adminFund(), susu: { memberCount: 3, currentCycle: 1 } }) },
      member: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }), count: jest.fn().mockResolvedValue(1) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      invite: {
        findMany: jest.fn().mockResolvedValue([{ phone: '+233240000001' }, { phone: '+233240000002' }]),
        upsert: jest.fn(),
      },
    }
    await expect(
      makeSvc(db).invite('admin', 'f1', { phones: ['+233240000003'] } as never),
    ).rejects.toMatchObject({ response: { code: 'SEATS_EXCEEDED' } })
  })

  it('lets the admin re-invite an already-pending number without consuming a seat', async () => {
    // memberCount 3, 1 active, 2 pending (full). Re-sending to a pending number is allowed.
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue({ ...adminFund(), susu: { memberCount: 3, currentCycle: 1 } }) },
      member: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }), count: jest.fn().mockResolvedValue(1) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      invite: {
        findMany: jest.fn().mockResolvedValue([{ phone: '+233240000001' }, { phone: '+233240000002' }]),
        upsert: jest.fn().mockResolvedValue({ token: 'tok' }),
      },
    }
    const out = await makeSvc(db).invite('admin', 'f1', { phones: ['+233240000001'] } as never)
    expect(out).toEqual({ invited: 1 })
    expect(db.invite.upsert).toHaveBeenCalledTimes(1)
  })

  it('frees a seat once a pending invite is gone (decline/revoke) so a replacement can be invited', async () => {
    // memberCount 3, 1 active, only 1 pending now (the other declined) → 1 open seat.
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue({ ...adminFund(), susu: { memberCount: 3, currentCycle: 1 } }) },
      member: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }), count: jest.fn().mockResolvedValue(1) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      invite: {
        findMany: jest.fn().mockResolvedValue([{ phone: '+233240000001' }]),
        upsert: jest.fn().mockResolvedValue({ token: 'tok' }),
      },
    }
    const out = await makeSvc(db).invite('admin', 'f1', { phones: ['+233240000009'] } as never)
    expect(out).toEqual({ invited: 1 })
    expect(db.invite.upsert).toHaveBeenCalledTimes(1)
  })
})

describe('FundsService.join', () => {
  function joinDb(txFund: ReturnType<typeof fund>, opts: { existing?: unknown; activeCount?: number; user?: unknown } = {}) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      fund: { findUnique: jest.fn().mockResolvedValue(txFund) },
      member: {
        findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
        count: jest.fn().mockResolvedValue(opts.activeCount ?? 0),
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue(txFund.members),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      invite: { updateMany: jest.fn().mockResolvedValue({}) },
      susuDetail: { update: jest.fn().mockResolvedValue({}) },
    }
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.user ?? { id: 'u2', phone: '+233240000002', trustScore: { standing: 'good' } }),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    }
    return { db, tx }
  }

  it('joins active immediately when no deposit is required', async () => {
    const { db, tx } = joinDb(fund({ requiresDeposit: false, memberCount: 5 }), { activeCount: 2 })
    const out = await makeSvc(db).join('u2', 'f1')
    expect(out).toEqual({ status: 'active' })
    expect(tx.member.create).toHaveBeenCalled()
    expect(tx.$queryRaw).toHaveBeenCalled() // row lock taken
  })

  it('starts the Susu when the join fills it: locks payoutOrder + startedAt', async () => {
    const f = fund({
      memberCount: 2,
      payoutRule: 'rotating',
      members: [
        { userId: 'u1', role: 'admin', joinedAtMs: 100 },
        { userId: 'u2', joinedAtMs: 200 },
      ],
    })
    const { db, tx } = joinDb(f, { activeCount: 1 }) // this join makes it 2/2
    const out = await makeSvc(db).join('u2', 'f1')
    expect(out).toEqual({ status: 'active' })
    expect(tx.susuDetail.update).toHaveBeenCalledTimes(1)
    const data = tx.susuDetail.update.mock.calls[0][0].data
    expect(data.startedAt).toBeInstanceOf(Date)
    expect(data.payoutOrder).toEqual(['u1', 'u2'])
  })

  it('returns pending_deposit when a deposit is required (collection deferred to E4)', async () => {
    const { db } = joinDb(fund({ requiresDeposit: true, depositAmount: 20000, memberCount: 5 }), { activeCount: 1 })
    const out = await makeSvc(db).join('u2', 'f1')
    expect(out).toEqual({ status: 'pending_deposit', depositAmount: 20000 })
  })

  it('rejects when the Susu is full with 409 FUND_FULL', async () => {
    const { db } = joinDb(fund({ memberCount: 3 }), { activeCount: 3 })
    await expect(makeSvc(db).join('u2', 'f1')).rejects.toMatchObject({ response: { code: 'FUND_FULL' } })
  })

  it('rejects a duplicate join with 409 ALREADY_MEMBER', async () => {
    const { db } = joinDb(fund({ memberCount: 5 }), { existing: { userId: 'u2' }, activeCount: 2 })
    await expect(makeSvc(db).join('u2', 'f1')).rejects.toMatchObject({ response: { code: 'ALREADY_MEMBER' } })
  })

  it('rejects a locked user with 403 TRUST_LOCKED before opening a transaction', async () => {
    const { db } = joinDb(fund({}), { user: { id: 'u2', phone: '+233240000002', trustScore: { standing: 'locked' } } })
    await expect(makeSvc(db).join('u2', 'f1')).rejects.toMatchObject({ response: { code: 'TRUST_LOCKED' } })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('FundsService.detail', () => {
  it('orders payout by join time for rotating', async () => {
    const f = fund({
      payoutRule: 'rotating',
      members: [
        { userId: 'c', joinedAtMs: 300 },
        { userId: 'a', joinedAtMs: 100 },
        { userId: 'b', joinedAtMs: 200 },
      ],
    })
    const db = { fund: { findUnique: jest.fn().mockResolvedValue(f) }, payout: { findUnique: jest.fn().mockResolvedValue(null) }, invite: { count: jest.fn().mockResolvedValue(0) } }
    const out = await makeSvc(db).detail('a', 'f1')
    expect(out.payoutOrder).toEqual(['a', 'b', 'c'])
    expect(out.members.find((m) => m.userId === 'a')!.payoutPosition).toBe(1)
    expect(out.openSeats).toBe(3) // memberCount 6 − 3 members − 0 pending
  })

  it('orders payout safest-first for trust_ordered', async () => {
    const f = fund({
      payoutRule: 'trust_ordered',
      members: [
        { userId: 'risky', standing: 'building', joinedAtMs: 100 },
        { userId: 'safe', standing: 'excellent', joinedAtMs: 200 },
        { userId: 'mid', standing: 'good', joinedAtMs: 300 },
      ],
    })
    const db = { fund: { findUnique: jest.fn().mockResolvedValue(f) }, payout: { findUnique: jest.fn().mockResolvedValue(null) }, invite: { count: jest.fn().mockResolvedValue(0) } }
    const out = await makeSvc(db).detail('safe', 'f1')
    expect(out.payoutOrder).toEqual(['safe', 'mid', 'risky'])
  })

  it('rejects a non-member with 403 FORBIDDEN', async () => {
    const f = fund({ members: [{ userId: 'a' }] })
    const db = { fund: { findUnique: jest.fn().mockResolvedValue(f) } }
    await expect(makeSvc(db).detail('stranger', 'f1')).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    })
  })
})

describe('FundsService invite management', () => {
  const adminFund = { id: 'f1', name: 'Kumasi Traders', susu: { memberCount: 3, currentCycle: 1, startedAt: null }, createdBy: { name: 'Ama' } }
  function db(over: Record<string, unknown> = {}) {
    return {
      fund: { findUnique: jest.fn().mockResolvedValue(adminFund) },
      member: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
      ...over,
    }
  }

  it('lists invites with shareable join URLs (admin)', async () => {
    const d = db({
      invite: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', phone: '+233240000002', status: 'pending', token: 'tok1', createdAt: new Date() }]) },
    })
    const out = await makeSvc(d).listInvites('admin', 'f1')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'i1', phone: '+233240000002', status: 'pending', joinUrl: 'http://localhost:3000/join/tok1' })
  })

  it('rejects listInvites for a non-admin (403)', async () => {
    const d = db({ member: { findUnique: jest.fn().mockResolvedValue({ role: 'member' }) } })
    await expect(makeSvc(d).listInvites('u2', 'f1')).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('resends a pending invite (sends SMS)', async () => {
    const d = db({
      invite: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', fundId: 'f1', phone: '+233240000002', token: 'tok1', status: 'pending' }) },
    })
    const out = await makeSvc(d).resendInvite('admin', 'f1', 'i1')
    expect(out).toEqual({ ok: true })
    expect(notifications.sendSms).toHaveBeenCalled()
  })

  it('rejects resending an invite that is not pending (400)', async () => {
    const d = db({
      invite: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', fundId: 'f1', status: 'accepted' }) },
    })
    await expect(makeSvc(d).resendInvite('admin', 'f1', 'i1')).rejects.toMatchObject({ response: { code: 'INVITE_NOT_PENDING' } })
  })

  it('revokes an invite (status → expired)', async () => {
    const update = jest.fn().mockResolvedValue({})
    const d = db({
      invite: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', fundId: 'f1', status: 'pending' }), update },
    })
    const out = await makeSvc(d).revokeInvite('admin', 'f1', 'i1')
    expect(out).toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'expired' } }))
  })
})

describe('FundsService incoming invites (invitee side)', () => {
  const user = { id: 'u2', phone: '+233240000002' }

  function inviteFund(over: Partial<{ status: string; startedAt: Date | null; members: { userId: string }[] }> = {}) {
    return {
      id: 'f1',
      name: 'Kumasi Traders',
      status: over.status ?? 'active',
      susu: {
        contribution: 50000,
        frequency: 'monthly',
        memberCount: 6,
        payoutRule: 'rotating',
        startedAt: over.startedAt ?? null,
      },
      createdBy: { name: 'Ama' },
      members: over.members ?? [{ userId: 'admin' }],
    }
  }

  it('returns pending invites addressed to my phone with fund + seat info', async () => {
    const d = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      invite: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'i1', token: 'tok1', createdAt: new Date(), fund: inviteFund() },
        ]),
      },
    }
    const out = await makeSvc(d).myInvites('u2')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'i1', token: 'tok1', fundId: 'f1', fundName: 'Kumasi Traders',
      contribution: 50000, memberCount: 6, seatsLeft: 5, inviterName: 'Ama',
    })
  })

  it('hides invites for started funds and ones I already joined', async () => {
    const d = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      invite: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'i1', token: 't1', createdAt: new Date(), fund: inviteFund({ startedAt: new Date() }) },
          { id: 'i2', token: 't2', createdAt: new Date(), fund: inviteFund({ members: [{ userId: 'u2' }] }) },
        ]),
      },
    }
    const out = await makeSvc(d).myInvites('u2')
    expect(out).toHaveLength(0)
  })

  it('declines an invite addressed to me (status → declined)', async () => {
    const update = jest.fn().mockResolvedValue({})
    const d = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      invite: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', phone: '+233240000002', status: 'pending' }), update },
    }
    const out = await makeSvc(d).declineInvite('u2', 'i1')
    expect(out).toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { status: 'declined' } })
  })

  it('rejects declining an invite sent to a different number (403)', async () => {
    const d = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      invite: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', phone: '+233240000099', status: 'pending' }), update: jest.fn() },
    }
    await expect(makeSvc(d).declineInvite('u2', 'i1')).rejects.toMatchObject({ response: { code: 'INVITE_PHONE_MISMATCH' } })
  })
})
