---
name: "circlepay-stack"
description: Canonical tech stack, architecture & conventions for CirclePay — a pnpm monorepo with a Next.js frontend and a Nest.js API, Postgres (Neon) + Prisma, custom phone/OTP/PIN auth (OTP via Moolre SMS), and Moolre payments. Use when scaffolding the backend, choosing libraries, defining the data model, wiring auth, deploying, or making any architecture/convention decision. Pairs with circlepay-domain (what), moolre-integration (payments), senior-frontend (UI), nestjs-expert (API).
---

# CirclePay Stack

The single source of truth for **how CirclePay is built**. Decisions here are settled — follow them unless explicitly revisited.

## Stack at a glance

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | **pnpm workspaces** | `frontend/`, `backend/`, optional `packages/shared` |
| Frontend | **Next.js 16 (App Router) · React 19 · TypeScript 5.7** | already built in `frontend/` |
| UI | **Tailwind v4 · shadcn/ui · lucide-react · recharts** | `.cp-*` design system in `globals.css` |
| Client data | **TanStack Query** + Server Components | mutations/polling via Query; reads via RSC |
| Forms/validation | **Zod** + react-hook-form | Zod schemas shared with the API |
| Backend | **Nest.js** | new `backend/` service; holds all secrets |
| ORM/DB | **Prisma → Postgres (Neon)** | money stored as **integer pesewas** |
| Auth | **custom phone → OTP → PIN** | OTP via Moolre SMS; PIN argon2; JWT in httpOnly cookies (Passport) |
| Payments/SMS | **Moolre** | via `moolre-integration` `MoolreClient` in a Nest `moolre` module |
| Jobs | **@nestjs/schedule** | payout disbursement, status reconciliation, SMS reminders |
| AI Advisor | **deferred** (rules-based stub) | clean seam to drop in Claude later (`claude-api`) |
| Deploy | **Vercel** (frontend) · **Render/Railway/Fly** (backend) · **Neon** (db) | |
| Test | **Vitest + Testing Library** (FE) · **Jest + Supertest** (API) | |

## Monorepo layout (target)

```
ai-fund-advisor/
├── frontend/            # Next.js app (exists)
├── backend/            # Nest.js API (to scaffold)
├── packages/shared/    # optional: domain types + Zod schemas (from circlepay-domain)
├── pnpm-workspace.yaml
└── package.json        # workspace root
```

## Data flow

```
Browser ──(fetch, cookies)──▶ Next.js (frontend)
        ──(REST, credentials)─▶ Nest.js API (backend)
                                  ├──▶ Postgres (Prisma)
                                  └──▶ Moolre (collect / transfer / status / SMS)
Moolre ──(webhook)──▶ Nest.js /webhooks/moolre/<secret>
```

The frontend never holds Moolre keys or talks to Moolre directly. The API is the only thing with `DATABASE_URL` and `MOOLRE_*`.

## Cross-cutting conventions

- **Money:** integer **pesewas** (GHS×100) everywhere (DB `Int`, DTOs, domain). Format only at the edge with `formatGhs` (from `circlepay-domain`).
- **Validation:** one Zod schema per payload, shared FE↔API (via `packages/shared` or `nestjs-zod`).
- **Idempotency/settlement:** money is "settled" only on Moolre webhook/status confirm; every movement carries a unique `externalref` (see `moolre-integration` + `circlepay-domain`).
- **Ledger + outbox:** every money movement writes a balanced **double-entry** `LedgerTransaction` (append-only; balances derived, reconciled to Moolre) **and** an `OutboxEvent` in the *same* DB transaction; an events dispatcher fans out side effects idempotently. See `backend-conventions.md` + `circlepay-domain/references/ledger.md`.
- **Auth:** never ask for the PIN by call/SMS; OTP is short-lived + rate-limited; sessions are httpOnly cookies.
- **Errors:** API returns a consistent `{ error: { code, message } }`; map Moolre/domain errors to it.

## References

- `references/architecture.md` — monorepo, module boundaries, REST/CORS/cookies.
- `references/backend-conventions.md` — Nest module map, Prisma, validation, guards, jobs.
- `references/auth.md` — phone→OTP→PIN design + endpoints.
- `references/data-model.md` — Prisma schema mapping the domain entities.
- `references/frontend-conventions.md` — RSC vs client, TanStack Query, calling the API.
- `references/env.md` — env vars per app.
- `references/deployment.md` — hosting, migrations, cron, CORS.
- `references/ai-advisor.md` — current stub + the seam for Claude later.
- `assets/schema.prisma`, `assets/backend.env.example`, `assets/frontend.env.example` — starters (reference only).

## Related skills

`circlepay-domain` (entities/rules/flows) · `moolre-integration` (payments/SMS) · `nestjs-expert` (API patterns) · `senior-frontend` (UI) · `claude-api` (when the Advisor goes live).

> This skill is a **note/reference** — it documents the target. Scaffolding the `backend/` Nest app is a separate follow-up task.
