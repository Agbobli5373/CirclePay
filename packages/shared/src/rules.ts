/**
 * Pure CirclePay domain rules. No I/O, no framework imports — safe anywhere.
 * Encodes the rules in ../../references/business-rules.md.
 */
import type { Pesewas, Posting, PayoutTranche, Receipt, TrustScore, TrustStanding, SusuPayoutRule } from './types'

// ---------- Susu math ----------

/** A Susu runs one cycle per member. */
export function totalCycles(memberCount: number): number {
  return Math.max(0, Math.floor(memberCount))
}

/** Pot a member receives each cycle = contribution × members. */
export function cyclePayoutAmount(contribution: Pesewas, memberCount: number): Pesewas {
  return Math.round(contribution * Math.max(0, Math.floor(memberCount)))
}

/** Progress through a Susu, 0–100 (rounded). */
export function cycleProgressPercent(currentCycle: number, total: number): number {
  if (total <= 0) return 0
  return clampPercent((currentCycle / total) * 100)
}

/** Next member to be paid given a fixed order and the current cycle (1-based). Null if finished. */
export function nextPayee<T>(order: T[], currentCycle: number): T | null {
  // currentCycle is 1-based; the "next" payee is at index currentCycle (0-based) ...
  const idx = currentCycle
  return idx >= 0 && idx < order.length ? order[idx] : null
}

// ---------- Fundraiser math ----------

/** Goal progress, 0–100 (rounded), capped at 100. */
export function fundProgressPercent(raised: Pesewas, goal: Pesewas): number {
  if (goal <= 0) return 0
  return clampPercent((raised / goal) * 100)
}

// ---------- Trust ----------

/** On-time rate as 0–100 (rounded). */
export function onTimeRate(paidOnTime: number, totalDue: number): number {
  if (totalDue <= 0) return 100
  return clampPercent((paidOnTime / totalDue) * 100)
}

/**
 * Map filled trust segments (0–5) to a standing.
 * `locked` is set explicitly on default (not derivable from segments alone),
 * so pass `defaulted` to force it.
 */
export function trustStanding(segmentsFilled: number, defaulted = false): TrustStanding {
  if (defaulted) return 'locked'
  const s = Math.max(0, Math.min(5, Math.round(segmentsFilled)))
  if (s >= 5) return 'excellent'
  if (s >= 4) return 'good'
  if (s >= 2) return 'building'
  return 'new'
}

/**
 * Platform-wide defaulter protection: a locked user cannot join ANY fund.
 * This is CirclePay's core trust rule.
 */
export function canJoinFund(trust: Pick<TrustScore, 'standing'>): boolean {
  return trust.standing !== 'locked'
}

/** Higher = safer (paid earlier under trust-ordered payouts). */
export function riskRank(standing: TrustStanding): number {
  const order: Record<TrustStanding, number> = {
    locked: 0,
    new: 1,
    building: 2,
    good: 3,
    excellent: 4,
  }
  return order[standing]
}

/**
 * Trust-ordered payout sequence: safest members first, riskiest LAST — so a
 * low-trust member must contribute through most cycles before receiving the pot.
 * Shortfall-protection mechanism for `payoutRule = 'trust_ordered'`.
 */
export function orderPayoutsByTrust<T extends { standing: TrustStanding }>(members: T[]): T[] {
  return [...members].sort((a, b) => riskRank(b.standing) - riskRank(a.standing))
}

/** Deterministic PRNG seeded from a string (mulberry32) — reproducible random payout order. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Resolve the locked payout order (who is paid in which cycle) for a Susu.
 * - `rotating`      → join order (by joinedAt)
 * - `trust_ordered` → safest-first (orderPayoutsByTrust)
 * - `random`        → deterministic seeded shuffle when `seed` is given (locked in at start);
 *                     without a seed, falls back to join order (provisional display).
 */
export function resolvePayoutOrder(
  members: { userId: string; standing: TrustStanding; joinedAt: Date | string | number }[],
  rule: SusuPayoutRule,
  seed?: string,
): string[] {
  const byJoin = [...members].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
  )
  if (rule === 'trust_ordered') return orderPayoutsByTrust(byJoin).map((m) => m.userId)
  if (rule === 'random' && seed) return seededShuffle(byJoin, seed).map((m) => m.userId)
  return byJoin.map((m) => m.userId)
}

// ---------- Money formatting ----------

/** Format pesewas as a display string, e.g. 482000 → "GHS 4,820.00". */
export function formatGhs(pesewas: Pesewas, opts: { withSymbol?: boolean } = {}): string {
  const withSymbol = opts.withSymbol ?? true
  const cedis = pesewas / 100
  const formatted = cedis.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return withSymbol ? `GHS ${formatted}` : formatted
}

/** Convert whole/decimal GHS to integer pesewas (e.g. 500 → 50000). */
export function toPesewas(ghs: number): Pesewas {
  return Math.round(ghs * 100)
}

// ---------- Ledger (double-entry) ----------

/** A balanced transaction has >=2 postings whose signed amounts sum to 0. */
export function isBalanced(postings: Posting[]): boolean {
  if (postings.length < 2) return false
  return postings.reduce((sum, p) => sum + p.amount, 0) === 0
}

export function assertBalanced(postings: Posting[]): void {
  if (!isBalanced(postings)) {
    throw new Error('Ledger transaction must have >=2 postings summing to zero')
  }
}

/** Derive an account's balance by summing its postings (never store a mutable balance). */
export function accountBalance(postings: Posting[], accountId: string): Pesewas {
  return postings
    .filter((p) => p.accountId === accountId)
    .reduce((sum, p) => sum + p.amount, 0)
}

