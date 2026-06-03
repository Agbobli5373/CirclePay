---
name: "circlepay-domain"
description: Canonical product & domain knowledge for CirclePay — Ghana community finance (digital Susu rotating savings + Medical/emergency fundraising). Use when implementing or discussing CirclePay features, data models, fund types, Susu cycles & payout order, contributions/payouts, pools, trust score & defaulter protection, the AI Fund Advisor, or any business rule. Provides entities, enums, rules, flows and Ghanaian context. Payment mechanics live in the moolre-integration skill.
---

# CirclePay Domain

The single source of truth for **what CirclePay is and how it behaves**. Use it before adding features, designing a data model/backend, or writing AI Advisor logic. Money movement mechanics are in the **`moolre-integration`** skill — this skill says *what* should happen; that one says *how* to call the payment API.

## Product

CirclePay is a community-finance app for Ghana — a calmer, trust-first alternative to typical fintech. Two pillars:

1. **Susu** — digital rotating savings circles. A group contributes a fixed amount each cycle; one member receives the whole pot each cycle until everyone has been paid.
2. **Fundraising** — emergency/goal funds (primarily **Medical**) where many contributors give toward a target; payout goes **directly to a verified recipient** (e.g. a hospital).

Principles that must hold across the whole product:

- **CirclePay never holds the money.** Funds are collected and paid out the same cycle via Moolre; we are not a wallet/custodian. Say so in UI copy.
- **Trust compounds platform-wide.** A member's reliability is one score across all funds; defaulters are locked out **everywhere**, not just one circle.
- **USSD/MoMo-first.** Many users are not highly tech-literate and may have no internet — every core action must be reachable by mobile money + USSD, with plain language.
- **Transparency.** Members can see who paid, the payout order, and where money goes.

Audience & tone: market traders, families, community groups. Copy is plain, warm, simple (e.g. "Akwaaba, Ama"), accessible, non-desperate even for medical appeals.

## Entity map (see `references/entities.md` for full fields)

`User` ── has many ─→ `Member` (their seat in a `Fund`)
`Fund` (type: `Susu | Medical | Education | Business`)
  • Susu fund ── has ─→ `Cycle[]` (payout order) and `Member[]`; each cycle has `Contribution[]`
  • Medical fund ── has ─→ `Contributor[]` and one `beneficiary` + verified `hospital`
`Pool` = a Susu group/instance (status `active | planning | completed`)
`Contribution` (money in) and `Payout` (money out) — both reconcile to Moolre via `externalref`
`TrustScore` (per User) · `ActivityItem` (UX feed: `contribution | payout | donation | joined`)
`Ledger` — append-only **double-entry** accounts/postings (every money movement) + **DomainEvent** outbox (settlement side effects). Balances are derived, reconciled to Moolre.

## Headline business rules (full list in `references/business-rules.md`)

- **Susu math:** `cycles = members`; each cycle's payout pot = `contribution × members`. Payout order is `rotating` (fixed) or `random` draw, fixed at creation.
- **Member cycle status:** `paid | pending | overdue`. Overdue affects trust.
- **Trust score:** 5 segments; surfaced as standing (e.g. *Good standing*). Driven by on-time rate + funds completed. Defaulting → platform-wide lock (`canJoinFund` denies), reversible via appeal.
- **Shortfall protection:** Susu funds guard against default-after-payout with a refundable deposit, trust-ordered payouts, guarantor, or a safety pool; defaults run `overdue → grace → defaulted → appeal`. See `references/risk-and-defaults.md`.
- **Medical:** requires a beneficiary; payout is **route-aware** (`hospital_momo` / `hospital_bank` / `individual_cash`) since many Ghanaian facilities take cash — institution-first, with **escrow + receipt-gated tranches** for the individual route, payee verification, caps, and donor-visible trust badges. Supports anonymous contributors + public shareable link. Full model: `references/medical-payouts.md`.
- **Security:** auth is phone → OTP → 4-digit PIN; CirclePay never asks for the PIN by call/SMS.
- **Idempotency / settlement:** "Paid" is only true after Moolre webhook/status confirmation — see `moolre-integration`.
- **Ledger & events:** every money movement posts a balanced **double-entry** transaction (append-only); settlement emits **outbox** domain events that drive SMS, trust, activity and payouts. Full model: `references/ledger.md`.

## User roles

- **Member** — contributes to and receives from a Susu.
- **Fund admin** — creates/manages a Susu pool, invites members (before-start changes only).
- **Beneficiary** — the person a Medical fund is for (may differ from the organizer).
- **Contributor / Donor** — gives to a fundraising fund (can be anonymous).
- **Ops** — CirclePay staff: adjudicates appeals, verifies hospitals, AML review (kept separate from fund admins).

Defaults and payouts are **system-driven**, never admin discretion. Full matrix: `references/roles-and-permissions.md`.

## Key flows (full detail + route map in `references/flows.md`)

| Flow | Route | Money step (→ moolre-integration) |
|---|---|---|
| Onboarding (phone→OTP→PIN) | `/onboarding` | — |
| AI Fund Advisor (describe → configured fund) | `/advisor` | — |
| Create fund (Susu / Medical) | `/create` | — |
| Contribute / pay this cycle | `/pay`, `/funds/kumasi-traders` | Collection |
| Susu payout to cycle recipient | (server/job) | Transfer |
| Medical detail + public share | `/funds/kofi-mensah`, `/f/kofi-mensah` | Collection (give) / Transfer (to hospital) |
| Invite members | `/create` success → invite | — |

## Canonical model & helpers

- Types & enums: `assets/domain/types.ts` (import these instead of redefining shapes).
- Pure rule helpers: `assets/domain/rules.ts` (`totalCycles`, `cyclePayoutAmount`, `fundProgressPercent`, `nextPayee`, `onTimeRate`, `trustStanding`, `canJoinFund`, `formatGhs`).
- **Money convention:** store amounts as integer **pesewas** (`Pesewas = number`, GHS×100) to avoid float drift; format for display with `formatGhs`. (The current UI uses whole-GHS demo numbers; new/persistent code should use pesewas.)

## References

- `references/glossary.md` — domain terms.
- `references/entities.md` — entity catalog + enums (as built).
- `references/business-rules.md` — all rules.
- `references/risk-and-defaults.md` — shortfall protection, default lifecycle, appeals, USSD participation.
- `references/ledger.md` — double-entry ledger + domain events.
- `references/flows.md` — flows mapped to routes + Moolre.
- `references/ghana-context.md` — currency, networks, USSD, tone, localization, accessibility.
- `references/roles-and-permissions.md` — RBAC (member / fund_admin / ops) + permission matrix.
- `references/compliance.md` — BoG/non-custodial posture, KYC/limits, data protection, AML, appeals governance.
- `references/medical-payouts.md` — cash-aware tiered payout routes, escrow + receipt-gated tranches, verification, donor transparency.

Related skills: **`moolre-integration`** (payments), **`senior-frontend`** (React/Next.js patterns).
