# EM · Medical Fund (MVP / lite)

> **Status: BUILT (as of this checkpoint).** New `fundraisers` feature module (`backend/src/fundraisers/`) — INFRA-only deps. Endpoints: `POST /fundraisers` (create), `GET /public/fundraisers/:slug` + `POST .../contribute` + `GET .../donations/:donationId` (public, no auth), `POST /fundraisers/:id/verify-payee` (ops), `POST /fundraisers/:id/release` (organizer). Donations: `Contributor` rows, externalref `mc:{fundId}:{donationId}`, settled via `DonationSettled`; payout: `PayoutTranche`, externalref `mp:{fundId}:1` (exactly-once), settled via `MedicalPayoutSettled` → fund `completed`. Frontend: real `/f/[slug]` public donate page + `/fundraisers/[id]` in-app detail; create Medical branch wired; kofi-mensah mocks removed. Verified end-to-end on the **mock Moolre** (`MOOLRE_MOCK_ENABLED=true`). **Deferred to E7/E8:** escrow + receipt-gated tranches, caps/guarantor, donor refunds, receipt upload/verify UI.
>
> **Updated since this checkpoint (consolidation phase) — supersedes some lines below:** `individual_cash` is now **supported** (EM-S1's "400 NOT_AVAILABLE_MVP" no longer applies — organizer releases to a person's MoMo without ops verification; hospital routes keep the gate). Payout is now **multi-tranche**: `release` pays the available delta with an indexed `mp:{fundId}:{n}` externalref and **no longer marks the fund `completed`** (EM-S4) — the organizer **Closes** the fund explicitly. Added organizer **invite / remind / bulk thank-you** (SMS) on the fundraiser. The remaining E7/E8 work (receipts, refunds, caps, escrow schedule) is unchanged.

**Goal:** A donor-facing medical fundraiser for the demo: create a fund, share a public page, contribute via MoMo, and (when verified) pay the hospital — using the **simplest payout route only** for MVP, with the richer escrow/tranche model deferred to E7/E8.

**MVP scope:** routes `hospital_momo` and `hospital_bank` (single verified payout); **defer** `individual_cash` escrow + receipt-gated tranches, guarantors, and refunds to `BACKLOG-later.md`. Donor transparency badge is in-scope.

**Depends on:** E1, E2, E4 (collection mechanics reused). **References:** `circlepay-domain/references/medical-payouts.md`, `compliance.md`; existing UI `frontend/app/funds/kofi-mensah` + `app/f/kofi-mensah`.

---

### EM-S1 · Create a medical fund [BE] (M)
**Story:** As an organizer, I want to create a medical fund (beneficiary, goal, story, payee/hospital) so people can contribute.

**Acceptance criteria**
```
Scenario: Create
  Given valid fields and an institutional payee (hospital_momo or hospital_bank)
  When I POST /api/funds (type Medical)
  Then a Fund + FundraiserDetail are created with a unique public slug, payoutRoute, payee (verificationStatus=pending), requiresReceipts=false (MVP institutional)
Scenario: Individual route deferred
  Given payoutRoute=individual_cash
  Then 400 NOT_AVAILABLE_MVP (with a note that escrow/tranches arrive in E7/E8)
```
**Technical spec**
- `POST /api/funds` (type `Medical`) — Zod `{ name, goal(pesewas>0), beneficiary, story, hospital?, payoutRoute:'hospital_momo'|'hospital_bank', payee:{ name, momo?|bankAccount? }, deadline?, shareable }`. Generate unique `slug`. `verificationStatus='pending'`.
- Reject `individual_cash` for MVP (feature-flag).
**Data:** `Fund`, `FundraiserDetail`.
**Tasks:** [ ] DTO+slug [ ] create [ ] MVP route guard [ ] tests
**DoD:** medical fund persists with a shareable slug + pending payee.

---

### EM-S2 · Public fund page + contribute [BE+FE] (L)
**Story:** As a donor (even without an account), I want to open a shared link and contribute via MoMo.

