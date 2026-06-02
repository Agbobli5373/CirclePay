# Data Model (Prisma → Postgres)

Maps the `circlepay-domain` entities to tables. Full starter in `assets/schema.prisma`. **All money columns are `Int` (pesewas).**

## Tables (summary)

- **User** — `id`, `name`, `phone` (unique), `network`, `location?`, `pinHash`, timestamps. 1—1 `TrustScore`. 1—* `Member`, `Contribution`, `Payout`.
- **OtpRequest** — `id`, `phone`, `codeHash`, `expiresAt`, `attempts`, `consumedAt?`. For the auth flow (short-lived).
- **Fund** — `id`, `name`, `type` (`Susu|Medical|Education|Business`), `status`, `createdById`, timestamps. Type-specific columns nullable, or split:
  - **SusuDetail** (1—1 with Fund where type=Susu) — `contribution` (Int), `frequency`, `memberCount`, `startDate`, `payoutRule` (`rotating|random`), `currentCycle`, `totalCycles`.
  - **FundraiserDetail** (1—1 where type≠Susu) — `goal` (Int), `raised` (Int), `beneficiary`, `hospital?`, `hospitalVerified`, `story?`, `deadline?`, `shareable`, `slug` (unique, public page).
- **Member** — `id`, `fundId`, `userId`, `trustTag?`, `status` (`paid|pending|overdue`), `paidAt?`, `dueAt?`. Unique (`fundId`,`userId`).
- **Cycle** — `id`, `fundId`, `index`, `payeeUserId`, `amount` (Int pot), `status` (`completed|current|upcoming`). Unique (`fundId`,`index`).
- **Contribution** — `id`, `fundId`, `userId`, `cycle?`, `amount`, `fee`, `total` (Int), `network`, `externalref` (**unique**), `status` (`initiated|settled|failed`), `transactionId?`, `reference?`, `ts`.
- **Payout** — `id`, `fundId`, `cycle?`, `payeeUserId?`, `hospital?`, `amount` (Int), `externalref` (**unique**), `status`, `transactionId?`, `ts`.
- **Contributor** — `id`, `fundId`, `displayName`, `amount` (Int), `anonymous`, `userId?`, `ts`.
- **TrustScore** — `userId` (1—1), `segmentsFilled`, `standing` (`new|building|good|excellent|locked`), `fundsCompleted`, `onTimeRate`, `activeFunds`.
- **ActivityItem** — `id`, `userId`, `type` (`contribution|payout|donation|joined`), `title`, `detail`, `amount?`, `direction?`, `reference?`, `createdAt`. (UX feed, **not** accounting.)

### Ledger (double-entry, append-only) — see `circlepay-domain/references/ledger.md`
- **LedgerAccount** — `id`, `type` (`moolre_float|platform_fee|fund_pot|member|hospital|beneficiary`), `ownerId` (userId/fundId; `"GLOBAL"` for singletons). Unique (`type`,`ownerId`).
- **LedgerTransaction** — `id`, `kind` (`contribution|payout|fee|reversal|adjustment`), `externalref?`, `reference?`, `ts`. Append-only.
- **Posting** — `id`, `txId`, `accountId`, `amount` (**signed Int pesewas**). A transaction's postings sum to 0; balances are derived (`SUM(amount)` per account), never stored. Corrections = new `reversal`/`adjustment` transactions.

### OutboxEvent (transactional outbox)
- `id`, `type` (DomainEventType), `payload` (Json), `status` (`pending|dispatched|failed`), `attempts`, `createdAt`, `dispatchedAt?`. Index (`status`,`createdAt`).

## Key constraints / indexes

- `Contribution.externalref` and `Payout.externalref` **unique** (idempotency with Moolre).
- `User.phone` unique; `FundraiserDetail.slug` unique (public share URL).
- `LedgerAccount(type, ownerId)` **unique**; index `Posting(accountId)`, `LedgerTransaction(externalref)`, `OutboxEvent(status, createdAt)`.
- Index `Member(fundId)`, `Cycle(fundId, index)`, `Contribution(fundId, status)`, `ActivityItem(userId, createdAt)`.

## Enums

Mirror `circlepay-domain` (`assets/domain/types.ts`): `FundType`, `FundStatus`, `MemberStatus`, `SusuPayoutRule`, `Frequency`, `ContributionStatus`, `PayoutStatus`, `ActivityType`, `Direction`, `Network`, `TrustStanding`.

## Notes

- Prefer the **split-detail** modeling (SusuDetail / FundraiserDetail) over a wide nullable Fund table for clarity, or use Prisma's single-table with nullable groups if you prefer fewer joins — either is fine, keep it consistent.
- `totalCycles === memberCount` (enforce in service, see `circlepay-domain` rules).
