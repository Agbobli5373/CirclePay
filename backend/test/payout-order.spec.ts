import { resolvePayoutOrder } from '@circlepay/shared'

const members = [
  { userId: 'c', standing: 'building' as const, joinedAt: new Date(300) },
  { userId: 'a', standing: 'excellent' as const, joinedAt: new Date(100) },
  { userId: 'b', standing: 'good' as const, joinedAt: new Date(200) },
]

describe('resolvePayoutOrder', () => {
  it('rotating = join order (by joinedAt)', () => {
    expect(resolvePayoutOrder(members, 'rotating')).toEqual(['a', 'b', 'c'])
  })

  it('trust_ordered = safest first', () => {
    expect(resolvePayoutOrder(members, 'trust_ordered')).toEqual(['a', 'b', 'c'])
  })

  it('random without a seed falls back to join order', () => {
    expect(resolvePayoutOrder(members, 'random')).toEqual(['a', 'b', 'c'])
  })

  it('random with a seed is a deterministic permutation of all members', () => {
    const r1 = resolvePayoutOrder(members, 'random', 'fund-123')
    const r2 = resolvePayoutOrder(members, 'random', 'fund-123')
    expect(r1).toEqual(r2) // reproducible
    expect([...r1].sort()).toEqual(['a', 'b', 'c']) // permutation, no drops/dupes
    // a different seed can produce a different order (sanity, not guaranteed)
    expect(resolvePayoutOrder(members, 'random', 'other-seed').length).toBe(3)
  })
})
