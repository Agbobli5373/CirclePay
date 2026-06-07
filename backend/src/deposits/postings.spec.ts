import { depositPostings, shortfallPostings } from '@circlepay/shared'

// Pure ledger-posting helpers for deposits + shortfall coverage. The headline
// invariant for money code: every transaction's postings sum to zero.
const sum = (ps: { amount: number }[]) => ps.reduce((s, p) => s + p.amount, 0)
const amt = (ps: { accountId: string; amount: number }[], id: string) =>
  ps.filter((p) => p.accountId === id).reduce((s, p) => s + p.amount, 0)

describe('depositPostings', () => {
  it('cash into the float, held as the member deposit, and balances (no fee)', () => {
    const ps = depositPostings({ moolreFloatAccountId: 'float', depositAccountId: 'dep', amount: 20000 })
    expect(sum(ps)).toBe(0)
    expect(amt(ps, 'float')).toBe(20000)
    expect(amt(ps, 'dep')).toBe(-20000) // holding (liability) is negative
  })

  it('books a Moolre fee against the float and still balances', () => {
    const ps = depositPostings({
      moolreFloatAccountId: 'float',
      depositAccountId: 'dep',
      amount: 20000,
      moolreFee: 150,
      moolreFeeAccountId: 'mfee',
    })
    expect(sum(ps)).toBe(0)
    expect(amt(ps, 'float')).toBe(19850) // net actually received
    expect(amt(ps, 'dep')).toBe(-20000)
    expect(amt(ps, 'mfee')).toBe(150)
  })
})

describe('shortfallPostings', () => {
  it('covers fully from the deposit and balances', () => {
    const ps = shortfallPostings({ fundPotAccountId: 'pot', depositAccountId: 'dep', depositUsed: 50000 })
    expect(sum(ps)).toBe(0)
    expect(amt(ps, 'dep')).toBe(50000) // deposit holding consumed toward zero
    expect(amt(ps, 'pot')).toBe(-50000) // pot filled as if the member had contributed
  })

  it('draws deposit then safety pool and balances', () => {
    const ps = shortfallPostings({
      fundPotAccountId: 'pot',
      depositAccountId: 'dep',
      depositUsed: 30000,
      safetyPoolAccountId: 'pool',
      poolUsed: 20000,
    })
    expect(sum(ps)).toBe(0)
    expect(amt(ps, 'dep')).toBe(30000)
    expect(amt(ps, 'pool')).toBe(20000)
    expect(amt(ps, 'pot')).toBe(-50000)
  })
})
