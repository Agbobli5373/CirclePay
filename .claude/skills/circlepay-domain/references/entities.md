# Entities & Enums (as built)

Canonical shapes live in `assets/domain/types.ts`. This doc explains them and their relationships. Money: store integer **pesewas** (GHS×100); the current demo UI uses whole-GHS numbers.

## Enums

| Enum | Values |
|---|---|
| `FundType` | `Susu`, `Medical`, `Education`, `Business` |
| `FundStatus` | `active`, `completed`, `cancelled` |
| `PoolStatus` | `active`, `planning`, `completed` |
| `MemberStatus` (per cycle) | `paid`, `pending`, `overdue` |
| `PayoutRule` | `rotating`, `random` (Susu); `direct` (Medical → hospital) |
| `Frequency` | `weekly`, `monthly` |
| `ContributionStatus` | `initiated`, `settled`, `failed` |
| `PayoutStatus` | `initiated`, `settled`, `failed` |
| `ActivityType` | `contribution`, `payout`, `donation`, `joined` |
| `LedgerAccountType` | `moolre_float`, `platform_fee`, `fund_pot`, `member`, `hospital`, `beneficiary` |
| `LedgerTxKind` | `contribution`, `payout`, `fee`, `reversal`, `adjustment` |
| `DomainEventType` | `ContributionSettled`, `CycleFunded`, `PayoutSettled`, `MemberOverdue`, `MemberDefaulted`, `FundCompleted` |
| `OutboxStatus` | `pending`, `dispatched`, `failed` |
| `Network` | `MTN`, `Telecel`, `AirtelTigo` |
| `TrustStanding` | `new`, `building`, `good`, `excellent`, `locked` |

## Entities

### User
The account holder. `id`, `name` (e.g. "Ama Asante"), `phone` (+233, Ghana Card-verified MoMo), `network`, `location` (e.g. "Kumasi, Ashanti Region"), `trustScore`. Has many `Member` seats and initiates `Contribution`s/`Payout`s.

### Fund (base)
`id`, `name`, `type: FundType`, `status: FundStatus`, `createdBy`, `createdAt`. Specialized by type:

- **SusuFund** adds: `contribution` (per cycle, pesewas), `frequency`, `memberCount`, `startDate`, `payoutRule` (`rotating`|`random`), `currentCycle`, `totalCycles` (= `memberCount`), `members: Member[]`, `cycles: Cycle[]`.
- **MedicalFund** (and Education/Business goal funds) adds: `goal` (pesewas), `raised` (pesewas), `beneficiary`, `hospital?` + `hospitalVerified`, `story`, `deadline?`, `shareable` (public link), `contributors: Contributor[]`.

### Pool
A Susu group instance: `id`, `name`, `status: PoolStatus`, `members`/`maxMembers`, `monthlyAmount`, `cycleLength`, `location`, `admin`, `isAdmin?`, `nextPayout?`. (In a full model, a Pool is the operational view of a SusuFund.)

### Member
A user's seat in a Susu: `userId`, `fundId`, `name`, `trustTag` (`reliable`|`new`), and per-cycle `status: MemberStatus` with `paidAt?`/`dueIn?`/`overdueSince?`.

### Cycle
One round: `index` (1..N), `payeeUserId`, `amount` (pot = contribution × members), `status` (`completed`|`current`|`upcoming`), `isYou?`.

### Contribution
Money in: `id`, `fundId`, `userId`, `cycle?`, `amount`, `fee`, `total`, `network`, `externalref` (Moolre idempotency key), `status: ContributionStatus`, `reference`, `ts`.

### Payout
Money out: `id`, `fundId`, `cycle?`, `payeeUserId | hospital`, `amount`, `externalref`, `status: PayoutStatus`, `transactionId?`, `ts`.

### Contributor
A giver on a fundraiser: `name | "Anonymous"`, `amount`, `when`, `anonymous: boolean`.

### TrustScore
Per user: `segmentsFilled` (0–5), `standing: TrustStanding`, `fundsCompleted`, `onTimeRate` (0–100), `activeFunds`. Demo profile: 4/5 segments, *Good standing*, 7 completed, 96% on-time, 3 active.

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
