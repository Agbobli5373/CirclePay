import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/** Reads the current user's activity feed (ActivityItem rows written by contributions/payouts). */
@Injectable()
export class ActivityService {
  constructor(private readonly db: PrismaService) {}

  async list(userId: string) {
    const items = await this.db.activityItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return items.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      detail: a.detail,
      amount: a.amount,
      direction: a.direction === 'in_' ? 'in' : a.direction === 'out_' ? 'out' : null,
      reference: a.reference,
      createdAt: a.createdAt,
    }))
  }
}
