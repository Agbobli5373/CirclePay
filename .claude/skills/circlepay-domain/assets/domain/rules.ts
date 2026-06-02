/**
 * Pure CirclePay domain rules. No I/O, no framework imports — safe anywhere.
 * Encodes the rules in ../../references/business-rules.md.
 */
import type { Pesewas, TrustScore, TrustStanding } from './types'

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

// ---------- Internal ----------

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
