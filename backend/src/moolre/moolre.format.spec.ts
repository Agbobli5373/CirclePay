import { toMoolrePayer, ghs, collectionChannelFor, transferChannelFor } from './moolre.format'

// Locks the exact Moolre request values so the dedupe refactor (and future edits) can't
// silently re-route a payment leg to the wrong network/channel.
describe('moolre format helpers', () => {
  it('strips a leading + for the payer (leaves local numbers as-is)', () => {
    expect(toMoolrePayer('+233241234567')).toBe('233241234567')
    expect(toMoolrePayer('0241234567')).toBe('0241234567')
  })

  it('formats pesewas as a 2dp major-unit string', () => {
    expect(ghs(50000)).toBe('500.00')
    expect(ghs(199)).toBe('1.99')
    expect(ghs(0)).toBe('0.00')
  })

  it('maps the COLLECTION channel (MTN 13 / Telecel 6 / AirtelTigo 7; default MTN)', () => {
    expect(collectionChannelFor('MTN')).toBe('13')
    expect(collectionChannelFor('Telecel')).toBe('6')
    expect(collectionChannelFor('AirtelTigo')).toBe('7')
    expect(collectionChannelFor(null)).toBe('13')
  })

  it('maps the TRANSFER channel (MTN 1 / Telecel 6 / AirtelTigo 7; default MTN)', () => {
    expect(transferChannelFor('MTN')).toBe('1')
    expect(transferChannelFor('Telecel')).toBe('6')
    expect(transferChannelFor('AirtelTigo')).toBe('7')
    expect(transferChannelFor(undefined)).toBe('1')
  })
})
