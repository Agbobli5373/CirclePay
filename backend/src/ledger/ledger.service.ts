import { Injectable } from '@nestjs/common'
import { Prisma, LedgerAccountType, LedgerTxKind } from '@prisma/client'
import { assertBalanced } from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'

export type PostingInput = { accountId: string; amount: number }
export type LedgerTxInput = {
  kind: LedgerTxKind
  externalref?: string
  reference?: string
  postings: PostingInput[]
}

/**
 * Append-only double-entry ledger.
 * - Balances are DERIVED (sum of postings) — never stored mutably.
 * - Every transaction's postings must sum to zero (assertBalanced).
 * - Only this service writes LedgerTransaction/Posting rows.
 *
 * See circlepay-domain/references/ledger.md for the full accounting model.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Get or create a ledger account.
   * Singleton accounts (moolre_float, platform_fee, safety_pool, moolre_fee, treasury)
   * use ownerId = 'GLOBAL'.
   */
  async getOrCreateAccount(type: LedgerAccountType, ownerId = 'GLOBAL') {
    return this.db.ledgerAccount.upsert({
      where: { type_ownerId: { type, ownerId } },
      create: { type, ownerId },
      update: {},
    })
  }

  /**
   * Post a balanced ledger transaction.
   * Pass an existing Prisma transaction client (`tx`) to atomically co-commit
   * with state changes (contribution settled, payout settled, etc.).
   * If `tx` is omitted, runs in its own transaction.
   */
  async post(
    input: LedgerTxInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    assertBalanced(input.postings)

    const run = async (client: Prisma.TransactionClient) => {
      const txRow = await client.ledgerTransaction.create({
        data: {
          kind: input.kind,
          externalref: input.externalref,
          reference: input.reference,
          postings: {
            create: input.postings.map((p) => ({
              accountId: p.accountId,
              amount: p.amount,
            })),
          },
        },
      })
      return txRow
    }

    if (tx) {
      await run(tx)
    } else {
      await this.db.$transaction(run)
    }
  }

  /** Derive an account's balance by summing its postings (no mutable balance field). */
  async balance(accountId: string): Promise<number> {
    const agg = await this.db.posting.aggregate({
      where: { accountId },
      _sum: { amount: true },
    })
    return agg._sum.amount ?? 0
  }

  /**
   * Convenience: ensure all singleton accounts exist (called once at boot).
   * Feature services call getOrCreateAccount for fund-scoped accounts as needed.
   */
  async ensureSingletons(): Promise<void> {
    const singletons: LedgerAccountType[] = [
      LedgerAccountType.moolre_float,
      LedgerAccountType.platform_fee,
      LedgerAccountType.safety_pool,
      LedgerAccountType.moolre_fee,
      LedgerAccountType.treasury,
    ]
    await Promise.all(singletons.map((t) => this.getOrCreateAccount(t)))
  }
}
