import { normalizeGhPhone, toLocal9, phoneSchema } from '@circlepay/shared'

describe('normalizeGhPhone', () => {
  it.each([
    ['0241234567', '+233241234567'], // local with leading 0 — the common case
    ['241234567', '+233241234567'], // bare 9-digit subscriber
    ['+233241234567', '+233241234567'], // already E.164
    ['233241234567', '+233241234567'], // country code without +
    ['024 123 4567', '+233241234567'], // spaces
    ['+233 24-123-4567', '+233241234567'], // mixed punctuation
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizeGhPhone(input)).toBe(expected)
  })

  it.each([['12345'], ['02412345678'], [''], ['abc']])('rejects %s → null', (input) => {
    expect(normalizeGhPhone(input)).toBeNull()
  })
})

describe('toLocal9 (input-field reducer)', () => {
  it.each([
    ['0241234567', '241234567'], // strips the local trunk 0
    ['241234567', '241234567'],
    ['+233241234567', '241234567'], // strips a pasted country code
    ['024 123 4567', '241234567'],
    ['0', ''], // mid-typing: the 0 is absorbed
    ['02', '2'],
  ])('reduces %s → %s', (input, expected) => {
    expect(toLocal9(input)).toBe(expected)
  })
})

describe('phoneSchema (lenient, normalizes before validating)', () => {
  it('accepts and canonicalizes a local 0-number', () => {
    expect(phoneSchema.parse('0241234567')).toBe('+233241234567')
  })
  it('accepts E.164 unchanged', () => {
    expect(phoneSchema.parse('+233241234567')).toBe('+233241234567')
  })
  it('rejects an invalid number', () => {
    expect(phoneSchema.safeParse('12345').success).toBe(false)
  })
})
