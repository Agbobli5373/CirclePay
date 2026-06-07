import { parseInbound, formatReply } from './ussd.adapter'

describe('ussd.adapter', () => {
  describe('parseInbound', () => {
    it('maps the canonical body', () => {
      expect(parseInbound({ sessionId: 'S1', phone: '0240000000', text: '1' })).toEqual({
        sessionId: 'S1',
        phone: '0240000000',
        input: '1',
      })
    })

    it('accepts provider field aliases (sessionID / phoneNumber / msisdn)', () => {
      expect(parseInbound({ sessionID: 'S2', phoneNumber: '0500000000', text: '' })).toMatchObject({
        sessionId: 'S2',
        phone: '0500000000',
      })
      expect(parseInbound({ sessionid: 'S3', msisdn: '0270000000', input: '2' })).toMatchObject({
        sessionId: 'S3',
        phone: '0270000000',
        input: '2',
      })
    })

    it('takes the last *-segment when a gateway sends accumulated text', () => {
      // Africa's-Talking-style accumulated text: the latest entry is after the final '*'.
      expect(parseInbound({ sessionId: 'S', phone: 'p', text: '1*1234*2' }).input).toBe('2')
      expect(parseInbound({ sessionId: 'S', phone: 'p', text: '' }).input).toBe('')
    })

    it('prefers an explicit input over text', () => {
      expect(parseInbound({ sessionId: 'S', phone: 'p', text: '1*2', input: '9' }).input).toBe('9')
    })

    it('defaults missing fields to empty strings (never throws on a sparse body)', () => {
      expect(parseInbound({})).toEqual({ sessionId: '', phone: '', input: '' })
    })
  })

  describe('formatReply', () => {
    it('prefixes CON to keep the session open', () => {
      expect(formatReply({ continue: true, text: 'Enter PIN:' })).toBe('CON Enter PIN:')
    })
    it('prefixes END to close the session', () => {
      expect(formatReply({ continue: false, text: 'Bye' })).toBe('END Bye')
    })
  })
})
