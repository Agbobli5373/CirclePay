import { FundraisersService } from './fundraisers.service'

const dispatcher = { register: jest.fn() }
const notifications = { sendSms: jest.fn().mockResolvedValue(undefined) }
const config = { get: jest.fn().mockReturnValue('http://localhost:3000') }

function ledgerMock() {
  return {
    getOrCreateAccount: jest.fn((type: string, owner?: string) => Promise.resolve({ id: `${type}:${owner ?? 'G'}` })),
    post: jest.fn().mockResolvedValue(undefined),
  }
}
function moolreMock(over: Record<string, unknown> = {}) {
  return {
    collect: jest.fn(),
    transfer: jest.fn().mockResolvedValue({ data: { transactionid: 'MOCK-1' } }),
    getBalance: jest.fn().mockResolvedValue({ data: { balance: 1_000_000 } }),
    isSettled: jest.fn().mockResolvedValue(false),
    ...over,
  }
}
function makeSvc(db: unknown, moolre = moolreMock(), ledger = ledgerMock()) {
  return {
    svc: new FundraisersService(db as never, moolre as never, ledger as never, notifications as never, dispatcher as never, config as never),
    moolre,
    ledger,
  }
}

beforeEach(() => jest.clearAllMocks())

describe('FundraisersService.createMedical', () => {
  it('creates a Medical fund + fundraiser with a slug', async () => {
    const created = { id: 'f1', name: 'Help Kofi', status: 'active', createdById: 'u1', fundraiser: { slug: 'help-kofi-abc', beneficiary: 'Kofi', hospital: null, story: 's', goal: 500000, raised: 0, deadline: null, payoutRoute: 'hospital_bank', verificationStatus: 'unverified', payeeName: 'Korle Bu' } }
    const db = { fund: { create: jest.fn().mockResolvedValue(created) } }
    const { svc } = makeSvc(db)
    const out = await svc.createMedical('u1', {
      type: 'Medical', name: 'Help Kofi', goal: 500000, beneficiary: 'Kofi', story: 's',
      payoutRoute: 'hospital_bank', payee: { name: 'Korle Bu', bank: '12345' }, shareable: true,
    } as never)
    const arg = db.fund.create.mock.calls[0][0]
    expect(arg.data.type).toBe('Medical')
    expect(arg.data.fundraiser.create.verificationStatus).toBe('unverified')
    expect(out.isOwner).toBe(true)
    expect(out.slug).toBe('help-kofi-abc')
  })
})

describe('FundraisersService.donate', () => {
  const fr = { fundId: 'f1', fund: { status: 'active' } }
  function db(over: Record<string, unknown> = {}) {
    return {
      fundraiserDetail: { findUnique: jest.fn().mockResolvedValue(fr) },
      contributor: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
      ...over,
    }
  }
  const base = { donationId: 'd1', phone: '+233240000001', network: 'MTN', amount: 5000, anonymous: false }

  it('returns otp_required when Moolre asks for an OTP (no settle yet)', async () => {
    const moolre = moolreMock({ collect: jest.fn().mockResolvedValue({ otpRequired: true, raw: { code: 'TP14' } }) })
    const { svc } = makeSvc(db(), moolre)
    const out = await svc.donate('slug', base as never)
    expect(out.state).toBe('otp_required')
    expect(out.externalref).toBe('mc:f1:d1')
  })

  it('initiates the collection when an OTP code is supplied', async () => {
    const moolre = moolreMock({ collect: jest.fn().mockResolvedValue({ otpRequired: false, raw: { code: 'TR099', data: { transactionid: 'X' } } }) })
    const { svc } = makeSvc(db(), moolre)
    const out = await svc.donate('slug', { ...base, otpcode: '000000' } as never)
    expect(out.state).toBe('initiated')
  })

  it('is idempotent when the donation already settled', async () => {
    const { svc } = makeSvc(db({ contributor: { findUnique: jest.fn().mockResolvedValue({ status: 'settled', amount: 5000 }) } }))
    const out = await svc.donate('slug', base as never)
    expect(out.state).toBe('settled')
  })
})

describe('FundraisersService.verifyPayee', () => {
  it('rejects a non-ops user with 403', async () => {
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ isOpsAdmin: false }) } }
    const { svc } = makeSvc(db)
    await expect(svc.verifyPayee('u2', 'f1', { decision: 'verified' } as never)).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('sets verificationStatus for an ops admin', async () => {
    const update = jest.fn().mockResolvedValue({})
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ isOpsAdmin: true }) },
      fundraiserDetail: { findUnique: jest.fn().mockResolvedValue({ fundId: 'f1' }), update },
    }
    const { svc } = makeSvc(db)
    const out = await svc.verifyPayee('ops', 'f1', { decision: 'verified' } as never)
    expect(out).toEqual({ ok: true, verificationStatus: 'verified' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { verificationStatus: 'verified' } }))
  })
})

