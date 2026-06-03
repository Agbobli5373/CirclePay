import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('returns ok status', () => {
    const result = new HealthController().check()
    expect(result.status).toBe('ok')
    expect(result.service).toBe('circlepay-api')
    expect(typeof result.ts).toBe('string')
  })
})
