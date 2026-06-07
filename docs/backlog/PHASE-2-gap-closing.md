# Phase 2 · Close the MVP gaps

> **Status: PLANNED.** The hero loop (E0–E6 + EM, plus the consolidation-phase additions) is built and verified on the **mock Moolre**. This phase doesn't add a new product surface — it makes what exists **honest, recoverable, and complete enough for the first real cedis**. Same story format as the MVP epics (Gherkin AC + technical spec + tasks + DoD). Each story names the **home epic** it extends so the work folds back into the main backlog cleanly.

**Why these and not the big backlog:** `BACKLOG-later.md` (E7 receipts/refunds, E9 notifications, E10 USSD, E11 AI, E12 ops, E13 hardening) is the *depth* roadmap. Phase 2 is narrower: the handful of places where the app today either **dead-ends a user**, **can't recover an account**, is **missing one core Susu capability**, or **hasn't moved real money**. These are what a Moolre Cup judge clicks into and what a first cohort of real users will hit on day one.

## The gaps (from the consolidation checkpoint)

| # | Gap | Today | Home epic |
|---|---|---|---|
| 1 | Deposit-required Susu dead-ends | toggle exists in create UI/schema; backend rejects `requiresDeposit` (`DEPOSIT_NOT_SUPPORTED`) | E3/E4 |
| 2 | Pools page is a mock | `/pools` renders fake data, no backend, overlaps Funds | cleanup |
| 3 | No account recovery | only authenticated Change-PIN; a forgotten/locked PIN is a wall | E1 |
| 4 | Deposit collection missing | join returns `pending_deposit` but collection is never wired | E4 |
| 5 | Shortfall coverage missing | E6 locks a defaulter but never consumes deposit/safety-pool | E6 |
| 6 | No real **live** money | whole path runs on the in-process mock; live `collect`/`transfer` never executed (Moolre `AIN04` — API access not activated) | E2/E13 |

## Recommended sequencing

Ordered by **leverage ÷ cost**, so the cheap, visible wins land first and nothing blocks the Cup demo:

- **Milestone A — Honest surfaces** (P2-S1, P2-S2): a day or two; removes the two visible dead-ends. Do first.
- **Milestone B — Account recovery** (P2-S3): real usability; small/medium; independent of everything else.
- **Milestone C — Deposits → shortfall** (P2-S4 → P2-S6): the one missing *core* Susu capability and the trust-moat payoff. Largest chunk; S5 depends on S4.
- **Milestone D — Live-money readiness** (P2-S7, P2-S8): partly **externally blocked** on Moolre activation — start the non-blocked prep now, finish on activation.

