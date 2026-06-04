# Entities & Enums (as built)

Canonical shapes live in `assets/domain/types.ts`. This doc explains them and their relationships. Money: store integer **pesewas** (GHS×100); the current demo UI uses whole-GHS numbers.

## Enums

| Enum | Values |
|---|---|
| `FundType` | `Susu`, `Medical`, `Education`, `Business` |
| `FundStatus` | `active`, `completed`, `cancelled` |
| `PoolStatus` | `active`, `planning`, `completed` |
| `MemberStatus` (per cycle) | `paid`, `pending`, `overdue` |
| `MemberFundStatus` (per fund) | `active`, `grace`, `defaulted`, `left`, `completed` |
| `PayoutRule` | `rotating`, `random`, `trust_ordered` (Susu); `direct` (Medical) |
| `MedicalPayoutRoute` | `hospital_momo`, `hospital_bank`, `individual_cash` |
| `PayeeVerificationStatus` | `unverified`, `pending`, `verified`, `rejected` |
| `TrancheStatus` | `held`, `released`, `settled`, `refunded` |
| `ReceiptKind` / `ReceiptStatus` | `proforma`/`receipt` ; `submitted`/`verified`/`rejected` |
| `Frequency` | `weekly`, `monthly` |
| `ContributionStatus` | `initiated`, `settled`, `failed` |
| `PayoutStatus` | `initiated`, `settled`, `failed` |
| `ActivityType` | `contribution`, `payout`, `donation`, `joined` |
| `LedgerAccountType` | `moolre_float`, `platform_fee`, `fund_pot`, `member`, `deposit`, `safety_pool`, `moolre_fee`, `treasury`, `hospital`, `beneficiary` |
| `LedgerTxKind` | `contribution`, `payout`, `fee`, `reversal`, `adjustment` |
| `DomainEventType` | `ContributionSettled`, `CycleFunded`, `PayoutSettled`, `MemberOverdue`, `MemberInGrace`, `MemberDefaulted`, `ShortfallCovered`, `FundCompleted`, `PayeeVerified`, `TrancheReleased`, `ReceiptSubmitted`, `MedicalFundRefunded` |
| `OutboxStatus` | `pending`, `dispatched`, `failed` |
| `Network` | `MTN`, `Telecel`, `AirtelTigo` |
| `TrustStanding` | `new`, `building`, `good`, `excellent`, `locked` |

## Entities

### User
The account holder. `id`, `name` (e.g. "Ama Asante"), `phone` (+233, Ghana Card-verified MoMo), `network`, `location` (e.g. "Kumasi, Ashanti Region"), `trustScore`. Has many `Member` seats and initiates `Contribution`s/`Payout`s.

### Fund (base)
`id`, `name`, `type: FundType`, `status: FundStatus`, `createdBy`, `createdAt`. Specialized by type:

- **SusuFund** adds: `contribution` (per cycle, pesewas), `frequency`, `memberCount`, `startDate`, `payoutRule` (`rotating`|`random`|`trust_ordered`), `requiresDeposit` + `depositAmount` (shortfall protection), `currentCycle`, `totalCycles` (= `memberCount`), `startedAt?` (set when the fund fills — locks the member list + payout order), `payoutOrder?` (locked `userId[]`, resolved at start including the random shuffle), `members: Member[]`, `cycles: Cycle[]`. Join is **invite-only** (see business-rules); `requiresDeposit=true` is currently rejected at create (deposit collection deferred).
- **MedicalFund / FundraiserFund** (and Education/Business goal funds) adds: `goal` (pesewas), `raised` (pesewas), `beneficiary`, `hospital?` + `hospitalVerified`, `story`, `deadline?`, `shareable` (public link), `payoutRoute` (`MedicalPayoutRoute`), `payee` (`Payee`), `requiresReceipts`, `firstTrancheCap?`/`totalCap?`, `tranches?`, `contributors: Contributor[]`. See `references/medical-payouts.md`.

