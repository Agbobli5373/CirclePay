# Backend (Nest.js) Conventions

Use the **`nestjs-expert`** skill for idiomatic module/DI/testing detail. This doc fixes CirclePay-specific choices.

## Module map (`backend/src/`)

| Module | Responsibility |
|---|---|
| `auth` | phone→OTP→PIN, JWT issue/refresh, guards (see `auth.md`) |
| `users` | user profile, trust score read |
| `funds` | fund CRUD + listing; dispatches to susu/fundraiser logic |
| `susu` | rotating-savings logic: cycles, payout order, member status |
| `fundraisers` | Goal funds + **payout routing**: route selection, payee verification (Moolre name-match + ops), escrow **tranche release** (gated by verified receipts, `canReleaseNextTranche`), receipt upload/verify, donor-visible status; emits `PayeeVerified`/`TrancheReleased`/`ReceiptSubmitted`/`MedicalFundRefunded` via the outbox |
| `contributions` | collect (Moolre), settlement state |
| `payouts` | disbursement (Moolre transfer), reconciliation |
| `trust` | scoring + platform-wide defaulter lock + the default-lifecycle **scheduler** (overdue/grace/default sweep) + appeal unlock (`POST /trust/:userId/unlock`, ops) |
| `activity` | activity feed read API (`GET /activity`) over `ActivityItem` |
| `notifications` | SMS (receipts, alerts, reminders) via Moolre |
| `moolre` | wraps the framework-agnostic `MoolreClient` (`moolre-integration`) |
| `webhooks` | `POST /webhooks/moolre/:secret` → verify → reconcile |
| `ledger` | double-entry accounts/postings; post balanced txns; derive balances; reconcile to Moolre |
| `events` | transactional **outbox** dispatcher (delivers `DomainEvent`s to handlers) |
| `prisma` | `PrismaService` (global) |

## Persistence — Prisma

- `PrismaService extends PrismaClient` with `onModuleInit`/`enableShutdownHooks`; inject into services. Don't import `PrismaClient` directly elsewhere.
- Schema in `backend/prisma/schema.prisma` (starter in `assets/schema.prisma`). Migrate with `prisma migrate dev` (local) / `migrate deploy` (prod).
- **Money columns are `Int` (pesewas).** Never `Float`/`Decimal` for currency.

## Validation

- Prefer **`nestjs-zod`** so DTOs reuse the shared Zod schemas (single source FE↔API). Apply a global `ZodValidationPipe`.
- If using class-validator instead, keep DTOs 1:1 with the shared types.

## Errors

- Throw Nest `HttpException`s; a global exception filter maps to `{ error: { code, message } }`.
- Map `MoolreError.code` (e.g. `TP14`, `ASMS07`) and domain rule failures (e.g. defaulter lock) to stable app codes.

## Auth guards

- Passport **JWT strategy** reads the access token from the httpOnly cookie. `@UseGuards(JwtAuthGuard)` on protected routes; a `@CurrentUser()` decorator injects the user.

## Scheduled jobs — `@nestjs/schedule`

All sweeps are **single-flight** via a Postgres advisory lock (`LockService`, exported from the outbox module) so only one instance runs a batch.

- **Outbox dispatcher** (`outbox`, every 5s): delivers `OutboxEvent`s to handlers (incl. `CycleFunded` → disburse, `PayoutSettled` → settle+advance). Implemented.
- **Trust sweep** (`trust`, every 30s): drives members `pending → overdue → grace → defaulted` off each member's `dueAt` (grace window = `GRACE_HOURS`, default 48h); SMS nudges; on default sets `TrustStanding=locked` **platform-wide**. Implemented (shortfall coverage from deposit/safety-pool is deferred).
- **Reconciliation** (backstop, *deferred*): poll Moolre `/open/transact/status` for contributions/payouts still `initiated` after N minutes, and read the real `moolre_fee`. Not yet built.

## Money & settlement (ledger + outbox)

- Compute with `circlepay-domain` rule helpers (`cyclePayoutAmount`, `contributionPostings`, `payoutPostings`, `assertBalanced`).
- A contribution/payout is **settled** only on Moolre webhook (`P01`) or status (`SS01`, `txstatus:1`) — see `moolre-integration`.
- **On settlement, do all of this in ONE Prisma transaction:** update the `Contribution`/`Payout` status → write a balanced `LedgerTransaction` + `Posting`s (sum 0, keyed to `externalref`) → insert an `OutboxEvent` (e.g. `ContributionSettled`). Commit atomically.
- An **`events` dispatcher** (a `@nestjs/schedule` poller, or after-commit hook) reads `OutboxEvent` rows `status=pending`, runs handlers (SMS receipt, trust recompute, `ActivityItem`, advance cycle / `CycleFunded` → trigger payout), then marks `dispatched`. Handlers are **idempotent** (key on `externalref`/event id); failures increment `attempts` and retry with backoff.
- **Balances are derived** by summing postings — never stored as mutable fields. A scheduled job reconciles the `moolre_float` balance against Moolre `/open/account/status`.
- Ledger is **append-only**: corrections are `reversal`/`adjustment` transactions, never edits/deletes.
