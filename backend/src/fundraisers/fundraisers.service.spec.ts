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
  function db(f: unknown, opts: { raised?: number; tranches?: Array<{ amount: number; status: string }> } = {}) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      fundraiserDetail: { findUnique: jest.fn().mockResolvedValue({ raised: opts.raised ?? 100000 }) },
      payoutTranche: { findMany: jest.fn().mockResolvedValue(opts.tranches ?? []), create: jest.fn().mockResolvedValue({}) },
    }
    return {
      fund: { findUnique: jest.fn().mockResolvedValue(f) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
      payoutTranche: { update: jest.fn().mockResolvedValue({}) },
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
    const d = db(fund({ fundraiser: { verificationStatus: 'unverified', raised: 100000, payoutRoute: 'individual_cash', payeeMomo: '+233240000002', payeeNetwork: 'Telecel', payeeBank: null } }))
    const { svc, moolre } = makeSvc(d)
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ ok: true, externalref: 'mp:f1:1', amount: 100000 })
    expect(moolre.transfer).toHaveBeenCalledWith(expect.objectContaining({ channel: '6', receiver: '233240000002' })) // Telecel
  })

  it('transfers the full balance and marks the tranche released', async () => {
    const d = db(fund())
    const { svc, moolre } = makeSvc(d)
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ ok: true, externalref: 'mp:f1:1', amount: 100000 })
    expect(moolre.transfer).toHaveBeenCalled()
    expect(d.payoutTranche.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'released' } }))
  })

  it('releases only the new balance as the next tranche (repeat release)', async () => {
    const d = db(fund(), { raised: 100000, tranches: [{ amount: 40000, status: 'settled' }] })
    const { svc, moolre } = makeSvc(d)
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ ok: true, externalref: 'mp:f1:2', amount: 60000 }) // 100000 − 40000
    expect(moolre.transfer).toHaveBeenCalledWith(expect.objectContaining({ amount: '600.00' }))
  })

  it('refuses to release when everything raised is already paid out (409)', async () => {
    const d = db(fund(), { raised: 100000, tranches: [{ amount: 100000, status: 'released' }] })
    const { svc, moolre } = makeSvc(d)
    await expect(svc.release('u1', 'f1')).rejects.toMatchObject({ response: { code: 'NOTHING_TO_RELEASE' } })
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

  it('settleMedicalPayout posts balanced ledger + settles the tranche, but does NOT complete the fund', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      payoutTranche: { findUnique: jest.fn().mockResolvedValue({ status: 'released' }), update: jest.fn().mockResolvedValue({}) },
      fund: { findUnique: jest.fn().mockResolvedValue({ createdById: 'u1' }), update: jest.fn() },
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
    expect(tx.payoutTranche.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'settled' }) }))
    expect(tx.fund.update).not.toHaveBeenCalled() // releasing a tranche no longer closes the fund
  })
})

