import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/**
 * LockService — Postgres advisory lock implementation.
 *
 * Prevents duplicate scheduled runs when multiple backend instances are active.
 * Upgrade path: implement RedisLockService behind the same interface when scaling
 * beyond ~3 instances (see circlepay-stack/references/operations.md).
 *
 * Uses a TRANSACTION-scoped advisory lock (pg_try_advisory_xact_lock): it is held
 * for the life of the surrounding transaction and released automatically on
 * commit/rollback. This avoids the leak that a session-scoped lock suffers under
 * a connection pool — where the acquire and a later pg_advisory_unlock can land on
 * different pooled connections, so the unlock no-ops and the lock is never freed.
 */
@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name)

  constructor(private readonly db: PrismaService) {}

  /**
   * Try to acquire advisory lock `key`, run `fn` while holding it, then release.
   * No-ops silently if the lock is already held (another instance is running).
   *
   * The lock lives on the wrapping interactive transaction's connection and is
   * released by the transaction ending — `fn` runs against the pool as usual.
   */
  async tryWithLock(key: number, fn: () => Promise<void>): Promise<void> {
    await this.db.$transaction(
      async (tx) => {
        const result = await tx.$queryRaw<[{ acquired: boolean }]>`
          SELECT pg_try_advisory_xact_lock(${key}::bigint) AS acquired
        `
        if (!result[0]?.acquired) {
          this.logger.debug(`Lock ${key} already held — skipping run`)
          return
        }
        await fn()
        // xact-scoped lock auto-releases when this transaction commits — no manual unlock.
      },
      { timeout: 120_000, maxWait: 5_000 },
    )
  }
}
