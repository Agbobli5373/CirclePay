import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common'
import { UssdService } from './ussd.service'

const SID = 'sess-1'
const PHONE = '0240000000'

/** Minimal in-memory RedisService (only the methods the engine uses). */
function makeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    setEx: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    del: jest.fn(async (...keys: string[]) => void keys.forEach((k) => store.delete(k))),
  }
}

function setup() {
  const redis = makeRedis()
  const config = { get: jest.fn(() => undefined) }
  const auth = { verifyPhonePin: jest.fn(), me: jest.fn() }
  const funds = { list: jest.fn(), detail: jest.fn() }
  const svc = new UssdService(redis as any, config as any, auth as any, funds as any)
  const send = (input: string) => svc.handle({ sessionId: SID, phone: PHONE, input })
  return { svc, redis, auth, funds, send }
}

/** Walk welcome → PIN so the session lands on the main menu. */
async function authenticate(s: ReturnType<typeof setup>, userId = 'u1') {
  s.auth.verifyPhonePin.mockResolvedValue({ id: userId })
  await s.send('') // dial → welcome (asks PIN)
  await s.send('1234') // correct PIN → main menu
}

describe('UssdService', () => {
  it('first request greets and asks for the PIN (CON), storing a pin session', async () => {
    const s = setup()
    const r = await s.send('')
    expect(r.continue).toBe(true)
    expect(r.text).toContain('Enter your PIN')
    expect(s.redis.store.get(`ussd:sess:${SID}`)).toContain('"step":"pin"')
  })

  it('routes the PIN through the shared auth check and opens the main menu', async () => {
    const s = setup()
    s.auth.verifyPhonePin.mockResolvedValue({ id: 'u1' })
    await s.send('')
    const r = await s.send('4821')
    expect(s.auth.verifyPhonePin).toHaveBeenCalledWith(PHONE, '4821')
    expect(r.continue).toBe(true)
    expect(r.text).toContain('My Susus')
    expect(r.text).toContain('Pay contribution')
  })

  it('re-prompts on a wrong PIN and ENDs (session cleared) after 3 tries', async () => {
    const s = setup()
    s.auth.verifyPhonePin.mockRejectedValue(new UnauthorizedException({ code: 'AUTH_INVALID' }))
    await s.send('')
    expect((await s.send('0000')).text).toContain('Incorrect PIN (1/3)')
    expect((await s.send('0000')).text).toContain('(2/3)')
    const r = await s.send('0000')
    expect(r.continue).toBe(false)
    expect(r.text).toContain('dial again')
    expect(s.redis.store.has(`ussd:sess:${SID}`)).toBe(false)
  })

  it('ENDs immediately when the shared lockout (HTTP 423) trips', async () => {
    const s = setup()
    s.auth.verifyPhonePin.mockRejectedValue(
      new HttpException({ code: 'LOCKED' }, HttpStatus.LOCKED),
    )
    await s.send('')
    const r = await s.send('0000')
    expect(r.continue).toBe(false)
    expect(r.text).toContain('Too many attempts')
    expect(s.redis.store.has(`ussd:sess:${SID}`)).toBe(false)
  })

  it('lists my Susus, then opens a detail with cycle / amount / payee / my turn', async () => {
    const s = setup()
    await authenticate(s)
    s.funds.list.mockResolvedValue([{ id: 'f1', name: 'Kumasi Traders' }])
    s.funds.detail.mockResolvedValue({
      name: 'Kumasi Traders',
      currentCycle: 2,
      totalCycles: 6,
      contribution: 50000,
      frequency: 'monthly',
      started: true,
      currentPayeeUserId: 'u2',
      myNextPayoutCycle: 3,
      members: [{ userId: 'u2', name: 'Ama' }],
    })

    const list = await s.send('1')
    expect(s.funds.list).toHaveBeenCalledWith('u1', 'mine')
    expect(list.continue).toBe(true)
    expect(list.text).toContain('1. Kumasi Traders')

    const detail = await s.send('1')
    expect(s.funds.detail).toHaveBeenCalledWith('u1', 'f1')
    expect(detail.text).toContain('Cycle 2/6')
    expect(detail.text).toContain('GHS 500.00')
    expect(detail.text).toContain('This cycle pays: Ama')
    expect(detail.text).toContain('Your turn: cycle 3')
  })

  it('ENDs with guidance when the user has no Susus', async () => {
    const s = setup()
    await authenticate(s)
    s.funds.list.mockResolvedValue([])
    const r = await s.send('1')
    expect(r.continue).toBe(false)
    expect(r.text).toContain('not in any Susu')
  })

  it('shows trust standing on "My standing"', async () => {
    const s = setup()
    await authenticate(s)
    s.auth.me.mockResolvedValue({ trust: { standing: 'good', onTimeRate: 95, fundsCompleted: 2 } })
    const r = await s.send('3')
    expect(s.auth.me).toHaveBeenCalledWith({ id: 'u1', isOpsAdmin: false })
    expect(r.text).toContain('Good')
    expect(r.text).toContain('95%')
    expect(r.text).toContain('2')
  })

  it('re-renders the main menu on an invalid top-level choice', async () => {
    const s = setup()
    await authenticate(s)
    const r = await s.send('9')
    expect(r.continue).toBe(true)
    expect(r.text).toContain('Invalid choice')
    expect(r.text).toContain('My Susus')
  })

  it('Phase-1 stubs: Pay and Join report "coming soon"', async () => {
    const s = setup()
    await authenticate(s)
    expect((await s.send('2')).text).toContain('coming soon')
    // session was reaped by the END; a fresh dial restarts at the PIN
    expect((await s.send('')).text).toContain('Enter your PIN')
  })
})
