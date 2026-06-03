import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/**
 * LockService — Postgres advisory lock implementation.
 *
 * Prevents duplicate scheduled runs when multiple backend instances are active.
 * Upgrade path: implement RedisLockService behind the same interface when scaling
 * beyond ~3 instances (see circlepay-stack/references/operations.md).
 *
 * pg_try_advisory_lock is session-scoped and non-blocking: returns true only if
 * this session acquired the lock; returns false immediately if another holds it.
 */
@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name)

  constructor(private readonly db: PrismaService) {}

  /**
   * Try to acquire advisory lock `key`, run `fn`, then release.
   * No-ops silently if the lock is already held (another instance is running).
   */
  async tryWithLock(key: number, fn: () => Promise<void>): Promise<void> {
    const result = await this.db.$queryRaw<[{ acquired: boolean }]>`
      SELECT pg_try_advisory_lock(${key}::bigint) AS acquired
    `
    const acquired = result[0]?.acquired

    if (!acquired) {
      this.logger.debug(`Lock ${key} already held — skipping run`)
      return
    }

    try {
      await fn()
    } finally {
      await this.db.$queryRaw`SELECT pg_advisory_unlock(${key}::bigint)`
    }
  }
}