**Acceptance criteria**
```
Scenario: Public read
  When I GET /api/public/funds/:slug
  Then I get the public view: title, story, raised/goal, contributors (incl. "Anonymous"), payout route + verification badge — no private data
Scenario: Contribute
  Given the public page
  When I contribute (amount, my MoMo, optional anonymous)
  Then a collection runs (reuse E4 mechanics, externalref=mc:{fundId}:{payerHash}:{n}); on settlement, raised increases (derived from ledger), a Contributor row is recorded, and the donor gets an SMS receipt
Scenario: Transparency
  Then the page always shows the route + verification status (✅ Verified hospital / 🏦 Hospital bank — pending / 👤 individual — deferred)
```
**Technical spec**
- `GET /api/public/funds/:slug` (no auth) → public DTO. `POST /api/public/funds/:slug/contribute` → collection (E4-S1 mechanics, no login; capture payer phone; `anonymous` flag). Settlement posts ledger (`moolre_float += amount; fund_pot(fund) -= amount; …`) and inserts `Contributor`. `raised` is derived.
- FE: wire `frontend/app/f/[slug]` (public, currently `f/kofi-mensah`) and the in-app `app/funds/[id]` medical detail to these endpoints; show the **route + verification badge** prominently.
**Tasks:** [ ] public read DTO [ ] public contribute [ ] contributor record [ ] badge [ ] FE wire public+in-app [ ] tests
**DoD:** a shared link loads, a donor pays in sandbox, raised updates, receipt sent, badge shown.
**References:** `circlepay-domain/references/medical-payouts.md` (donor transparency).

---

### EM-S3 · Payee verification (ops, lite) [BE] (M)
**Story:** As ops, I want to verify the hospital payee (name-match + bill) before any payout, so funds only go to a confirmed destination.

**Acceptance criteria**
```
Scenario: Verify
  Given I'm ops (User.isOpsAdmin) and a pending payee
  When I POST /api/ops/funds/:id/verify-payee { decision: 'verified'|'rejected', note }
  Then verificationStatus updates; on 'verified' the fund becomes payout-eligible; PayeeVerified is emitted
Scenario: Name match aid
  Then the endpoint surfaces Moolre receivername for the payee MoMo/bank to support the decision
Scenario: Authz
  Given a non-ops user
  Then 403
```
**Technical spec** — `POST /api/ops/funds/:id/verify-payee` (ops guard via `User.isOpsAdmin`). Optionally call a Moolre name-lookup / show `receivername`. Emit `PayeeVerified`.
**Tasks:** [ ] ops guard [ ] verify endpoint [ ] name surface [ ] event [ ] tests
**DoD:** only ops can verify; verified funds become payout-eligible.
**References:** `circlepay-domain/references/{roles-and-permissions,compliance}.md`.

---

### EM-S4 · Single verified payout to hospital [BE] (M)
**Story:** As an organizer, I want the raised funds paid to the verified hospital so the bill is settled.

**Acceptance criteria**
```
Scenario: Payout
  Given verificationStatus=verified and goal reached (or organizer/ops triggers)
  When the payout runs
  Then MoolreService.transfer(...) sends to the hospital MoMo (channel) or bank (channel 2) with externalref=mp:{fundId}, recorded as a Payout; settlement posts the ledger (fund_pot += amount; moolre_float -= amount+moolreFee; moolre_fee += fee) and emits PayoutSettled
Scenario: Blocked if unverified
  Given verificationStatus != verified
  Then 409 PAYEE_UNVERIFIED, no transfer
Scenario: Exactly once
  Given duplicate triggers
  Then UNIQUE externalref ensures a single transfer
```
**Technical spec** — payout service for medical: guard `verified`; `transfer` to `hospital_momo`/`hospital_bank`; ledger payout posting; `PayoutSettled` → SMS to organizer + mark fund `completed`. (Escrow/tranches/refunds explicitly deferred.)
**Tasks:** [ ] verified guard [ ] transfer (momo/bank) [ ] settle→ledger [ ] complete+SMS [ ] tests
**DoD:** a verified medical fund pays the hospital once in sandbox; ledger balances; blocked while unverified.

---

**Epic DoD:** a medical fund can be created, shared publicly, funded by donors via MoMo (with receipts + live raised), verified by ops, and paid to the hospital MoMo/bank exactly once — with the donor transparency badge throughout. The `individual_cash` escrow + receipt-gated tranche model is intentionally deferred to E7/E8 (`BACKLOG-later.md`).