describe('FundraisersService.closeFundraiser', () => {
  it('marks the fund completed (organizer only)', async () => {
    const update = jest.fn().mockResolvedValue({})
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', createdById: 'u1', status: 'active', fundraiser: { slug: 's' }, createdBy: { name: 'Ama' } }), update },
    }
    const { svc } = makeSvc(db)
    const out = await svc.closeFundraiser('u1', 'f1')
    expect(out).toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'completed' } }))
  })

  it('rejects a non-organizer with 403', async () => {
    const db = { fund: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', createdById: 'u1', fundraiser: { slug: 's' }, createdBy: { name: 'Ama' } }), update: jest.fn() } }
    const { svc } = makeSvc(db)
    await expect(svc.closeFundraiser('intruder', 'f1')).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
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

describe('FundraisersService receipts (E7-S3)', () => {
  it('uploadReceipt: organizer attaches a submitted receipt for a tranche', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'r1', trancheId: 't1', kind: 'receipt', status: 'submitted', docUrl: 'https://x/y.jpg', ts: new Date() })
    const db = {
      fund: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', createdById: 'u1', fundraiser: { slug: 's' }, createdBy: { name: 'Ama' } }) },
      payoutTranche: { findUnique: jest.fn().mockResolvedValue({ id: 't1', fundId: 'f1' }) },
      receipt: { create },
    }
    const { svc } = makeSvc(db)
    const out = await svc.uploadReceipt('u1', 'f1', { trancheId: 't1', kind: 'receipt', docUrl: 'https://x/y.jpg' } as never)
    expect(out).toMatchObject({ id: 'r1', status: 'submitted' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fundId: 'f1', trancheId: 't1', uploadedBy: 'u1', status: 'submitted' }) }))
  })

  it('uploadReceipt: rejects a non-organizer (403)', async () => {
    const db = { fund: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', createdById: 'u1', fundraiser: { slug: 's' }, createdBy: { name: 'A' } }) } }
    const { svc } = makeSvc(db)
    await expect(
      svc.uploadReceipt('intruder', 'f1', { trancheId: 't1', kind: 'receipt', docUrl: 'https://x' } as never),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('verifyReceipt: rejects a non-ops user (403)', async () => {
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ isOpsAdmin: false }) } }
    const { svc } = makeSvc(db)
    await expect(svc.verifyReceipt('u2', 'f1', 'r1', { decision: 'verified' } as never)).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('verifyReceipt: ops flips a receipt to verified', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'r1', trancheId: 't1', kind: 'receipt', status: 'verified', docUrl: 'https://x', ts: new Date() })
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ isOpsAdmin: true }) },
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', fundId: 'f1' }), update },
      fund: { findUnique: jest.fn().mockResolvedValue({ fundraiser: { beneficiary: 'Kofi' }, createdBy: { phone: null } }) },
    }
    const { svc } = makeSvc(db)
    const out = await svc.verifyReceipt('ops', 'f1', 'r1', { decision: 'verified' } as never)
    expect(out).toMatchObject({ status: 'verified' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'verified', verifiedBy: 'ops' } }))
  })
})

describe('FundraisersService.release — receipt gate + caps', () => {
  function gatedDb(opts: { raised?: number; tranches?: Array<Record<string, unknown>>; receipts?: Array<Record<string, unknown>> }) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      fundraiserDetail: { findUnique: jest.fn().mockResolvedValue({ raised: opts.raised ?? 100000 }) },
      payoutTranche: { findMany: jest.fn().mockResolvedValue(opts.tranches ?? []), create: jest.fn().mockResolvedValue({}) },
      receipt: { findMany: jest.fn().mockResolvedValue(opts.receipts ?? []) },
    }
    return {
      fund: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'f1',
          createdById: 'u1',
          fundraiser: { verificationStatus: 'unverified', raised: opts.raised ?? 100000, payoutRoute: 'individual_cash', payeeMomo: '+233240000002', payeeNetwork: 'MTN', payeeBank: null, requiresReceipts: true, firstTrancheCap: 40000, totalCap: null },
        }),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
      payoutTranche: { update: jest.fn().mockResolvedValue({}) },
    }
  }

  it('caps the FIRST release at firstTrancheCap', async () => {
    const { svc, moolre } = makeSvc(gatedDb({ raised: 100000, tranches: [], receipts: [] }))
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ amount: 40000, externalref: 'mp:f1:1' }) // 40000 cap, not the full 100000
    expect(moolre.transfer).toHaveBeenCalledWith(expect.objectContaining({ amount: '400.00' }))
  })

  it('blocks the 2nd release until the prior tranche has a verified receipt (RECEIPT_REQUIRED)', async () => {
    const { svc, moolre } = makeSvc(gatedDb({ raised: 100000, tranches: [{ id: 't1', amount: 40000, status: 'released' }], receipts: [] }))
    await expect(svc.release('u1', 'f1')).rejects.toMatchObject({ response: { code: 'RECEIPT_REQUIRED' } })
    expect(moolre.transfer).not.toHaveBeenCalled()
  })

  it('allows the 2nd release once the prior tranche receipt is verified', async () => {
    const { svc, moolre } = makeSvc(
      gatedDb({ raised: 100000, tranches: [{ id: 't1', amount: 40000, status: 'released' }], receipts: [{ id: 'r1', trancheId: 't1', kind: 'receipt', status: 'verified' }] }),
    )
    const out = await svc.release('u1', 'f1')
    expect(out).toMatchObject({ amount: 60000, externalref: 'mp:f1:2' }) // remaining delta, uncapped
    expect(moolre.transfer).toHaveBeenCalled()
  })
})
