import { validateReorder, resolvePayoutOrder, type TrustStanding } from '@circlepay/shared'

describe('validateReorder', () => {
  const cur = ['a', 'b', 'c', 'd']

  it('allows a permutation that keeps the locked prefix', () => {
    expect(validateReorder(cur, ['a', 'b', 'd', 'c'], 2)).toBeNull() // cycles 1-2 unchanged, 3-4 swapped
  })

  it('rejects changing a locked (already-paid / current) position', () => {
    expect(validateReorder(cur, ['b', 'a', 'c', 'd'], 2)).toBe('LOCKED_CHANGED')
  })

  it('rejects a non-permutation (a member swapped for a stranger)', () => {
    expect(validateReorder(cur, ['a', 'b', 'c', 'x'], 0)).toBe('NOT_PERMUTATION')
  })

  it('rejects a wrong-length order', () => {
    expect(validateReorder(cur, ['a', 'b', 'c'], 0)).toBe('LENGTH')
  })

  it('pre-start (lockedCount 0) allows any full permutation', () => {
    expect(validateReorder(cur, ['d', 'c', 'b', 'a'], 0)).toBeNull()
  })
})

describe('resolvePayoutOrder (manual)', () => {
  const members: { userId: string; standing: TrustStanding; joinedAt: Date }[] = [
    { userId: 'a', standing: 'good', joinedAt: new Date('2026-01-01') },
    { userId: 'b', standing: 'good', joinedAt: new Date('2026-01-02') },
    { userId: 'c', standing: 'good', joinedAt: new Date('2026-01-03') },
  ]

  it('uses the organizer preset verbatim', () => {
    expect(resolvePayoutOrder(members, 'manual', 'seed', ['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  it('appends members missing from the preset in join order', () => {
    expect(resolvePayoutOrder(members, 'manual', 'seed', ['c'])).toEqual(['c', 'a', 'b'])
  })

  it('drops preset ids that are no longer members', () => {
    expect(resolvePayoutOrder(members, 'manual', 'seed', ['x', 'b', 'a', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('falls back to join order when no preset is given', () => {
    expect(resolvePayoutOrder(members, 'manual')).toEqual(['a', 'b', 'c'])
  })
})
