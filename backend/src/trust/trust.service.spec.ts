import { TrustService } from './trust.service'

describe('TrustService.unlock', () => {
  it('restores standing from segments and reinstates defaulted memberships', async () => {
    const db = {
      trustScore: { findUnique: jest.fn().mockResolvedValue({ segmentsFilled: 2 }), update: jest.fn().mockResolvedValue({}) },
      member: { updateMany: jest.fn().mockResolvedValue({}) },
    }
    const out = await new TrustService(db as never).unlock('u1')
    expect(out).toEqual({ ok: true })
    expect(db.trustScore.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, data: { standing: 'building' } }),
    )
    expect(db.member.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', fundStatus: 'defaulted' },
      data: { fundStatus: 'active' },
    })
  })

  it('404s when the user has no trust score', async () => {
    const db = { trustScore: { findUnique: jest.fn().mockResolvedValue(null) } }
    await expect(new TrustService(db as never).unlock('ghost')).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } })
  })
})
