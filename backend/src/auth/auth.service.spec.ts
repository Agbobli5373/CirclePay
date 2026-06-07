import { AuthService } from './auth.service'
import { ConfigService } from '@nestjs/config'

const config = {
  get: (k: string) => ({ NODE_ENV: 'test', PIN_MAX_ATTEMPTS: '5', PIN_LOCK_SECONDS: '900' })[k],
} as unknown as ConfigService

const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as never

describe('AuthService', () => {
  it('requestOtp returns devCode in non-prod and never throws on a valid number', async () => {
    const otp = { withinRateLimit: jest.fn().mockResolvedValue(true), generate: jest.fn().mockResolvedValue('123456') }
    const notifications = { sendOtp: jest.fn().mockResolvedValue(undefined) }
    const svc = new AuthService(
      {} as never, {} as never, otp as never, {} as never, notifications as never, config,
    )
    const out = await svc.requestOtp({ phone: '+233241234567', network: 'MTN' } as never)
    expect(out.ok).toBe(true)
    expect(out.devCode).toBe('123456')
    expect(notifications.sendOtp).toHaveBeenCalled()
  })

  it('requestOtp throws 429 when rate limited', async () => {
    const otp = { withinRateLimit: jest.fn().mockResolvedValue(false), generate: jest.fn() }
    const svc = new AuthService({} as never, {} as never, otp as never, {} as never, { sendOtp: jest.fn() } as never, config)
    await expect(svc.requestOtp({ phone: '+233241234567', network: 'MTN' } as never)).rejects.toMatchObject({
      status: 429,
    })
    expect(otp.generate).not.toHaveBeenCalled()
  })

  it('verifyOtp issues a session for an existing user', async () => {
    const otp = { verify: jest.fn().mockResolvedValue({ ok: true }) }
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false }) } }
    const tokens = { issueSession: jest.fn().mockResolvedValue(undefined), signRegToken: jest.fn(), setRegCookie: jest.fn() }
    const svc = new AuthService(db as never, {} as never, otp as never, tokens as never, {} as never, config)
    const out = await svc.verifyOtp({ phone: '+233241234567', code: '123456' } as never, res())
    expect(out).toEqual({ registered: true })
    expect(tokens.issueSession).toHaveBeenCalled()
  })

  it('verifyOtp issues a reg-token for a new user', async () => {
    const otp = { verify: jest.fn().mockResolvedValue({ ok: true }) }
    const db = { user: { findUnique: jest.fn().mockResolvedValue(null) } }
    const tokens = { issueSession: jest.fn(), signRegToken: jest.fn().mockReturnValue('reg.jwt'), setRegCookie: jest.fn() }
    const svc = new AuthService(db as never, {} as never, otp as never, tokens as never, {} as never, config)
    const out = await svc.verifyOtp({ phone: '+233241234567', code: '123456' } as never, res())
    expect(out).toEqual({ registered: false })
    expect(tokens.setRegCookie).toHaveBeenCalled()
  })

  it('verifyOtp maps OTP failure reasons to error codes', async () => {
    const otp = { verify: jest.fn().mockResolvedValue({ ok: false, reason: 'EXPIRED' }) }
    const svc = new AuthService({} as never, {} as never, otp as never, {} as never, {} as never, config)
    await expect(svc.verifyOtp({ phone: '+233241234567', code: '000000' } as never, res())).rejects.toMatchObject({
      response: { code: 'OTP_EXPIRED' },
    })
  })

  it('setPin creates a user (+ trustScore) and issues a session', async () => {
    const tokens = { verifyRegToken: jest.fn().mockReturnValue({ phone: '+233241234567' }), issueSession: jest.fn() }
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false }),
      },
    }
    const svc = new AuthService(db as never, {} as never, {} as never, tokens as never, {} as never, config)
    const out = await svc.setPin('reg.jwt', { pin: '5071', confirmPin: '5071', network: 'MTN' } as never, res())
    expect(out).toEqual({ ok: true })
    expect(db.user.create).toHaveBeenCalled()
    const createArg = db.user.create.mock.calls[0][0]
    expect(createArg.data.trustScore).toEqual({ create: {} })
    expect(createArg.data.pinHash).toBeDefined()
    expect(tokens.issueSession).toHaveBeenCalled()
  })

  it('login locks after PIN_MAX_ATTEMPTS failures', async () => {
    const argon = require('argon2')
    const pinHash = await argon.hash('5071', { type: argon.argon2id })
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false, pinHash }) } }
    // 5th failure → lock set
    const redis = {
      exists: jest.fn().mockResolvedValue(false),
      incrWithTtl: jest.fn().mockResolvedValue(5),
      setEx: jest.fn(),
      del: jest.fn(),
    }
    const svc = new AuthService(db as never, redis as never, {} as never, {} as never, {} as never, config)
    await expect(svc.login({ phone: '+233241234567', pin: '0000' } as never, res())).rejects.toMatchObject({
      status: 423,
    })
    expect(redis.setEx).toHaveBeenCalledWith('pin:lock:u1', '1', expect.any(Number))
  })

  it('login succeeds with the correct PIN and resets the fail counter', async () => {
    const argon = require('argon2')
    const pinHash = await argon.hash('5071', { type: argon.argon2id })
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false, pinHash }) } }
    const redis = { exists: jest.fn().mockResolvedValue(false), del: jest.fn() }
    const tokens = { issueSession: jest.fn() }
    const svc = new AuthService(db as never, redis as never, {} as never, tokens as never, {} as never, config)
    const out = await svc.login({ phone: '+233241234567', pin: '5071' } as never, res())
    expect(out).toEqual({ ok: true })
    expect(redis.del).toHaveBeenCalledWith('pin:fail:u1')
    expect(tokens.issueSession).toHaveBeenCalled()
  })

  it('changePin verifies the current PIN, stores a new hash, and clears fails', async () => {
    const argon = require('argon2')
    const pinHash = await argon.hash('5071', { type: argon.argon2id })
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false, pinHash }),
        update: jest.fn().mockResolvedValue({}),
      },
    }
    const redis = { exists: jest.fn().mockResolvedValue(false), del: jest.fn() }
    const svc = new AuthService(db as never, redis as never, {} as never, {} as never, {} as never, config)
    const out = await svc.changePin(
      { id: 'u1', isOpsAdmin: false } as never,
      { currentPin: '5071', newPin: '8240', confirmPin: '8240' } as never,
    )
    expect(out).toEqual({ ok: true })
    const updArg = db.user.update.mock.calls[0][0]
    expect(updArg.where).toEqual({ id: 'u1' })
    expect(updArg.data.pinHash).toBeDefined()
    expect(updArg.data.pinHash).not.toBe(pinHash) // re-hashed to the new PIN
    expect(redis.del).toHaveBeenCalledWith('pin:fail:u1')
  })

  it('changePin rejects a wrong current PIN with PIN_INVALID and does not update', async () => {
    const argon = require('argon2')
    const pinHash = await argon.hash('5071', { type: argon.argon2id })
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false, pinHash }), update: jest.fn() },
    }
    const redis = { exists: jest.fn().mockResolvedValue(false), incrWithTtl: jest.fn().mockResolvedValue(1), setEx: jest.fn(), del: jest.fn() }
    const svc = new AuthService(db as never, redis as never, {} as never, {} as never, {} as never, config)
    await expect(
      svc.changePin({ id: 'u1' } as never, { currentPin: '0000', newPin: '8240', confirmPin: '8240' } as never),
    ).rejects.toMatchObject({ response: { code: 'PIN_INVALID' } })
    expect(db.user.update).not.toHaveBeenCalled()
    expect(redis.incrWithTtl).toHaveBeenCalled()
  })

  it('changePin locks after PIN_MAX_ATTEMPTS bad current-PIN attempts', async () => {
    const argon = require('argon2')
    const pinHash = await argon.hash('5071', { type: argon.argon2id })
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false, pinHash }), update: jest.fn() },
    }
    const redis = { exists: jest.fn().mockResolvedValue(false), incrWithTtl: jest.fn().mockResolvedValue(5), setEx: jest.fn(), del: jest.fn() }
    const svc = new AuthService(db as never, redis as never, {} as never, {} as never, {} as never, config)
    await expect(
      svc.changePin({ id: 'u1' } as never, { currentPin: '0000', newPin: '8240', confirmPin: '8240' } as never),
    ).rejects.toMatchObject({ status: 423 })
    expect(redis.setEx).toHaveBeenCalledWith('pin:lock:u1', '1', expect.any(Number))
  })

  it('verifyOtp (purpose reset) issues a reset-token — not a session — for an existing user', async () => {
    const otp = { verify: jest.fn().mockResolvedValue({ ok: true }) }
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false }) } }
    const tokens = { signResetToken: jest.fn().mockReturnValue('reset.jwt'), setResetCookie: jest.fn(), issueSession: jest.fn() }
    const svc = new AuthService(db as never, {} as never, otp as never, tokens as never, {} as never, config)
    const out = await svc.verifyOtp({ phone: '+233241234567', code: '123456', purpose: 'reset' } as never, res())
    expect(out).toEqual({ registered: true, reset: true })
    expect(otp.verify).toHaveBeenCalledWith('+233241234567', '123456', 'reset')
    expect(tokens.setResetCookie).toHaveBeenCalled()
    expect(tokens.issueSession).not.toHaveBeenCalled() // no login until the new PIN is set
  })

  it('verifyOtp (purpose reset) rejects a number with no account (NO_ACCOUNT)', async () => {
    const otp = { verify: jest.fn().mockResolvedValue({ ok: true }) }
    const db = { user: { findUnique: jest.fn().mockResolvedValue(null) } }
    const tokens = { signResetToken: jest.fn(), setResetCookie: jest.fn() }
    const svc = new AuthService(db as never, {} as never, otp as never, tokens as never, {} as never, config)
    await expect(
      svc.verifyOtp({ phone: '+233241234567', code: '123456', purpose: 'reset' } as never, res()),
    ).rejects.toMatchObject({ response: { code: 'NO_ACCOUNT' } })
    expect(tokens.setResetCookie).not.toHaveBeenCalled()
  })

  it('resetPin sets a new hash, clears BOTH lockout keys, and issues a session', async () => {
    const argon = require('argon2')
    const pinHash = await argon.hash('5071', { type: argon.argon2id })
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', isOpsAdmin: false, pinHash }),
        update: jest.fn().mockResolvedValue({}),
      },
    }
    const redis = { del: jest.fn() }
    const tokens = {
      verifyResetToken: jest.fn().mockReturnValue({ phone: '+233241234567' }),
      clearResetCookie: jest.fn(),
      issueSession: jest.fn(),
    }
    const svc = new AuthService(db as never, redis as never, {} as never, tokens as never, {} as never, config)
    const out = await svc.resetPin('reset.jwt', { newPin: '8240', confirmPin: '8240' } as never, res())
    expect(out).toEqual({ ok: true })
    const updArg = db.user.update.mock.calls[0][0]
    expect(updArg.data.pinHash).toBeDefined()
    expect(updArg.data.pinHash).not.toBe(pinHash) // re-hashed to the new PIN
    expect(redis.del).toHaveBeenCalledWith('pin:fail:u1', 'pin:lock:u1') // recovery clears the lock
    expect(tokens.issueSession).toHaveBeenCalled()
  })

  it('resetPin without a reset token throws RESET_TOKEN_INVALID and updates nothing', async () => {
    const db = { user: { findUnique: jest.fn(), update: jest.fn() } }
    const svc = new AuthService(db as never, {} as never, {} as never, {} as never, {} as never, config)
    await expect(
      svc.resetPin(undefined, { newPin: '8240', confirmPin: '8240' } as never, res()),
    ).rejects.toMatchObject({ response: { code: 'RESET_TOKEN_INVALID' } })
    expect(db.user.update).not.toHaveBeenCalled()
  })
})
