import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { LockService } from './lock.service'

export type EventHandler = (payload: unknown) => Promise<void>

// Advisory lock key — arbitrary stable integer, unique per job.
const OUTBOX_LOCK_KEY = 1_001

// Max delivery attempts before a row is marked 'failed'.
const MAX_ATTEMPTS = 5

// Exponential backoff base in ms (attempt 1 → 5 s, attempt 2 → 10 s, …).
const BACKOFF_BASE_MS = 5_000

/**
 * OutboxDispatcher — polls the outbox table and delivers events to handlers.
 *
 * Single-flight: wrapped in a Postgres advisory lock so only one instance
 * processes the batch even when multiple backends are running.
 *
 * Handlers must be idempotent (key on externalref / event id).
 */
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name)
  private readonly handlers = new Map<string, EventHandler>()

  constructor(
    private readonly db: PrismaService,
    private readonly lock: LockService,
  ) {}

  /** Register a handler for a DomainEventType. Call from feature module init. */
  register(type: string, handler: EventHandler): void {
    this.handlers.set(type, handler)
    this.logger.log(`Registered handler for ${type}`)
  }

  /** Run every 5 seconds, single-flight via Postgres advisory lock. */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async dispatch(): Promise<void> {
    await this.lock.tryWithLock(OUTBOX_LOCK_KEY, () => this.processBatch())
  }

  private async processBatch(): Promise<void> {
    const events = await this.db.outboxEvent.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    for (const event of events) {
      const handler = this.handlers.get(event.type)
      if (!handler) {
        this.logger.warn(`No handler for event type: ${event.type}`)
        continue
      }

      try {
        await handler(event.payload)
        await this.db.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'dispatched', dispatchedAt: new Date() },
        })
      } catch (err) {
        const attempts = event.attempts + 1
        const nextRetryMs = BACKOFF_BASE_MS * attempts
        const isFailed = attempts >= MAX_ATTEMPTS

        this.logger.error(
          `Event ${event.id} (${event.type}) failed attempt ${attempts}: ${(err as Error).message}`,
        )

        await this.db.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts,
            status: isFailed ? 'failed' : 'pending',
            // Re-schedule by bumping createdAt so it sorts to the back.
            createdAt: new Date(Date.now() + nextRetryMs),
          },
        })
      }
    }
  }
}
