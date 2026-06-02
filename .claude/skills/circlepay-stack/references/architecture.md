# Architecture

## Monorepo (pnpm workspaces)

```
ai-fund-advisor/
├── frontend/             # Next.js app (exists)
├── backend/             # Nest.js API (to scaffold)
├── packages/
│   └── shared/          # domain types + Zod schemas (from circlepay-domain)
├── pnpm-workspace.yaml   # packages: ["frontend", "backend", "packages/*"]
└── package.json          # root scripts (dev:all, build:all)
```

`packages/shared` is optional but recommended: lift the `circlepay-domain` `types.ts`/`rules.ts` + Zod schemas there so both apps import the same definitions (`@circlepay/shared`). If you skip it, keep the domain model in `backend/` and expose generated API types to the frontend.

## Responsibilities

- **frontend/** — UI + UX only. Calls the API over REST with credentials. Holds **no secrets** (only `NEXT_PUBLIC_API_URL`). Renders reads via Server Components; mutations/polling via TanStack Query.
- **backend/** — all business logic, persistence, and 3rd-party calls. Sole holder of `DATABASE_URL` and `MOOLRE_*`. Owns auth, funds/susu/fundraiser logic, contributions/payouts, trust, notifications (SMS), Moolre, webhooks, jobs.
- **packages/shared/** — pure types + Zod schemas + rule helpers. No I/O.

## API contract

- REST, JSON, versioned base path `/api` (e.g. `POST /api/funds`, `POST /api/contributions`).
- Auth via **httpOnly cookies** (access + refresh JWT). Frontend fetches with `credentials: 'include'`.
- Consistent error envelope: `{ "error": { "code": string, "message": string } }`.
- Money fields are integers (**pesewas**).

## CORS & cookies

- Backend sets `CORS_ORIGIN` to the frontend origin and enables `credentials: true`.
- Cookies: `SameSite=Lax` (or `None; Secure` if cross-site domains in prod), `HttpOnly`, `Secure` in prod, `Path=/`.
- CSRF: with cookie auth, add a CSRF token (double-submit) on state-changing routes, or require a custom header the browser can't forge cross-site.

## Where key pieces live

| Concern | Location | Skill |
|---|---|---|
| Domain types/rules | `packages/shared` (or `backend/src/domain`) | `circlepay-domain` |
| Moolre client + webhook | `backend/src/moolre` + `backend/src/webhooks` | `moolre-integration` |
| Auth (OTP/PIN/JWT) | `backend/src/auth` | this skill → `references/auth.md` |
| UI + design system | `frontend/` | `senior-frontend` |
