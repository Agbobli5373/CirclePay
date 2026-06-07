import type { Prisma } from '@prisma/client'
import type { OutboxService } from '../outbox/outbox.service'

/**
 * Emit `CycleFunded` exactly once when every member's obligation for the current
 * cycle is met — either paid directly, or covered by a shortfall draw on a
 * defaulter's deposit / safety-pool (coverage leaves the member at status='paid').
 *
 * Shared by the contribution settler and the default-coverage sweep so the
 * "is this cycle funded?" test stays identical in both places. The caller passes
 * the active Prisma transaction client; this reads/writes within it.
 *
 * Counts `status='paid'` across all seats (not just `fundStatus='active'`) so a
 * covered defaulter counts. Member leave/replacement isn't part of the MVP, so a
 * stale 'paid' from a departed member can't inflate the count.
 *
 * Returns true if it emitted CycleFunded.
 */
export async function emitCycleFundedIfReady(
  tx: Prisma.TransactionClient,
  outbox: OutboxService,
  fundId: string,
): Promise<boolean> {
  const susu = await tx.susuDetail.findUnique({ where: { fundId } })
  if (!susu) return false

  const settledCount = await tx.member.count({ where: { fundId, status: 'paid' } })
  if (settledCount < susu.memberCount) return false

  const cycle = susu.currentCycle
  const order = Array.isArray(susu.payoutOrder) ? (susu.payoutOrder as string[]) : []
  const payeeUserId = order[cycle - 1] ?? null
  if (!payeeUserId) return false

  const existingPayout = await tx.payout.findUnique({ where: { externalref: `p:${fundId}:${cycle}` } })
  if (existingPayout) return false

  await outbox.emit('CycleFunded', { fundId, cycle, payeeUserId }, tx)
  return true
}
