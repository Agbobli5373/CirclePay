import { UnauthorizedException } from '@nestjs/common'
import { UssdController } from './ussd.controller'

const config = (secret?: string) => ({
  get: (k: string) => (k === 'USSD_GATEWAY_SECRET' ? secret : undefined),
})

describe('UssdController', () => {
  it('rejects a wrong or unset secret with 401 (never reaches the engine)', async () => {
    const ussd = { handle: jest.fn() }
    const wrong = new UssdController(config('right') as any, ussd as any)
    await expect(wrong.handle('nope', {})).rejects.toBeInstanceOf(UnauthorizedException)

    const unset = new UssdController(config(undefined) as any, ussd as any)
    await expect(unset.handle('anything', {})).rejects.toBeInstanceOf(UnauthorizedException)

    expect(ussd.handle).not.toHaveBeenCalled()
  })

  it('normalizes the body, calls the engine, and encodes a CON reply', async () => {
    const ussd = { handle: jest.fn().mockResolvedValue({ continue: true, text: 'Enter your PIN:' }) }
    const ctrl = new UssdController(config('s3cret') as any, ussd as any)
    const out = await ctrl.handle('s3cret', { sessionId: 'S', phone: '0240000000', text: '1' })
    expect(ussd.handle).toHaveBeenCalledWith({ sessionId: 'S', phone: '0240000000', input: '1' })
    expect(out).toBe('CON Enter your PIN:')
  })

  it('encodes an END reply', async () => {
    const ussd = { handle: jest.fn().mockResolvedValue({ continue: false, text: 'Bye' }) }
    const ctrl = new UssdController(config('s3cret') as any, ussd as any)
    expect(await ctrl.handle('s3cret', { sessionId: 'S', phone: 'p' })).toBe('END Bye')
  })
})
