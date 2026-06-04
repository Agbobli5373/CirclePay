import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

/**
 * OutboxService — write domain events into the transactional outbox.
 *
 * ALWAYS call emit() inside the same Prisma transaction as the state change.
 * The dispatcher delivers events asynchronously and idempotently.
 *
 * See circlepay-domain/references/ledger.md (Domain events section).
 */
@Injectable()
export class OutboxService {
  /**
   * Emit a domain event atomically with a state change.
   *
   * @param type   DomainEventType string (e.g. 'ContributionSettled')
   * @param payload  Any serialisable data the handler will need
   * @param tx       The active Prisma transaction client — REQUIRED for atomicity
   */
  async emit(
    type: string,
    payload: unknown,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        status: 'pending',
        attempts: 0,
      },
    })
  }
}
