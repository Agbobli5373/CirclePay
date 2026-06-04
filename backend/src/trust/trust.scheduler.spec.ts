import { TrustScheduler } from './trust.scheduler'
import { ConfigService } from '@nestjs/config'

const config = { get: () => '48' } as unknown as ConfigService

function deps(defaulters: unknown[], overdue: unknown[]) {
  const tx = {
    member: { update: jest.fn().mockResolvedValue({}) },
    trustScore: { update: jest.fn().mockResolvedValue({}) },
    activityItem: { create: jest.fn().mockResolvedValue({}) },
  }
  const db = {
    member: {
      findMany: jest.fn().mockResolvedValueOnce(defaulters).mockResolvedValueOnce(overdue),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  }
  const lock = { tryWithLock: jest.fn(async (_k: number, fn: () => Promise<void>) => fn()) }
  const notifications = { sendSms: jest.fn().mockResolvedValue(undefined) }
  const svc = new TrustScheduler(db as never, config, lock as never, notifications as never)
  return { svc, db, tx, notifications }
}

const member = (id: string, userId: string) => ({ id, userId, fundId: 'f1', user: { phone: '+233240000001' }, fund: { name: 'Kumasi Traders' } })

describe('TrustScheduler.sweep', () => {
  it('defaults an unpaid member past grace and locks them platform-wide', async () => {
    const { svc, tx, notifications } = deps([member('m1', 'u1')], [])
    await svc.sweep()
    expect(tx.member.update).toHaveBeenCalledWith(expect.objectContaining({ data: { fundStatus: 'defaulted' } }))
    expect(tx.trustScore.update).toHaveBeenCalledWith(expect.objectContaining({ data: { standing: 'locked' } }))
    expect(notifications.sendSms).toHaveBeenCalled()
  })

  it('flags an overdue member (within grace) without locking', async () => {
    const { svc, db, tx } = deps([], [member('m2', 'u2')])
    await svc.sweep()
    expect(db.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'overdue', fundStatus: 'grace' } }),
    )
    expect(tx.trustScore.update).not.toHaveBeenCalled()
  })
})
