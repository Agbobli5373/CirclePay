# Operations: Concurrency, Jobs, Observability, Testing

Money systems fail in the gaps between "happy path" and production. These rules are non-negotiable.

## Request-level idempotency

- State-changing endpoints (`POST /contributions`, `/payouts`, `/funds`) accept an **`Idempotency-Key`** header. Persist `{key → {statusCode, response}}` (`IdempotencyKey` table); on a repeat key, **replay** the stored response instead of re-executing. Prevents a double-tapped "Pay" from creating two contributions.
- This is separate from Moolre's `externalref` (which guards the *Moolre* side).

## Exactly-once payouts & cycle funding

- A Susu cycle's payout uses a **deterministic** `externalref` = `p:{fundId}:{cycle}`, and `Payout.externalref` is **UNIQUE**. So even if `CycleFunded` fires twice, the second insert fails → at most one payout per cycle.
- Detect "cycle fully funded" inside a DB transaction with row locking (`SELECT … FOR UPDATE` on the cycle) so two concurrent contribution settlements can't both trigger the payout.

## Jobs & the outbox at scale (the real trap)

`@nestjs/schedule` and the outbox poller **run on every instance**. If the backend scales horizontally you'll get **duplicate payouts/SMS**. Pick one:

- **Single-flight lock:** wrap each scheduled run / outbox batch in a **Postgres advisory lock** (`pg_try_advisory_lock`) or a Redis lock; only the holder runs. Simplest, no new infra beyond what you have.
- **Dedicated worker:** run jobs/dispatcher only on one designated process (a `WORKER=true` instance).
- **Real queue:** move side effects to **BullMQ (Redis)** — the outbox dispatcher enqueues jobs; workers consume with built-in retries/concurrency control. Best if volume grows.

Whichever you choose: handlers stay **idempotent** (key on `externalref`/event id), failures increment `attempts` with exponential backoff, and a row that exceeds max attempts goes to `failed` for alerting.

## Reconciliation jobs

- Compare `moolre_float` ledger balance vs Moolre `/open/account/status` daily → alert on drift.
- Re-poll `/open/transact/status` for any contribution/payout still `initiated` after N minutes (webhook backstop).

## Observability

- **Structured logging** (pino), with a request id + (when present) `externalref` on every money log line.
- **Error tracking** (Sentry or equivalent) on both apps.
- **Metrics/alerts:** failed outbox events, ledger drift, payout failures, OTP send failures, webhook 4xx/5xx. Page a human on ledger drift or stuck payouts.
- The **ledger itself is the audit log** — never delete; corrections are reversal transactions.

## Testing

- **Ledger invariants (property tests):** every `LedgerTransaction`'s postings sum to 0; replaying all postings reproduces stated balances; `moolre_float` == sum of cash legs. Use `assertBalanced` from `circlepay-domain`.
- **Money flows (integration, Jest + Supertest):** collect → webhook → ledger+activity+SMS; cycle funded → single payout; default → deposit covers shortfall; idempotency-key replay; duplicate webhook is a no-op.
- **Frontend (Vitest + RTL):** form validation, money formatting, optimistic states.
- Gate CI on these for any change touching `contributions`, `payouts`, `ledger`, or `webhooks`.
