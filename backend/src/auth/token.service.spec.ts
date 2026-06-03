import { TokenService } from './token.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

function makeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    setEx: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    del: jest.fn(async (...keys: string[]) => keys.forEach((k) => store.delete(k))),
    delByPattern: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '')
      ;[...store.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => store.delete(k))
    }),
  }
}

const config = {
  get: (k: string) =>
    ({
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
      REG_TOKEN_TTL: '10m',
      NODE_ENV: 'test',
    })[k],
  getOrThrow: (k: string) =>
    ({ JWT_ACCESS_SECRET: 'access-secret', JWT_REFRESH_SECRET: 'refresh-secret' })[k],
} as unknown as ConfigService

// Captures cookies set/cleared on a fake Express Response.
function makeRes() {
  const cookies: Record<string, string> = {}
  return {
    cookies,
    cookie: jest.fn((name: string, value: string) => void (cookies[name] = value)),
    clearCookie: jest.fn((name: string) => void delete cookies[name]),
  }
}

describe('TokenService', () => {
  const jwt = new JwtService({})
  const loadUser = async (id: string) => ({ id, isOpsAdmin: false })

  it('issues access + refresh cookies and stores the session', async () => {
    const redis = makeRedis()
    const svc = new TokenService(jwt, config, redis as never)
    const res = makeRes()
    await svc.issueSession(res as never, { id: 'u1', isOpsAdmin: false })
    expect(res.cookies.access_token).toBeDefined()
    expect(res.cookies.refresh_token).toBeDefined()
    expect([...redis.store.keys()].some((k) => k.startsWith('sess:u1:'))).toBe(true)
  })

  it('rotates: old session deleted, new cookies issued', async () => {
    const redis = makeRedis()
    const svc = new TokenService(jwt, config, redis as never)
    const res1 = makeRes()
    await svc.issueSession(res1 as never, { id: 'u1', isOpsAdmin: false })
    const oldRefresh = res1.cookies.refresh_token

    const res2 = makeRes()
    await svc.rotate(res2 as never, oldRefresh, loadUser)
    expect(res2.cookies.refresh_token).toBeDefined()
    expect(res2.cookies.refresh_token).not.toBe(oldRefresh)
  })

  it('detects reuse of a rotated refresh token → revokes all sessions', async () => {
    const redis = makeRedis()
    const svc = new TokenService(jwt, config, redis as never)
    const res1 = makeRes()
    await svc.issueSession(res1 as never, { id: 'u1', isOpsAdmin: false })
    const oldRefresh = res1.cookies.refresh_token

    // First rotation consumes oldRefresh.
    await svc.rotate(makeRes() as never, oldRefresh, loadUser)
    // Replaying oldRefresh must fail AND wipe all sessions for the user.
    await expect(svc.rotate(makeRes() as never, oldRefresh, loadUser)).rejects.toThrow()
    expect([...redis.store.keys()].some((k) => k.startsWith('sess:u1:'))).toBe(false)
  })

  it('reg token round-trips and carries the phone', () => {
    const redis = makeRedis()
    const svc = new TokenService(jwt, config, redis as never)
    const token = svc.signRegToken('+233241234567')
    expect(svc.verifyRegToken(token).phone).toBe('+233241234567')
  })

  it('rejects a tampered reg token', () => {
    const redis = makeRedis()
    const svc = new TokenService(jwt, config, redis as never)
    expect(() => svc.verifyRegToken('not-a-jwt')).toThrow()
  })
})
