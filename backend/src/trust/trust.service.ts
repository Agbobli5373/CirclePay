import { Injectable, NotFoundException } from '@nestjs/common'
import { trustStanding, type TrustStanding } from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'

/** Shared rules use 'new'; Prisma's enum uses 'new_'. */
function toPrismaStanding(s: TrustStanding): string {
  return s === 'new' ? 'new_' : s
}

@Injectable()
export class TrustService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Appeal upheld → lift the platform-wide lock and restore the user's standing
   * (recomputed from their filled trust segments), and reinstate any defaulted memberships.
   */
  async unlock(userId: string): Promise<{ ok: true }> {
    const ts = await this.db.trustScore.findUnique({ where: { userId } })
    if (!ts) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User has no trust score' })

    await this.db.trustScore.update({
      where: { userId },
      data: { standing: toPrismaStanding(trustStanding(ts.segmentsFilled)) as never },
    })
    await this.db.member.updateMany({
      where: { userId, fundStatus: 'defaulted' },
      data: { fundStatus: 'active' },
    })
    return { ok: true }
  }
}
