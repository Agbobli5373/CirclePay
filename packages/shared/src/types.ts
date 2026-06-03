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
export type SusuPayoutRule = 'rotating' | 'random' | 'trust_ordered'
export type PayoutRule = SusuPayoutRule | 'direct' // 'direct' = Medical → verified hospital
/** Member's standing within a specific fund (distinct from per-cycle MemberStatus). */
export type MemberFundStatus = 'active' | 'grace' | 'defaulted' | 'left' | 'completed'
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
  /** Per-cycle payment status. */
  status: MemberStatus
  /** Fund-level standing (active/grace/defaulted/…). */
  fundStatus?: MemberFundStatus
  /** Whether the join deposit has been paid (when the fund requires one). */
  depositPaid?: boolean
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
  /** Shortfall protection: require a refundable deposit at join. */
  requiresDeposit: boolean
  depositAmount: Pesewas
  currentCycle: number
  /** Always equals memberCount. */
  totalCycles: number
  members: Member[]
  cycles: Cycle[]
}

// ---------- Medical payout routing (cash-aware, tiered) ----------

export type MedicalPayoutRoute =
  | 'hospital_momo' // verified hospital MoMo merchant
  | 'hospital_bank' // hospital bank account (Moolre channel 2)
  | 'individual_cash' // KYC'd patient/next-of-kin MoMo (cash-only facilities)

export type PayeeVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
export type TrancheStatus = 'held' | 'released' | 'settled' | 'refunded'
export type ReceiptKind = 'proforma' | 'receipt' // bill up front vs stamped receipt after
export type ReceiptStatus = 'submitted' | 'verified' | 'rejected'

export interface Payee {
  /** Hospital name or individual (patient/next-of-kin) name. */
  name: string
  route: MedicalPayoutRoute
  /** Destination MoMo number (hospital merchant or individual). */
  momo?: string
  /** Destination bank account (route = hospital_bank). */
  bankAccount?: string
  /** For individual_cash: relation to the patient (self/parent/sibling…). */
  relationToPatient?: string
  verificationStatus: PayeeVerificationStatus
}

export interface PayoutTranche {
  id: string
  fundId: string
  amount: Pesewas
  status: TrancheStatus
  /** The receipt proving the prior tranche was used (gates the next release). */
  receiptId?: string
  externalref?: string // Moolre link when released
  releasedAt?: string
}

export interface Receipt {
  id: string
  fundId: string
  trancheId?: string
  kind: ReceiptKind
  docUrl: string
  uploadedBy: string // userId
  status: ReceiptStatus
  verifiedBy?: string // ops userId
  ts: string
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
  /** Always 'direct' for fundraisers; the destination is described by `payee`/`payoutRoute`. */
  payoutRule: 'direct'
  payoutRoute: MedicalPayoutRoute
  payee: Payee
  /** Escrow + receipt-gated tranches required (default true for individual_cash / high-value). */
  requiresReceipts: boolean
  /** Caps (pesewas) applied while unverified / low-trust organizer. */
  firstTrancheCap?: Pesewas
  totalCap?: Pesewas
  tranches?: PayoutTranche[]
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

// ---------- Ledger (double-entry) ----------

export type LedgerAccountType =
  | 'moolre_float' // asset: money actually in the Moolre account
  | 'platform_fee' // income: fees collected
  | 'fund_pot' // liability: owed to a Susu cycle / fundraiser goal
  | 'member' // optional per-user sub-ledger
  | 'deposit' // refundable member collateral held against default
  | 'safety_pool' // mutual-insurance buffer that covers shortfalls
  | 'moolre_fee' // expense: fees charged by Moolre on collect/transfer
  | 'treasury' // CirclePay's own bank/wallet (where net income settles)
  | 'hospital' // external medical payee
  | 'beneficiary' // external fundraiser payee

export type LedgerTxKind = 'contribution' | 'payout' | 'fee' | 'reversal' | 'adjustment'

export interface LedgerAccount {
  id: string
  type: LedgerAccountType
  /** userId / fundId; "GLOBAL" for singletons (moolre_float, platform_fee). */
  ownerId: string
}

export interface Posting {
  accountId: string
  /** Signed pesewas: positive = into account, negative = out. */
  amount: Pesewas
}

/** Append-only. `postings` has >=2 entries that sum to 0. */
export interface LedgerTransaction {
  id: string
  kind: LedgerTxKind
  postings: Posting[]
  /** Links to the Moolre movement for reconciliation. */
  externalref?: string
  reference?: string
  ts: string
}

// ---------- Domain events (transactional outbox) ----------

export type DomainEventType =
  | 'ContributionSettled'
  | 'CycleFunded'
  | 'PayoutSettled'
  | 'MemberOverdue'
  | 'MemberInGrace'
  | 'MemberDefaulted'
  | 'ShortfallCovered'
  | 'FundCompleted'
  | 'PayeeVerified'
  | 'TrancheReleased'
  | 'ReceiptSubmitted'
  | 'MedicalFundRefunded'

export type OutboxStatus = 'pending' | 'dispatched' | 'failed'

export interface DomainEvent<T = unknown> {
  id: string
  type: DomainEventType
  payload: T
  status: OutboxStatus
  attempts: number
  createdAt: string
  dispatchedAt?: string
}

// ---------- Type guards ----------

export function isSusuFund(f: Fund): f is SusuFund {
  return f.type === 'Susu'
}

export function isFundraiserFund(f: Fund): f is FundraiserFund {
  return f.type !== 'Susu'
}
