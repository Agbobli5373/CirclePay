/**
 * CirclePay canonical domain model.
 *
 * Import these types instead of re-declaring fund/contribution/etc. shapes.
 * Framework-agnostic; safe to copy into the app (e.g. frontend/lib/domain) or a backend.
 *
 * MONEY CONVENTION: store amounts as integer `Pesewas` (GHS × 100) to avoid float drift.
 * Format for display with `formatGhs` (see ./rules.ts). The current demo UI uses whole-GHS
 * numbers; new/persistent code should use Pesewas.
 */

/** Integer minor units of GHS (1 GHS = 100 pesewas). */
export type Pesewas = number

// ---------- Enums (string unions) ----------

export type FundType = 'Susu' | 'Medical' | 'Education' | 'Business'
export type FundStatus = 'active' | 'completed' | 'cancelled'
export type PoolStatus = 'active' | 'planning' | 'completed'
/** A member's status within the current cycle. */
export type MemberStatus = 'paid' | 'pending' | 'overdue'
export type SusuPayoutRule = 'rotating' | 'random'
export type PayoutRule = SusuPayoutRule | 'direct' // 'direct' = Medical → verified hospital
export type Frequency = 'weekly' | 'monthly'
export type ContributionStatus = 'initiated' | 'settled' | 'failed'
export type PayoutStatus = 'initiated' | 'settled' | 'failed'
export type ActivityType = 'contribution' | 'payout' | 'donation' | 'joined'
export type Direction = 'in' | 'out'
export type Network = 'MTN' | 'Telecel' | 'AirtelTigo'
export type TrustStanding = 'new' | 'building' | 'good' | 'excellent' | 'locked'
export type TrustTag = 'reliable' | 'new'
export type CycleStatus = 'completed' | 'current' | 'upcoming'

// ---------- Core entities ----------

export interface TrustScore {
  /** Filled segments out of 5. */
  segmentsFilled: number
  standing: TrustStanding
  fundsCompleted: number
  /** On-time contribution rate, 0–100. */
  onTimeRate: number
  activeFunds: number
}

export interface User {
  id: string
  name: string
  /** E.164-ish, e.g. "+233241234567". */
  phone: string
  network: Network
  location?: string
  trustScore: TrustScore
}

export interface FundBase {
  id: string
  name: string
  type: FundType
  status: FundStatus
  createdBy: string
  createdAt: string
}

export interface Member {
  userId: string
  fundId: string
  name: string
  trustTag?: TrustTag
  status: MemberStatus
  paidAt?: string
  dueIn?: string
  overdueSince?: string
}

export interface Cycle {
  /** 1-based cycle number. */
  index: number
  payeeUserId: string
  payeeName: string
  /** Pot = contribution × memberCount. */
  amount: Pesewas
  status: CycleStatus
  isYou?: boolean
}

export interface SusuFund extends FundBase {
  type: 'Susu'
  contribution: Pesewas
  frequency: Frequency
  memberCount: number
  startDate: string
  payoutRule: SusuPayoutRule
  currentCycle: number
  /** Always equals memberCount. */
  totalCycles: number
  members: Member[]
  cycles: Cycle[]
}

/** Medical/Education/Business goal-based fundraisers share this shape. */
export interface FundraiserFund extends FundBase {
  type: 'Medical' | 'Education' | 'Business'
  goal: Pesewas
  raised: Pesewas
  beneficiary: string
  hospital?: string
  hospitalVerified?: boolean
  story?: string
  deadline?: string
  shareable: boolean
  payoutRule: 'direct'
  contributors: Contributor[]
}

export type Fund = SusuFund | FundraiserFund

/** Operational view of a Susu group. */
export interface Pool {
  id: string
  name: string
  status: PoolStatus
  members: number
  maxMembers: number
  monthlyAmount: Pesewas
  cycleLength: number
  location: string
  admin: string
  isAdmin?: boolean
  nextPayout?: string
}

export interface Contributor {
  name: string // "Anonymous" when anonymous
  amount: Pesewas
  when: string
  anonymous: boolean
}

export interface Contribution {
  id: string
  fundId: string
  userId: string
  cycle?: number
  amount: Pesewas
  fee: Pesewas
  total: Pesewas
  network: Network
  /** Moolre idempotency key. */
  externalref: string
  status: ContributionStatus
  reference?: string
  ts: string
}

export interface Payout {
  id: string
  fundId: string
  cycle?: number
  /** Set for Susu payouts. */
  payeeUserId?: string
  /** Set for Medical payouts (the verified hospital). */
  hospital?: string
  amount: Pesewas
  externalref: string
  status: PayoutStatus
  transactionId?: string
  ts: string
}

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  detail: string
  amount?: Pesewas
  direction?: Direction
  date: string
  reference?: string
}

// ---------- Type guards ----------

export function isSusuFund(f: Fund): f is SusuFund {
  return f.type === 'Susu'
}

export function isFundraiserFund(f: Fund): f is FundraiserFund {
  return f.type !== 'Susu'
}
