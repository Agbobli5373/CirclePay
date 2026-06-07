import { MockMoolreClient } from './moolre.mock'

const cfg = { callbackBaseUrl: 'http://127.0.0.1:4001/api', webhookSecret: 'sek', settleDelayMs: 0 }

describe('MockMoolreClient', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true })
    ;(global as unknown as { fetch: jest.Mock }).fetch = fetchMock
  })

  it('collect without otpcode asks for OTP and does not settle', async () => {
    const c = new MockMoolreClient(cfg)
    const res = await c.collect({ channel: '13', payer: '0240000000', amount: '5', externalref: 'c:f1:1:u1' })
    expect(res.otpRequired).toBe(true)
    expect(res.raw.code).toBe('TP14')
    expect(await c.isSettled('c:f1:1:u1')).toBe(false)
  })

  it('collect with any otpcode initiates, marks settled, and fires the self-webhook', async () => {
    const c = new MockMoolreClient(cfg)
    const res = await c.collect({ channel: '13', payer: '0240000000', amount: '5', externalref: 'c:f1:1:u1', otpcode: '000000' })
    expect(res.otpRequired).toBe(false)
    expect(res.raw.code).toBe('TR099')
    expect(await c.isSettled('c:f1:1:u1')).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:4001/api/webhooks/moolre/sek')
    const body = JSON.parse((init as { body: string }).body)
    expect(body.data.externalref).toBe('c:f1:1:u1')
    expect(body.data.txstatus).toBe(1)
  })

  it('transfer succeeds, marks settled, and fires the self-webhook', async () => {
    const c = new MockMoolreClient(cfg)
    const res = await c.transfer({ channel: '1', receiver: '0240000000', amount: '500', externalref: 'p:f1:1', sublistid: 's1' })
    expect(res.code).toBe('OBGH01')
    expect(res.data.transactionid).toMatch(/^MOCK-/)
    expect(await c.isSettled('p:f1:1')).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sendSms returns SMS01 so NotificationsService never throws', async () => {
    const c = new MockMoolreClient(cfg)
    const res = await c.sendSms({ senderId: 'CirclePay', messages: [{ recipient: '0240000000', message: 'hi' }] })
    expect(res.code).toBe('SMS01')
  })

  it('getBalance returns a large balance so the payout guard passes', async () => {
    const c = new MockMoolreClient(cfg)
    const res = await c.getBalance()
    expect(res.code).toBe('SW01')
    expect(res.data.balance).toBeGreaterThan(1_000_000)
  })
})
