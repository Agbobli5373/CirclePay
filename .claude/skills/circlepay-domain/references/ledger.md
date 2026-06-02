# Money Ledger & Domain Events

CirclePay records every money movement in an **append-only double-entry ledger** and reacts to settlement via a **transactional outbox** of domain events. This gives auditability (the trust story) and reliable, decoupled side effects. Persistence lives in the `circlepay-stack` skill; this doc defines the semantics.

## Why a ledger if we "never hold the money"?

CirclePay is **non-custodial** — money flows payer → payee/hospital via Moolre, only pooled briefly in the **Moolre account** during a Susu cycle. So the ledger is an **audit/record ledger that mirrors and reconciles against Moolre**, not a custodial wallet. The `moolre_float` account represents the real balance sitting in the Moolre account; it must reconcile to Moolre `account/status`.

## Accounts (`LedgerAccountType`)

| Account | Kind | Owner | Meaning |
|---|---|---|---|
| `moolre_float` | asset | GLOBAL | Money actually held in the Moolre account |
| `platform_fee` | income | GLOBAL | Fees collected |
| `fund_pot` | liability | fundId | Funds owed to a Susu cycle / a fundraiser's goal |
| `member` | sub-ledger | userId | A member's position (optional, for per-user views) |
| `hospital` | external | fundId/hospital | Verified medical payee |
| `beneficiary` | external | fundId | Non-hospital fundraiser payee |

Singleton accounts (`moolre_float`, `platform_fee`) use a sentinel `ownerId = "GLOBAL"`.

## Double-entry rule

A **LedgerTransaction** has ≥2 **Postings**; each posting is `{ accountId, amount }` in **signed pesewas** (positive = into the account, negative = out). **The postings of a transaction always sum to 0**, and the sum across *all* accounts is always 0. Ledger is **append-only** — corrections are new `reversal`/`adjustment` transactions, never edits/deletes. Each transaction links to the Moolre movement via `externalref`.

> Convention: asset (`moolre_float`) trends positive; liability/income (`fund_pot`, `platform_fee`) trend negative. This signed-sum model maps cleanly onto debit/credit if you later want normal-balance accounting.

## Posting recipes

**Contribution settled** (member pays `amount` + `fee`; money lands in Moolre):
```
moolre_float   += amount + fee
fund_pot(fund) -= amount
platform_fee   -= fee
```

**Susu payout** (pot → cycle recipient; money leaves Moolre):
```
fund_pot(fund) += amount
moolre_float   -= amount
```

**Medical payout to hospital** (same shape, payee = hospital):
```
fund_pot(fund) += amount
moolre_float   -= amount
```

Balances are **derived** by summing an account's postings (`accountBalance` in `assets/domain/rules.ts`) — never stored as a mutable field. `FundraiserDetail.raised` and any "balance" shown in UI are projections of the ledger.

## Reconciliation

- `moolre_float` balance must equal Moolre's reported balance (`/open/account/status` type 1). A scheduled job compares them and flags drift.
- Each contribution/payout's ledger transaction is keyed to its `externalref`; reconcile against Moolre `/open/transact/status`.

## Domain events (transactional outbox)

On a state change, write the new state **+ the ledger transaction + an outbox event** in **one DB transaction**. A dispatcher then delivers events to handlers (idempotently) and marks them dispatched. This decouples "money settled" from its consequences and survives crashes/retries.

| Event (`DomainEventType`) | Emitted when | Typical handlers |
|---|---|---|
| `ContributionSettled` | Moolre confirms a collection | post ledger, SMS receipt, recompute trust, add ActivityItem, advance fund/cycle |
| `CycleFunded` | all members of a cycle have paid | trigger the Susu payout (transfer) |
| `PayoutSettled` | Moolre confirms a transfer | post ledger, SMS payout alert, close cycle / mark fund progress |
| `MemberOverdue` | a contribution passes its due date | SMS reminder, lower on-time rate |
| `MemberDefaulted` | overdue beyond threshold | set TrustStanding `locked` (platform-wide) |
| `FundCompleted` | last cycle paid / goal reached | mark fund `completed`, bump `fundsCompleted` |

**Idempotency:** handlers must be safe to run twice (key on `externalref` / event id). Settlement events are only emitted after Moolre webhook (`P01`) or status (`SS01`) confirmation — see `moolre-integration`.

Types: `LedgerAccount`, `LedgerTransaction`, `Posting`, `DomainEvent` in `assets/domain/types.ts`; helpers (`assertBalanced`, `accountBalance`, `contributionPostings`, `payoutPostings`) in `assets/domain/rules.ts`. Tables/dispatcher: `circlepay-stack`.