describe('FundraisersService.release', () => {
  function fund(over: Record<string, unknown> = {}) {
    return { id: 'f1', createdById: 'u1', fundraiser: { verificationStatus: 'verified', raised: 100000, payoutRoute: 'hospital_bank', payeeBank: 'ACC', payeeMomo: null }, ...over }
  }
  function db(f: unknown, tranche: unknown = null) {
    return {
      fund: { findUnique: jest.fn().mockResolvedValue(f) },
      payoutTranche: { findUnique: jest.fn().mockResolvedValue(tranche), create: jest.fn().mockResolvedValue({ amount: 100000 }), update: jest.fn().mockResolvedValue({}) },
    }
  }

  it('rejects a non-organizer with 403', async () => {
    const { svc } = makeSvc(db(fund()))
    await expect(svc.release('someoneelse', 'f1')).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('blocks payout until the payee is verified (409)', async () => {
    const { svc } = makeSvc(db(fund({ fundraiser: { verificationStatus: 'pending', raised: 100000, payoutRoute: 'hospital_bank', payeeBank: 'ACC' } })))
    await expect(svc.release('u1', 'f1')).rejects.toMatchObject({ response: { code: 'PAYEE_UNVERIFIED' } })
  })

  it('releases an individual MoMo payout WITHOUT ops verification', async () => {
    const d = db(
      fund({
        fundraiser: {
          verificationStatus: 'unverified',
          raised: 100000,
          payoutRoute: 'individual_cash',
          payeeMomo: '+233240000002',
          payeeNetwork: 'Telecel',
          payeeBank: null,
        },
      }),
    )
    const { svc, moolre } = makeSvc(d)
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ ok: true, externalref: 'mp:f1:1', amount: 100000 })
    expect(moolre.transfer).toHaveBeenCalledWith(expect.objectContaining({ channel: '6', receiver: '233240000002' })) // Telecel
  })

  it('transfers and marks the tranche released when verified', async () => {
    const d = db(fund())
    const { svc, moolre } = makeSvc(d)
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ ok: true, externalref: 'mp:f1:1', amount: 100000 })
    expect(moolre.transfer).toHaveBeenCalled()
    expect(d.payoutTranche.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'released' } }))
  })

  it('is idempotent when the tranche is already released', async () => {
    const { svc, moolre } = makeSvc(db(fund(), { status: 'released', amount: 100000 }))
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ ok: true, amount: 100000 })
    expect(moolre.transfer).not.toHaveBeenCalled()
  })
})

describe('FundraisersService settlement handlers', () => {
  it('settleDonation posts a balanced ledger txn, marks settled, bumps raised', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      contributor: { findUnique: jest.fn().mockResolvedValue({ status: 'initiated' }), update: jest.fn().mockResolvedValue({}) },
      fundraiserDetail: { update: jest.fn().mockResolvedValue({}) },
      activityItem: { create: jest.fn().mockResolvedValue({}) },
    }
    const db = {
      contributor: { findUnique: jest.fn().mockResolvedValue({ externalref: 'mc:f1:d1', fundId: 'f1', amount: 5000, anonymous: false, displayName: 'Ama' }) },
      fund: { findUnique: jest.fn().mockResolvedValue({ createdById: 'u1' }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    }
    const { svc, ledger } = makeSvc(db)
    await svc.settleDonation('mc:f1:d1')
    const postings = ledger.post.mock.calls[0][0].postings as Array<{ amount: number }>
    expect(postings.reduce((s, p) => s + p.amount, 0)).toBe(0)
    expect(tx.contributor.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'settled' } }))
    expect(tx.fundraiserDetail.update).toHaveBeenCalledWith(expect.objectContaining({ data: { raised: { increment: 5000 } } }))
  })

  it('settleMedicalPayout posts balanced ledger, settles the tranche, completes the fund', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      payoutTranche: { findUnique: jest.fn().mockResolvedValue({ status: 'released' }), update: jest.fn().mockResolvedValue({}) },
      fund: { update: jest.fn().mockResolvedValue({ createdById: 'u1' }) },
      activityItem: { create: jest.fn().mockResolvedValue({}) },
    }
    const db = {
      payoutTranche: { findUnique: jest.fn().mockResolvedValue({ externalref: 'mp:f1:1', fundId: 'f1', amount: 100000, status: 'released' }) },
      fundraiserDetail: { findUnique: jest.fn().mockResolvedValue({ payeeMomo: null }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    }
    const { svc, ledger } = makeSvc(db)
    await svc.settleMedicalPayout('mp:f1:1')
    const postings = ledger.post.mock.calls[0][0].postings as Array<{ amount: number }>
    expect(postings.reduce((s, p) => s + p.amount, 0)).toBe(0)
    expect(tx.fund.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'completed' } }))
  })
})

describe('FundraisersService.thankContributors', () => {
  const fund = { id: 'f1', createdById: 'u1', status: 'active', fundraiser: { slug: 's', beneficiary: 'Kofi' }, createdBy: { name: 'Ama' } }
  it('sends one SMS per distinct contributor phone and marks them thanked', async () => {
    const updateMany = jest.fn().mockResolvedValue({})
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue(fund) },
      contributor: {
        findMany: jest.fn().mockResolvedValue([{ phone: '+233240000001' }, { phone: '+233240000001' }, { phone: '+233240000002' }]),
        updateMany,
      },
    }
    const { svc } = makeSvc(db)
    const out = await svc.thankContributors('u1', 'f1', {} as never)
    expect(out).toEqual({ sent: 2 }) // two distinct phones
    expect(notifications.sendSms).toHaveBeenCalledTimes(2)
    expect(updateMany).toHaveBeenCalledTimes(2)
  })
})

describe('FundraisersService.remindInvite', () => {
  const fund = { id: 'f1', createdById: 'u1', status: 'active', fundraiser: { slug: 's', beneficiary: 'Kofi' }, createdBy: { name: 'Ama' } }
  it('refuses to remind someone who already contributed (409)', async () => {
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue(fund) },
      fundraiserInvite: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', fundId: 'f1', phone: '+233240000001', lastRemindedAt: null }) },
      contributor: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) },
    }
    const { svc } = makeSvc(db)
    await expect(svc.remindInvite('u1', 'f1', 'i1')).rejects.toMatchObject({ response: { code: 'ALREADY_CONTRIBUTED' } })
  })
})
