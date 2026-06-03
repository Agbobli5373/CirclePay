# Operations: Concurrency, Jobs, Observability, Testing

Money systems fail in the gaps between "happy path" and production. These rules are non-negotiable.

## Request-level idempotency

- State-changing endpoints (`POST /contributions`, `/payouts`, `/funds`) accept an **`Idempotency-Key`** header. Persist `{key → {statusCode, response}}` (`IdempotencyKey` table); on a repeat key, **replay** the stored response instead of re-executing. Prevents a double-tapped "Pay" from creating two contributions.
- This is separate from Moolre's `externalref` (which guards the *Moolre* side).

## Exactly-once payouts & cycle funding

- A Susu cycle's payout uses a **deterministic** `externalref` = `p:{fundId}:{cycle}`, and `Payout.externalref` is **UNIQUE**. So even if `CycleFunded` fires twice, the second insert fails → at most one payout per cycle.
- Detect "cycle fully funded" inside a DB transaction with row locking (`SELECT … FOR UPDATE` on the cycle) so two concurrent contribution settlements can't both trigger the payout.

## Caching & Redis strategy (decided)

**Now (MVP / Startup Cup):** No Redis in the stack. All locking and rate-limiting uses Postgres.

| Concern | MVP approach (Postgres only) | Future (Redis + BullMQ) |
|---|---|---|
| Outbox single-flight | `pg_try_advisory_lock` — only one instance runs per tick | Redlock / BullMQ worker |
| OTP / auth rate-limit | DB-backed counter (`OtpRequest` window) | Redis counter (faster) |
| JWT session | Stateless httpOnly cookie — no store | Redis session store (only if server-side revocation needed) |
| Job queue | `@nestjs/schedule` + Postgres lock | BullMQ (Redis) — when volume grows |
| Response caching | None — DB reads | Redis cache (fund lists, balances) |

**Implementation rule:** the outbox poller and every scheduled job is wrapped in a `LockService` interface with a single Postgres implementation (`PgLockService`). Swapping in Redis later = one new implementation class, no call-site changes.

`REDIS_URL` stays in `.env.example` as a future env var but is not required and not imported.

## Jobs & the outbox at scale

`@nestjs/schedule` runs on every instance — guard every job run with the `LockService`:

```ts
// Postgres advisory lock (pg_try_advisory_lock) — only one instance wins
async tryWithLock(key: number, fn: () => Promise<void>): Promise<void>
```

Handlers stay **idempotent** (key on `externalref`/event id), failures increment `attempts` with exponential backoff, rows that exceed max attempts go to `failed` for alerting. See `E2-moolre-ledger.md` (E2-S3) for the full dispatcher spec.

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
