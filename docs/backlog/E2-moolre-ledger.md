# E2 · Moolre Core + Double-Entry Ledger + Outbox

**Goal:** The money plumbing every other epic depends on: a Moolre client module (sandbox), an append-only double-entry ledger, and a transactional-outbox dispatcher for reliable side effects.

**Depends on:** E0. **References:** `moolre-integration` (all), `circlepay-domain/references/ledger.md`, `circlepay-stack/references/{backend-conventions,operations}.md`.

> Money is integer **pesewas**. "Settled" only after Moolre webhook (`P01`) or status (`SS01`, `txstatus:1`). Every money movement = a balanced `LedgerTransaction` + an `OutboxEvent`, written in **one DB transaction**.

---

### E2-S1 · Moolre client module [BE] (M)
**Story:** As a developer, I want a `MoolreService` wrapping the API so features call typed methods, not raw HTTP.

**Acceptance criteria**
```
Scenario: Sandbox call
  Given MOOLRE_BASE_URL=https://sandbox.moolre.com and MOOLRE_API_USER set
  When MoolreService.getBalance() is called
  Then it POSTs /open/account/status with X-API-USER and returns the parsed envelope
Scenario: Error mapping
  Given Moolre returns code "AIN01"
  Then MoolreService throws MoolreError(code) which the global filter maps to { error: { code, message } }
```
**Technical spec**
- Copy `moolre-integration/assets/moolre-client.ts` → `backend/src/moolre/moolre.client.ts`; wrap in `MoolreService` (Nest provider) reading config from env. Methods: `collect`, `transfer`, `getStatus`, `isSettled`, `getBalance`, `listTransactions`, `sendSms`.
- Channels: collection `13/6/7`; transfer `1/6/7/2`. Currency `GHS`. Keys server-side only.
- `MoolreModule` (global) exports `MoolreService`.
**Tasks:** [ ] copy client [ ] service+module [ ] env wiring [ ] sandbox smoke test (getBalance)
**DoD:** `getBalance()` returns from sandbox; `MoolreError` surfaces through the filter.
**References:** `moolre-integration/references/*`.

---

### E2-S2 · Ledger service (accounts, balanced postings) [BE] (L)
**Story:** As a developer, I want a `LedgerService` that records balanced transactions and derives balances, so money is auditable.

**Acceptance criteria**
```
Scenario: Post a balanced transaction
  Given postings that sum to 0 across accounts
  When LedgerService.post({ kind, externalref, postings }) runs
  Then a LedgerTransaction + Postings are saved atomically
Scenario: Reject unbalanced
  Given postings that do not sum to 0
  Then it throws and nothing is written
Scenario: Derive balance
  When I ask for an account balance
  Then it equals SUM(posting.amount) for that account (no stored mutable balance)
```
**Technical spec**
- `LedgerService`:
  - `getOrCreateAccount(type, ownerId='GLOBAL')` → `LedgerAccount` (unique `[type, ownerId]`).
  - `post(tx: { kind: LedgerTxKind; externalref?; reference?; postings: {accountId, amount}[] })` — uses `assertBalanced` (from `@circlepay/shared`), writes `LedgerTransaction` + `Posting[]` in a Prisma `$transaction`.
  - `balance(accountId)` → `SUM(amount)`.
- Append-only: no update/delete; corrections are `reversal`/`adjustment` posts.
- Use the shared posting builders `contributionPostings` / `payoutPostings` (they include the optional `moolreFee` leg). **Book `moolre_fee`** so `moolre_float` reconciles.
**Data:** `LedgerAccount`, `LedgerTransaction`, `Posting`.
**Tasks:** [ ] account upsert [ ] post() + balance() [ ] reuse shared builders [ ] property test (sum-zero) [ ] reconcile test
**DoD:** posting unbalanced throws; balances derived correctly; tests assert invariants.
**References:** `circlepay-domain/references/ledger.md`, `assets/domain/rules.ts`.

---

### E2-S3 · Outbox + dispatcher (single-flight) [BE] (L)
**Story:** As a developer, I want domain events written with state changes and delivered reliably exactly-once-ish, so side effects (SMS, trust, activity) never get lost or duplicated.

**Acceptance criteria**
```
Scenario: Emit within the same tx
  Given a state change (e.g. contribution settled)
  When the handler runs
  Then the state row, ledger transaction, and an OutboxEvent(status=pending) are committed together
Scenario: Dispatch once across instances
  Given multiple backend instances
  When the dispatcher runs
  Then a lock ensures only one processes a given pending event, handlers are idempotent, and success marks it dispatched
Scenario: Retry & dead-letter
  Given a handler throws
  Then attempts increments with backoff; exceeding max moves it to failed for alerting
```
**Technical spec**
- `OutboxService.emit(type, payload, tx)` — insert `OutboxEvent` **inside the caller's Prisma transaction**.
- `OutboxDispatcher` — `@nestjs/schedule` poller (e.g. every 5s) wrapped in a **single-flight lock** (`pg_try_advisory_lock` or Redis); fetch `pending` ordered by `createdAt`, route to a handler registry keyed by `DomainEventType`, mark `dispatched` / bump `attempts` on failure; `failed` after N.
- Handlers are **idempotent** (key on `externalref`/event id). See `operations.md`.
**Data:** `OutboxEvent`.
**Tasks:** [ ] emit() in-tx [ ] dispatcher+lock [ ] handler registry [ ] retry/backoff/dead-letter [ ] tests (atomic emit, single dispatch, retry)
**DoD:** killing one of two instances doesn't double-dispatch; failed events are visible; emit is atomic with state.
**References:** `circlepay-stack/references/operations.md`, `circlepay-domain/references/ledger.md`.

---

### E2-S4 · Moolre webhook receiver [BE] (M)
**Story:** As the system, I want to receive Moolre payment callbacks securely so settlements are recorded promptly.

**Acceptance criteria**
```
Scenario: Valid webhook
  Given Moolre POSTs to /api/webhooks/moolre/:secret with a payment payload
  And :secret matches MOOLRE_WEBHOOK_SECRET
  Then the request is accepted (200 fast), the externalref is resolved, and settlement is re-confirmed via getStatus before any crediting
Scenario: Bad secret
  Given :secret is wrong
  Then 401 and nothing is processed
Scenario: Duplicate webhook
  Given the same event arrives twice
  Then the second is a no-op (idempotent on externalref)
```
**Technical spec**
- `POST /api/webhooks/moolre/:secret` (public, no JWT). Verify secret path token. Parse `{ code, data: { externalref, txstatus } }`. **Re-confirm** via `MoolreService.isSettled(externalref)` — never credit off the body alone. Enqueue/emit the relevant settlement event (handled in E4/E5). Respond `200` quickly.
- Reconciliation job (cron): re-poll `getStatus` for anything `initiated` > N minutes (webhook backstop).
**Tasks:** [ ] route+secret guard [ ] re-confirm [ ] emit settlement event [ ] idempotency [ ] reconciliation cron [ ] tests (valid, bad secret, duplicate)
**DoD:** valid callback recorded once; bad secret rejected; missed webhooks caught by reconciliation.
**References:** `moolre-integration/references/webhooks.md`.

---

**Epic DoD:** `MoolreService` talks to sandbox; `LedgerService` enforces balanced, append-only postings with derived balances + `moolre_fee`; outbox guarantees atomic emit + single-flight idempotent dispatch; webhook receiver verifies + re-confirms; all covered by tests including ledger-invariant and double-dispatch.
