# CirclePay — Implementation Backlog

This backlog turns the design (see the Claude skills under `.claude/skills/`) into **epics → user stories → specs** a junior developer can implement without guessing.

- **What** to build & the rules: `circlepay-domain` skill
- **How** money moves: `moolre-integration` skill
- **Architecture/stack/conventions**: `circlepay-stack` skill
- This backlog = the **sequenced, testable units of work**.

## How to read a story

Every story follows the same shape:

```
### E#-S# · Title                            [BE|FE|INFRA] (size: S|M|L)
**Story:** As a <role>, I want <capability> so that <value>.

**Acceptance criteria** (Gherkin)
  Scenario: ...
    Given ... When ... Then ...

**Technical spec**
  - API: METHOD /path — request (Zod) → response; error codes
  - Data: Prisma models/fields touched
  - Events/Ledger: outbox events emitted, ledger postings
  - Security/authz: who can call it
**UI/UX:** route + components (FE stories)
**Dependencies:** other story IDs
**Tasks:** [ ] checklist
**Definition of Done:** see global DoD below + story-specific
**References:** skill files
```

## Global Definition of Done (every story)

- [ ] Code matches the conventions in `circlepay-stack` (validation with Zod/`nestjs-zod`, error envelope `{ error: { code, message } }`, money as integer **pesewas**).
- [ ] Unit tests for logic; integration test (Jest+Supertest BE / Vitest+RTL FE) for the happy path + 1 failure path.
- [ ] Money-touching code: a test asserts ledger postings sum to zero and balances reconcile.
- [ ] `tsc` clean, lint clean, no secrets committed.
- [ ] Auth/authz enforced server-side (never trust the client).
- [ ] Logged with request id + `externalref` where money moves; no PII in plaintext logs.
- [ ] Docs/OpenAPI updated; PR description links the story ID.

## Conventions quick-reference

- **IDs:** `E{epic}-S{story}`. **Labels:** `[BE]` backend, `[FE]` frontend, `[INFRA]`.
- **Money:** integer pesewas (GHS×100); format with `formatGhs` (domain `rules.ts`).
- **API base:** `/api`; auth via httpOnly cookie; FE calls with `credentials: 'include'`.
- **Idempotency:** state-changing endpoints accept `Idempotency-Key`; money ops carry a unique Moolre `externalref` (`c:{fundId}:{cycle}:{userId}`, `p:{fundId}:{cycle}`).
- **Settlement truth:** "paid/settled" only after Moolre webhook (`P01`) or status (`SS01`, `txstatus:1`).

## Epic map

**MVP — the hero loop (fully specced in this backlog):**

| Epic | File | Goal |
|---|---|---|
| E0 | `E0-setup.md` | Monorepo, Nest scaffold, Prisma, shared pkg, CI |
| E1 | `E1-auth.md` | Phone → OTP (Moolre SMS) → PIN → JWT session |
| E2 | `E2-moolre-ledger.md` | Moolre client module, double-entry ledger, outbox dispatcher |
| E3 | `E3-susu-funds.md` | Create Susu, invite members, deposits, list/detail |
| E4 | `E4-contributions.md` | MoMo collection + OTP, webhook/status, ledger, SMS receipt |
| E5 | `E5-cycle-payouts.md` | Cycle-funded → disbursement, payout order, exactly-once |
| EM | `EM-medical-mvp.md` | Medical fund (lite): create, public page, contribute, single verified payout |

**Demo target:** E0→E1→E2→E3→E4→E5 gives the Susu hero loop on Moolre **sandbox**; EM adds the medical story for public voting.

| E6 | `E6-trust-defaults.md` | Default lifecycle (overdue→grace→defaulted) + platform-wide trust lock + on-time scoring + appeal — **built** |

**Later (outlined in `BACKLOG-later.md`, detail per-epic when reached):**
E7/E8 full medical payouts (escrow + receipt-gated tranches) · E9 Activity & notifications · E10 USSD flows · E11 AI Advisor seam · E12 Ops console · E13 Hardening & compliance (rate limits, observability, data protection, i18n).

## Status (as built — consolidation checkpoint)

- **Done & verified:** E0, E1, E2, E3, E4, E5, **E6** (trust moat), **EM Medical MVP** (create → public donate → ops verify → single verified payout), plus the full frontend wiring (onboarding, funds, create, pay, activity, profile, invitations bell, public `/f/[slug]` donate page, in-app `/fundraisers/[id]`) and name capture. Backend ~156 tests green.
- **Dev mock Moolre:** `MOOLRE_MOCK_ENABLED=true` runs an in-process fake that self-settles collect/transfer via the real webhook pipeline — the whole money path (Susu + Medical) is now testable locally without live Moolre. Hard-guarded off in production.
- **Deferred (the next epics):** shortfall coverage (deposit/safety-pool consumption + `ShortfallCovered`) and **deposit collection** itself (`requiresDeposit` is rejected at create for now); medical **escrow + receipt-gated tranches / `individual_cash`** (E7/E8); **reconciliation cron** + reading the real `moolre_fee` (E12/E13); **E10** USSD; **E11** AI advisor.
- **Not yet proven:** a real Moolre **live** collect/transfer — API access isn't activated on the account yet (`AIN04`). The money path is verified via the mock + seeded settlement events + unit tests; flip `MOOLRE_MOCK_ENABLED=false` once Moolre activates API access.

## Known frontend placeholders (intentional, tracked)

These ship as mock/stub UI until their epic lands — left as-is deliberately:
- **Pools** (`/pools`) — mock; no backend concept (overlaps with Funds). Revisit or retire.
- **AI Advisor** (`/advisor`, linked from Home + Create) — scripted stub → **E11**.
- ~~Medical mock pages~~ — **shipped** (EM): real `/f/[slug]` + `/fundraisers/[id]`; the kofi-mensah mocks were removed and create now posts to the backend.
- ~~Dead notification bell~~ — **shipped**: the bell now surfaces pending invitations. Dead `funds.list('all')` branch (list is mine-only) remains a trivial future tidy.

## Suggested sequencing & milestones

1. **Milestone 1 — Foundations:** E0, E1, E2. (Auth works; ledger + Moolre client wired to sandbox.)
2. **Milestone 2 — Susu loop:** E3, E4, E5. (Create → contribute → payout, with SMS.)
3. **Milestone 3 — Medical + demo polish:** EM, FE wiring, explainer assets.
4. **Milestone 4 — Hardening:** pull from `BACKLOG-later.md` (defaults/appeals, ops, observability) as time allows.
