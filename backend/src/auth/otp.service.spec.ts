import { OtpService } from './otp.service'
import { ConfigService } from '@nestjs/config'

// In-memory Redis stub covering the methods OtpService uses.
function makeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    setEx: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    del: jest.fn(async (...keys: string[]) => keys.forEach((k) => store.delete(k))),
    incrWithTtl: jest.fn(async (k: string) => {
      const n = Number(store.get(k) ?? '0') + 1
      store.set(k, String(n))
      return n
    }),
  }
}

const config = {
  get: (k: string) =>
    ({ OTP_TTL_SECONDS: '300', OTP_MAX_ATTEMPTS: '5', OTP_RATE_MAX: '3', OTP_RATE_WINDOW_SECONDS: '600' })[k],
} as unknown as ConfigService

describe('OtpService', () => {
  it('generates a 6-digit code and stores a hash (not the code)', async () => {
    const redis = makeRedis()
    const svc = new OtpService(redis as never, config)
    const code = await svc.generate('+233241234567')
    expect(code).toMatch(/^\d{6}$/)
    const stored = JSON.parse(redis.store.get('otp:+233241234567:auth')!)
    expect(stored.codeHash).not.toContain(code)
    expect(stored.attempts).toBe(0)
  })

  it('verifies the correct code and consumes it', async () => {
    const redis = makeRedis()
    const svc = new OtpService(redis as never, config)
    const code = await svc.generate('+233241234567')
    const res = await svc.verify('+233241234567', code)
    expect(res).toEqual({ ok: true })
    expect(redis.store.has('otp:+233241234567:auth')).toBe(false)
  })

  it('rejects a wrong code and increments attempts', async () => {
    const redis = makeRedis()
    const svc = new OtpService(redis as never, config)
    await svc.generate('+233241234567')
    const res = await svc.verify('+233241234567', '000000')
    expect(res).toEqual({ ok: false, reason: 'INVALID' })
    expect(JSON.parse(redis.store.get('otp:+233241234567:auth')!).attempts).toBe(1)
  })

  it('reports EXPIRED when no code exists', async () => {
    const redis = makeRedis()
    const svc = new OtpService(redis as never, config)
    const res = await svc.verify('+233241234567', '123456')
    expect(res).toEqual({ ok: false, reason: 'EXPIRED' })
  })

  it('enforces the rate limit (>3 in window)', async () => {
    const redis = makeRedis()
    const svc = new OtpService(redis as never, config)
    const phone = '+233241234567'
    expect(await svc.withinRateLimit(phone)).toBe(true) // 1
    expect(await svc.withinRateLimit(phone)).toBe(true) // 2
    expect(await svc.withinRateLimit(phone)).toBe(true) // 3
    expect(await svc.withinRateLimit(phone)).toBe(false) // 4 → blocked
  })

  it('keys codes by purpose — an auth code cannot be verified as a reset', async () => {
    const redis = makeRedis()
    const svc = new OtpService(redis as never, config)
    const code = await svc.generate('+233241234567', 'auth')
    // Correct code, wrong purpose → looked up under a different key → EXPIRED.
    expect(await svc.verify('+233241234567', code, 'reset')).toEqual({ ok: false, reason: 'EXPIRED' })
    // The same code under the matching purpose still works.
    expect(await svc.verify('+233241234567', code, 'auth')).toEqual({ ok: true })
  })
})