/**
 * Balanced postings for a settled contribution.
 * The payer's `amount + platformFee` lands in the Moolre float; if Moolre deducts a
 * collection fee, pass `moolreFee` + `moolreFeeAccountId` so the float reflects the
 * NET actually received and reconciles to the Moolre balance.
 */
export function contributionPostings(input: {
  moolreFloatAccountId: string
  fundPotAccountId: string
  platformFeeAccountId: string
  amount: Pesewas // contribution toward the pot
  platformFee: Pesewas
  moolreFee?: Pesewas
  moolreFeeAccountId?: string
}): Posting[] {
  const moolreFee = input.moolreFee ?? 0
  const postings: Posting[] = [
    // Net cash that actually reached the Moolre account.
    { accountId: input.moolreFloatAccountId, amount: input.amount + input.platformFee - moolreFee },
    { accountId: input.fundPotAccountId, amount: -input.amount },
    { accountId: input.platformFeeAccountId, amount: -input.platformFee },
  ]
  if (moolreFee > 0) {
    if (!input.moolreFeeAccountId) throw new Error('moolreFeeAccountId required when moolreFee > 0')
    postings.push({ accountId: input.moolreFeeAccountId, amount: moolreFee })
  }
  assertBalanced(postings)
  return postings
}

/**
 * Balanced postings for a payout from a fund pot to an external payee (member/hospital).
 * Moolre's transfer fee (if any) is booked as an expense and leaves the float too, so the
 * float reconciles to the real Moolre balance.
 */
export function payoutPostings(input: {
  moolreFloatAccountId: string
  fundPotAccountId: string
  amount: Pesewas
  moolreFee?: Pesewas
  moolreFeeAccountId?: string
}): Posting[] {
  const moolreFee = input.moolreFee ?? 0
  const postings: Posting[] = [
    { accountId: input.fundPotAccountId, amount: input.amount },
    { accountId: input.moolreFloatAccountId, amount: -(input.amount + moolreFee) },
  ]
  if (moolreFee > 0) {
    if (!input.moolreFeeAccountId) throw new Error('moolreFeeAccountId required when moolreFee > 0')
    postings.push({ accountId: input.moolreFeeAccountId, amount: moolreFee })
  }
  assertBalanced(postings)
  return postings
}

/**
 * Balanced postings for a settled member deposit (the safety buffer collected on join).
 * Cash lands in the Moolre float; the member's `deposit` account holds it as a liability
 * (negative balance = we owe it back), mirroring how the pot holds contributions.
 */
export function depositPostings(input: {
  moolreFloatAccountId: string
  depositAccountId: string
  amount: Pesewas
  moolreFee?: Pesewas
  moolreFeeAccountId?: string
}): Posting[] {
  const moolreFee = input.moolreFee ?? 0
  const postings: Posting[] = [
    { accountId: input.moolreFloatAccountId, amount: input.amount - moolreFee },
    { accountId: input.depositAccountId, amount: -input.amount },
  ]
  if (moolreFee > 0) {
    if (!input.moolreFeeAccountId) throw new Error('moolreFeeAccountId required when moolreFee > 0')
    postings.push({ accountId: input.moolreFeeAccountId, amount: moolreFee })
  }
  assertBalanced(postings)
  return postings
}

/**
 * Balanced postings that cover a cycle shortfall when a member defaults: draw from the
 * defaulter's held `deposit` first, then the `safety_pool`, into the fund pot — so the
 * cycle's payee is still paid in full. Consuming a holding moves it toward zero (+used),
 * and the pot fills (−used), exactly as if the member had contributed.
 * Order/availability is decided by the caller (deposit before pool); pass only what's used.
 */
export function shortfallPostings(input: {
  fundPotAccountId: string
  depositAccountId: string
  depositUsed: Pesewas
  safetyPoolAccountId?: string
  poolUsed?: Pesewas
}): Posting[] {
  const poolUsed = input.poolUsed ?? 0
  const postings: Posting[] = []
  if (input.depositUsed > 0) postings.push({ accountId: input.depositAccountId, amount: input.depositUsed })
  if (poolUsed > 0) {
    if (!input.safetyPoolAccountId) throw new Error('safetyPoolAccountId required when poolUsed > 0')
    postings.push({ accountId: input.safetyPoolAccountId, amount: poolUsed })
  }
  postings.push({ accountId: input.fundPotAccountId, amount: -(input.depositUsed + poolUsed) })
  assertBalanced(postings)
  return postings
}

// ---------- Medical payout tranches ----------

/**
 * Split a total into `n` tranches (pesewas), front-loading any rounding remainder
 * onto the LAST tranche so the sum is exact.
 */
export function splitIntoTranches(total: Pesewas, n: number): Pesewas[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  const tranches = Array.from({ length: n }, () => base)
  tranches[n - 1] += total - base * n
  return tranches
}

/**
 * Can the next tranche be released? The first tranche is always releasable (once the
 * payee is verified, checked elsewhere). Every later tranche requires the PRIOR tranche
 * to have a verified stamped receipt — the escrow + proof-of-use gate for cash payouts.
 */
export function canReleaseNextTranche(tranches: PayoutTranche[], receipts: Receipt[]): boolean {
  const released = tranches.filter((t) => t.status !== 'held')
  if (released.length === 0) return true // first release
  const prior = released[released.length - 1]
  return receipts.some(
    (r) => r.trancheId === prior.id && r.kind === 'receipt' && r.status === 'verified',
  )
}

// ---------- Internal ----------

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