> **Product decisions to confirm before building** (don't block reading this plan):
> (a) Is deposit-backed Susu in scope for the Cup, or is "honest coming-soon" (P2-S1) enough for now? (b) Pools — **retire** the route or keep it as a labelled "preview"? (c) Forgot-PIN — OTP-only reset, or also require one previously-known fact? Defaults are baked into the stories below.

---

## Milestone A — Honest surfaces

### P2-S1 · Make the deposit option honest [FE] (S) · extends E3
**Story:** As someone creating a Susu, I never want to pick an option that the server then rejects, so the form only offers what actually works.

**Acceptance criteria**
```
Scenario: No dead-end
  Given the create-Susu form
  Then the "require a deposit" control is either hidden or shown disabled with a clear "Coming soon" affordance
  And submitting a valid form never returns DEPOSIT_NOT_SUPPORTED
Scenario: Server stays safe
  Given a crafted request with requiresDeposit=true
  Then the backend still rejects it (defence-in-depth) — the guard is not removed until P2-S4 lands
```
**Technical spec** — `frontend/app/create/page.tsx`: gate the deposit toggle behind a `DEPOSITS_ENABLED=false` constant; render it disabled with a "Coming soon" pill (premium-ui: calm, no alarm) or omit it. Leave the backend `DEPOSIT_NOT_SUPPORTED` guard in `funds.service.ts` as the server-side net. No schema change.
**Tasks:** [ ] flag-gate toggle [ ] coming-soon affordance [ ] confirm payload sends `requiresDeposit:false` [ ] live check
**DoD:** a user cannot reach the deposit dead-end from the UI; server guard intact.

### P2-S2 · Retire or relabel Pools [FE] (S) · cleanup
**Story:** As a user, I don't want a top-level page that shows numbers that aren't real.

**Acceptance criteria**
```
Scenario: Default — retire
  Then /pools is removed from primary nav and the route either 404s/redirects to /funds or shows an honest "Not part of CirclePay yet" stub
Scenario: If kept
  Then it is clearly labelled a non-functional preview and shows no fabricated balances
```
**Technical spec** — `frontend/components/app-shell.tsx` (nav entry) + `frontend/app/pools/page.tsx`. **Default: retire** — drop the nav link; redirect `/pools → /funds`. (Pools overlaps Funds conceptually; revive later only if a distinct concept emerges.)
**Tasks:** [ ] remove nav link [ ] redirect or honest stub [ ] grep for stray `/pools` links
**DoD:** no surface shows fabricated Pools data.

---

## Milestone B — Account recovery

### P2-S3 · Forgot-PIN reset via OTP [BE+FE] (M) · extends E1
**Story:** As a user who forgot my PIN (or got locked out), I want to reset it by verifying an OTP to my own phone, so I'm never permanently locked out of my money.

**Acceptance criteria**
```
Scenario: Reset
  Given I prove control of my phone via the existing request-otp → verify-otp flow
  When I POST /api/auth/reset-pin { newPin, confirmPin } with that fresh verification
  Then my PIN is replaced (Argon2id), the Redis lockout/fail counters (pin:fail / pin:lock) are cleared, and I can log in with the new PIN
Scenario: Old PIN dies
  Then the previous PIN no longer authenticates
Scenario: No bypass
  Given no valid recent OTP verification for that phone
  Then 401/403 — reset is refused (a forgotten PIN must not become a free password reset)
Scenario: Abuse
  Then reset is rate-limited per phone and audited (request id + phone hash, no PII in plaintext)
```
**Technical spec** — `backend/src/auth/`: `resetPin(phone, newPin)` gated on a short-lived "otp verified for reset" marker (reuse the OTP store; a dedicated `purpose:'reset'` flag so a login-OTP can't be replayed for reset). Reuse `setPin` hashing; on success `DEL pin:fail:{id}` / `pin:lock:{id}`. `POST /auth/reset-pin` (in the `NO_REFRESH` set). Shared `resetPinSchema` (same PIN policy as `changePinSchema`). FE: "Forgot PIN?" link on the login screen → OTP → new-PIN step (reuse `OtpInput` + `PinInput` + `ChangePinDialog` patterns).
**Security note:** this is the user resetting *their own* credential via OTP to *their own* phone — legitimate recovery, distinct from the assistant entering credentials. Keep it OTP-gated, rate-limited, and audited.
**Tasks:** [ ] `resetPin` service + lockout clear [ ] OTP `purpose` flag [ ] controller + schema [ ] FE forgot-PIN flow [ ] specs (reset clears lock; replay refused; old PIN dies)
**DoD:** a locked-out user can recover via OTP; no path lets reset proceed without a fresh verified OTP.

---

## Milestone C — Deposits → shortfall (the trust-moat payoff)

### P2-S4 · Deposit collection on join [BE] (L) · extends E4
**Story:** As a member joining a deposit-backed Susu, I want to pay the deposit via MoMo so my seat is secured and the circle has a safety buffer.

**Acceptance criteria**
```
Scenario: Collect deposit
  Given a fund with requiresDeposit and I accept an invite / join
  When I pay the deposit
  Then a Moolre collection runs (externalref d:{fundId}:{userId}); on settlement a `deposit` ledger leg posts, depositPaid=true, and DepositSettled is emitted
Scenario: Seat state
  Given my deposit is pending
  Then my membership is pending_deposit (seat reserved) and flips active on settlement
Scenario: Enable create
  Then the create-time DEPOSIT_NOT_SUPPORTED guard is removed and P2-S1's toggle is enabled
Scenario: Ledger
  Then deposit postings sum to zero and reconcile (moolre_float += amount; fund safety/deposit account += amount; fee handled like contributions)
```
**Technical spec** — reuse E4 collection mechanics. `funds.service.join` already returns `pending_deposit`; wire the actual collection (externalref `d:{fundId}:{userId}`) and a settlement handler that posts the deposit leg + sets `depositPaid`. Decide the ledger destination account for deposits (`fund_deposit(fund)` vs `safety_pool(fund)`) per `circlepay-domain/references/risk-and-defaults.md`. Remove the create guard; flip `DEPOSITS_ENABLED`.
**Tasks:** [ ] deposit collection initiate [ ] `d:` settlement handler + ledger leg [ ] depositPaid flip + DepositSettled [ ] remove create guard [ ] specs (ledger balances; idempotent on duplicate webhook)
**DoD:** a deposit-backed Susu collects deposits in the mock loop; ledger balances; seats activate on settlement.
**References:** `circlepay-domain/references/risk-and-defaults.md`, E4.

### P2-S5 · Shortfall coverage at payout [BE] (L) · extends E6 (the deferred half)
**Story:** As the circle, when a member defaults I want their deposit (then the safety pool) to cover the gap so the cycle's payee is still paid in full.

**Acceptance criteria**
```
Scenario: Cover from deposit
  Given a cycle is short because a member is defaulted
  When the payout is computed
  Then the shortfall is drawn deposit → safety pool (→ guarantor, later); ShortfallCovered is emitted with the postings; the payee receives the full pot
Scenario: Insufficient cover
  Then the payout is delayed or pro-rated per policy (explicit, logged) rather than silently short
Scenario: Ledger
  Then all coverage postings are append-only and reconcile to zero
```
**Technical spec** — at payout time (E5 path), detect shortfall; consume `fund_deposit`/`safety_pool` accounts per `risk-and-defaults.md`; emit `ShortfallCovered`. Guarantor + safety-pool surcharge config stay later (per E6 doc). **Depends on P2-S4.**
**Tasks:** [ ] shortfall detection [ ] deposit→pool consumption postings [ ] ShortfallCovered event [ ] delay/pro-rate policy [ ] specs (covered-in-full; partial; ledger zero-sum)
**DoD:** a defaulted member's cycle is covered from their deposit/pool; ledger reconciles; behaviour is logged not silent.
**References:** `E6-trust-defaults.md` (Deferred section), `risk-and-defaults.md`.

### P2-S6 · Deposit UX on join + fund detail [FE] (M) · extends E3/E4
**Story:** As a member, I want a clear deposit step when joining and visible deposit status in the fund, so I know my seat is secured.

**Acceptance criteria**
```
Scenario: Pay on join
  Given join returns pending_deposit
  Then I see a deposit pay step (reuse the pay + OTP flow) and, on settlement, my seat shows active
Scenario: Visibility
  Then fund detail shows each member's deposit status; the organizer can see who hasn't paid
```
**Technical spec** — wire the `pending_deposit` branch in the join flow to the pay/OTP components; surface `depositPaid` per member in `frontend/app/funds/[id]`. **Depends on P2-S4.**
**Tasks:** [ ] join → deposit pay step [ ] member deposit status in detail [ ] live check
**DoD:** deposit-backed join is a complete, legible flow end-to-end in the mock.

---

## Milestone D — Live-money readiness

### P2-S7 · Moolre live cutover [INFRA+BE] (M) · extends E2 · ⚠ externally blocked
**Story:** As the team, I want a verified path to flip from the mock to live Moolre so real contributions and payouts move.

**Acceptance criteria**
```
Scenario: Cutover checklist
  Given Moolre activates API access (clears AIN04)
  When MOOLRE_MOCK_ENABLED=false in a staging env
  Then real webhook signature verification is enforced, one low-value collect and one transfer settle via the real webhook, and the ledger reconciles against the Moolre statement
Scenario: Rollback
  Then flipping the flag back to the mock restores local testing with no code change
```
**Technical spec** — **non-blocked now:** harden/verify the real webhook signature path; write the cutover + rollback checklist; add a tiny `live-smoke` script for one collect + one transfer. **Blocked:** the actual live run waits on Moolre activation (`AIN04`). Track activation as a dependency/risk.
**Tasks:** [ ] webhook signature verify (live) [ ] cutover + rollback checklist [ ] live-smoke script [ ] (on activation) one real collect + transfer + reconcile
**DoD:** the moment Moolre activates, cutover is a flag flip + a documented smoke test — not a code project.

### P2-S8 · Reconciliation cron + real `moolre_fee` [BE] (M) · extends E12/E13
**Story:** As ops, I want nightly float-vs-Moolre reconciliation and real fee capture so drift is caught and the fee ledger is accurate.

**Acceptance criteria**
```
Scenario: Real fee
  Then settlement reads the actual moolre_fee from the payload (not an assumed value) and posts it to moolre_fee
Scenario: Reconcile
  Then a scheduled job compares ledger float to the Moolre balance and alerts on drift beyond a threshold
```
**Technical spec** — read `moolre_fee` from settlement payloads in the settlement handlers; add a `@nestjs/schedule` reconciliation job (reuse the outbox advisory-lock pattern) that diffs `moolre_float` vs the Moolre statement/balance and logs/alerts on drift. Overlaps E12-S4 / E13-S2 — implement the minimal slice here.
**Tasks:** [ ] read real fee on settle [ ] reconciliation job + threshold alert [ ] specs (fee posted; drift detected)
**DoD:** fees are real, not assumed; drift is detected automatically.

---

## Out of scope (stays in `BACKLOG-later.md`)
Full medical **receipts + refunds + escrow schedule + caps/guarantor** (E7-S3/S4/S5; `individual_cash` + tranche release already shipped), **notification center + preferences** (E9), **ops console** beyond the single verify action (E12), **rate limiting / observability / PII-at-rest / i18n Twi-Ga / KYC tiers** (E13), **USSD** (E10), **AI advisor** (E11). Pull these into Milestone 5 as time allows.

## Phase DoD
No UI surface dead-ends or shows fabricated data (A); a locked-out user can recover (B); a deposit-backed Susu collects deposits and a default is covered from them, ledger reconciling throughout (C); and flipping to live Moolre is a documented flag flip rather than a build (D).