### Medical payout entities (see `references/medical-payouts.md`)
- **Payee** — `name`, `route`, `momo?`/`bankAccount?`, `relationToPatient?`, `verificationStatus`.
- **PayoutTranche** — `id`, `fundId`, `amount`, `status: TrancheStatus`, `receiptId?`, `externalref?`, `releasedAt?`.
- **Receipt** — `id`, `fundId`, `trancheId?`, `kind: ReceiptKind`, `docUrl`, `uploadedBy`, `status: ReceiptStatus`, `verifiedBy?`, `ts`.

### Pool
A Susu group instance: `id`, `name`, `status: PoolStatus`, `members`/`maxMembers`, `monthlyAmount`, `cycleLength`, `location`, `admin`, `isAdmin?`, `nextPayout?`. (In a full model, a Pool is the operational view of a SusuFund.)

### Member
A user's seat in a Susu: `userId`, `fundId`, `name`, `trustTag` (`reliable`|`new`), per-cycle `status: MemberStatus`, `dueAt?` (this cycle's contribution deadline, set from cadence at start/advance and used by the trust sweep), fund-level `fundStatus: MemberFundStatus`, `paidAt?`, and `depositPaid?`.

### Invite
A pending membership invite (invite-only join): `id`, `fundId`, `phone`, `token` (unique, shareable via `/join/<token>`), `status` (`pending`|`accepted`|`expired`), `createdAt`. Accepting requires the caller's MoMo number to match `phone`.

### Cycle
One round: `index` (1..N), `payeeUserId`, `amount` (pot = contribution × members), `status` (`completed`|`current`|`upcoming`), `isYou?`.

### Contribution
Money in: `id`, `fundId`, `userId`, `cycle?`, `amount`, `fee`, `total`, `network`, `externalref` (Moolre idempotency key), `status: ContributionStatus`, `reference`, `ts`, `settledAt?`, `receiptSentAt?` (SMS-receipt idempotency).

### Payout
Money out: `id`, `fundId`, `cycle?`, `payeeUserId | hospital`, `amount`, `externalref`, `status: PayoutStatus`, `transactionId?`, `ts`, `settledAt?`.

### Contributor
A giver on a fundraiser: `name | "Anonymous"`, `amount`, `when`, `anonymous: boolean`.

### TrustScore
Per user: `segmentsFilled` (0–5), `standing: TrustStanding`, `fundsCompleted`, `onTimeRate` (0–100), `activeFunds`, plus the counters that drive the rate: `contributionsTotal` and `contributionsOnTime` (`onTimeRate = round(onTime/total·100)`, updated on each settled contribution). `standing` becomes `locked` on default (platform-wide) and is restored on appeal.

### ActivityItem
Feed entry: `id`, `type: ActivityType`, `title`, `detail`, `amount?`, `direction` (`in`|`out`), `date`, `reference?`. (A UX feed — **not** the accounting ledger.)

### Ledger & events (see `references/ledger.md`)
- **LedgerAccount** — `id`, `type: LedgerAccountType`, `ownerId` (userId/fundId, or `"GLOBAL"` for singletons).
- **LedgerTransaction** — append-only; `kind: LedgerTxKind`, `postings: Posting[]` (≥2, signed pesewas summing to 0), `externalref?` (Moolre link), `ts`.
- **Posting** — `accountId`, `amount` (signed pesewas).
- **DomainEvent** (outbox) — `id`, `type: DomainEventType`, `payload`, `status: OutboxStatus`, `attempts`, `createdAt`, `dispatchedAt?`.
- Balances/`raised` are **derived** from postings, never stored mutably.

## Relationships (summary)

- `User 1—* Member`, `Fund 1—* Member` (Susu).
- `SusuFund 1—* Cycle`; each `Cycle` has one payee `User` and many `Contribution`s.
- `MedicalFund 1—* Contributor`, `1—1 beneficiary`, `0..1 hospital`.
- `User 1—1 TrustScore`.
- `Contribution`/`Payout` ←→ Moolre transaction via `externalref` (see `moolre-integration`).
