import { MoolreService } from './moolre.service'
import { ConfigService } from '@nestjs/config'

describe('MoolreService', () => {
  let service: MoolreService

  beforeEach(() => {
    const config = {
      get: (key: string) => {
        const env: Record<string, string> = {
          MOOLRE_BASE_URL: 'https://sandbox.moolre.com',
          MOOLRE_API_USER: 'test-user',
          MOOLRE_ACCOUNT_NUMBER: '100000000001',
        }
        return env[key]
      },
      getOrThrow: (key: string) => {
        const val = { MOOLRE_API_USER: 'test-user', MOOLRE_ACCOUNT_NUMBER: '100000000001' }[key]
        if (!val) throw new Error(`Missing ${key}`)
        return val
      },
    } as unknown as ConfigService

    service = new MoolreService(config)
    service.onModuleInit()
  })

  it('initialises without throwing', () => {
    expect(service).toBeDefined()
  })

  it('surfaces MoolreError as a typed class on the service', () => {
    expect(MoolreService.Error).toBeDefined()
    const err = new MoolreService.Error('test', 'AIN01', {
      status: 0,
      code: 'AIN01',
      message: 'test',
      data: null,
      go: null,
    })
    expect(err.code).toBe('AIN01')
    expect(err).toBeInstanceOf(Error)
  })
})
