# E0 · Monorepo & Project Setup

**Goal:** A working pnpm monorepo with the existing Next.js `frontend/`, a new Nest.js `backend/`, a shared package for domain types, Prisma wired to Postgres, and CI — so feature epics have a foundation.

**Out of scope:** any business feature (auth, funds…). Just scaffolding + a health check.

**Dependencies:** none. **References:** `circlepay-stack` → `architecture.md`, `backend-conventions.md`, `env.md`, `deployment.md`; `circlepay-domain/assets/domain/*`.

---

### E0-S1 · Convert repo to a pnpm workspace [INFRA] (S)
**Story:** As a developer, I want a pnpm workspace so frontend, backend and shared code live in one repo with one install.

**Acceptance criteria**
```
Scenario: Install from root
  Given the repo root has pnpm-workspace.yaml listing frontend, backend, packages/*
  When I run `pnpm install` at the root
  Then all workspaces install and `pnpm --filter frontend dev` still runs the existing app
```
**Technical spec**
- Create root `package.json` (private, `"packageManager": "pnpm@10"`) and `pnpm-workspace.yaml`:
  ```yaml
  packages: ["frontend", "backend", "packages/*"]
  ```
- Root scripts: `dev:web` (`pnpm --filter frontend dev`), `dev:api` (`pnpm --filter backend start:dev`), `build`, `lint`, `typecheck`.
- Do **not** move/rename `frontend/` (the Next app already lives there).
**Tasks:** [ ] add workspace files [ ] root scripts [ ] verify existing frontend still boots
**DoD:** `pnpm install` + `pnpm dev:web` work from root.

---

### E0-S2 · Shared domain package `@circlepay/shared` [INFRA] (M)
**Story:** As a developer, I want one source of domain types/enums/rules so frontend and backend never drift.

**Acceptance criteria**
```
Scenario: Both apps import shared types
  Given packages/shared exports the domain types + rules
  When frontend and backend import { FundType, formatGhs } from "@circlepay/shared"
  Then it type-checks in both with no duplication
```
**Technical spec**
- `packages/shared/` with `package.json` (name `@circlepay/shared`, `main`/`types` → `src/index.ts`), `tsconfig`.
- Copy the domain model from the skill: `circlepay-domain/assets/domain/types.ts` and `rules.ts` → `packages/shared/src/{types,rules}.ts`; re-export from `src/index.ts`.
- Add as a workspace dep in `frontend` and `backend` (`"@circlepay/shared": "workspace:*"`).
**Tasks:** [ ] scaffold package [ ] copy types+rules [ ] index barrel [ ] wire as dep in both apps
**DoD:** `pnpm typecheck` passes; a sample import works in both apps.
**References:** `circlepay-domain/assets/domain/types.ts`, `rules.ts`.

---

### E0-S3 · Scaffold the Nest.js backend [BE] (M)
**Story:** As a developer, I want a Nest.js API skeleton with config, validation, CORS and a health route.

**Acceptance criteria**
```
Scenario: API boots and is healthy
  Given the backend is running on PORT (default 4000)
  When I GET /api/health
  Then I receive 200 { status: "ok" }
Scenario: CORS allows the frontend with credentials
  Given CORS_ORIGIN is the frontend origin
  When the browser calls the API with credentials
  Then the response allows the origin and credentials
```
**Technical spec**
- `nest new backend` (or manual). Global prefix `api`. `@nestjs/config` loads `.env`.
- Global `ZodValidationPipe` (`nestjs-zod`) and a **global exception filter** returning `{ error: { code, message } }`.
- `main.ts`: `app.enableCors({ origin: process.env.CORS_ORIGIN, credentials: true })`, cookie parser.
- `HealthModule` → `GET /api/health`.
- Env from `circlepay-stack/assets/backend.env.example` (`PORT`, `NODE_ENV`, `CORS_ORIGIN`, …). Add a `.claude/launch.json` config `api` (port 4000) per `deployment.md`.
**Tasks:** [ ] nest scaffold [ ] config+pipe+filter [ ] CORS+cookies [ ] health route [ ] launch.json api entry
**DoD:** `pnpm dev:api` boots; `/api/health` green; error filter shape verified by a test.
**References:** `circlepay-stack/references/backend-conventions.md`, `env.md`, `deployment.md`.

---

### E0-S4 · Prisma + Postgres (Neon) wired [BE][INFRA] (M)
**Story:** As a developer, I want Prisma connected to Postgres with the starter schema so models exist to build on.

**Acceptance criteria**
```
Scenario: Migrate and connect
  Given DATABASE_URL points at a Neon/local Postgres
  When I run prisma migrate dev
  Then the schema (User, Fund, Ledger, Outbox, …) is created and PrismaService connects on boot
```
**Technical spec**
- Copy `circlepay-stack/assets/schema.prisma` → `backend/prisma/schema.prisma`.
- `PrismaService extends PrismaClient` (global module) with `onModuleInit` connect + shutdown hooks; inject everywhere (never `new PrismaClient()` elsewhere).
- Scripts: `prisma:migrate`, `prisma:generate`, `prisma:studio`.
**Tasks:** [ ] copy schema [ ] PrismaService+module [ ] first migration [ ] generate client
**DoD:** migration applies on a fresh DB; a trivial query (count users) runs in a test.
**References:** `circlepay-stack/assets/schema.prisma`, `references/data-model.md`.

---

### E0-S5 · CI pipeline [INFRA] (S)
**Story:** As a team, we want CI to block broken code.

**Acceptance criteria**
```
Scenario: CI on PR
  Given a PR is opened
  When CI runs
  Then it installs, typechecks, lints, runs tests, and `prisma validate`, failing the PR on any error
```
**Technical spec**
- GitHub Actions: matrix install (pnpm), `pnpm typecheck && pnpm lint && pnpm -r test && pnpm --filter backend prisma validate`. Build both apps.
**Tasks:** [ ] workflow file [ ] cache pnpm store [ ] required check on main
**DoD:** CI green on a no-op PR; red when a test fails.

---

**Epic DoD:** root `pnpm install` works; `dev:web` + `dev:api` run; `/api/health` green; Prisma migrated; `@circlepay/shared` imported by both apps; CI passing.
