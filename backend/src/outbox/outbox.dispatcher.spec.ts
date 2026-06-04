import { OutboxDispatcher } from './outbox.dispatcher'

describe('OutboxDispatcher', () => {
  it('registers handlers and looks them up by type', () => {
    const dispatcher = new OutboxDispatcher(null as never, null as never)
    const handler = jest.fn()
    dispatcher.register('ContributionSettled', handler)
    // Access private map via any cast — just tests the registry interface.
    const registered = (dispatcher as any).handlers.get('ContributionSettled')
    expect(registered).toBe(handler)
  })

  it('does not re-register the same type twice (last-write wins)', () => {
    const dispatcher = new OutboxDispatcher(null as never, null as never)
    const h1 = jest.fn()
    const h2 = jest.fn()
    dispatcher.register('PayoutSettled', h1)
    dispatcher.register('PayoutSettled', h2)
    const registered = (dispatcher as any).handlers.get('PayoutSettled')
    expect(registered).toBe(h2)
  })
})

describe('OutboxDispatcher — single-dispatch via lock', () => {
  it('skips processing when the lock is held', async () => {
    // Lock always returns "not acquired" → processBatch must not be called.
    const db = { outboxEvent: { findMany: jest.fn() } }
    const lock = {
      tryWithLock: jest.fn().mockResolvedValue(undefined), // lock held, fn not called
    }
    const dispatcher = new OutboxDispatcher(db as never, lock as never)
    await dispatcher.dispatch()
    expect(db.outboxEvent.findMany).not.toHaveBeenCalled()
  })
})
