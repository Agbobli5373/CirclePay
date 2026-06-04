# E3 · Susu Funds & Membership

**Goal:** Create a Susu fund, invite/join members (app + USSD-eligible), optionally take a deposit, and view fund list/detail — so a circle exists to contribute into (E4) and pay out from (E5).

**Depends on:** E1 (auth), E2 (ledger for deposits). **References:** `circlepay-domain` (`entities.md`, `business-rules.md`, `risk-and-defaults.md`, `assets/domain/rules.ts`), `circlepay-stack/references/data-model.md`.

> Invariants: `totalCycles === memberCount`; once a Susu **starts**, member list + payout order are **locked**. Money: pesewas.

> **As built (deltas from this spec):**
> - **Join is invite-only.** There is no open `POST /funds/:id/join`; members accept via `POST /api/funds/join/:token` (the `Invite` model + `InviteStatus` exist; the token must match the caller's MoMo number). The list is **mine-only** (`GET /api/funds`) — no public "all".
> - **Start = full.** A Susu auto-starts when active members reach `memberCount`: `SusuDetail.startedAt` + `payoutOrder` are locked then, and each member's cycle-1 `dueAt` is set from cadence.
> - **Deposits deferred.** `requiresDeposit=true` is rejected at create (`DEPOSIT_NOT_SUPPORTED`) until deposit collection + shortfall coverage land (see `E6-trust-defaults.md` / later).

---

### E3-S1 · Create a Susu fund [BE] (M)
**Story:** As a user, I want to create a Susu (name, amount, frequency, members, start, payout rule, optional deposit) so my group can save together.

**Acceptance criteria**
```
Scenario: Create
  Given I'm authenticated and submit valid fields
  When I POST /api/funds (type Susu)
  Then a Fund(status active) + SusuDetail are created, I'm added as the first Member with role=admin
  And totalCycles is set = memberCount
Scenario: Validation
  Given amount<=0 or members<2 or members>50 or frequency invalid
  Then 400 VALIDATION with field details and nothing is created
Scenario: Defaulter cannot create
  Given my TrustStanding is "locked"
  Then 403 TRUST_LOCKED
```
**Technical spec**
- `POST /api/funds` — Zod: `{ type:'Susu', name, contribution(pesewas>0), frequency:'weekly'|'monthly', memberCount(2..50), startDate, payoutRule:'rotating'|'random'|'trust_ordered', requiresDeposit(bool), depositAmount(pesewas>=0) }`.
- Create `Fund` + `SusuDetail` (`currentCycle=1`, `totalCycles=memberCount`); add creator as `Member { role: admin, fundStatus: active }`. Guard: `canJoinFund(trust)` (`@circlepay/shared`).
- Response: the created fund DTO.
**Data:** `Fund`, `SusuDetail`, `Member`.
**Tasks:** [ ] Zod DTO [ ] create fund+detail+admin member [ ] trust guard [ ] tests (create, validation, locked)
**DoD:** fund persists; creator is admin member; locked users blocked.

---

### E3-S2 · Invite members (app + by phone for USSD) [BE] (M)
**Story:** As a fund admin, I want to invite members by MoMo number (or app user) so the circle fills.

**Acceptance criteria**
```
Scenario: Invite by phone
  Given I'm the fund admin and the Susu hasn't started
  When I POST /api/funds/:id/invites { phones: ["+233..."] }
  Then each gets an Invite + an SMS with a join link/USSD instruction, capped at the remaining seats
Scenario: Only admin, only before start
  Given I'm not admin OR the Susu already started
  Then 403 FORBIDDEN
Scenario: No overfill
  Given inviting more than remaining seats
  Then 400 SEATS_EXCEEDED
```
**Technical spec**
- `POST /api/funds/:id/invites` — admin-only (`Member.role=admin`). Body `{ phones: string[] }`. Create pending `Invite` rows (add an `Invite` model: `{ id, fundId, phone, status: pending|accepted|expired, token, ts }`), send SMS (Notifications → Moolre `sendSms`) with `circlepay.app/join/<slug>` + USSD hint. Respect remaining seats.
- USSD-only invitees accept/contribute via E10; for MVP the invite + SMS + app-join is enough.
**Data:** new `Invite` model (add to schema), `Member`.
**Tasks:** [ ] Invite model+migration [ ] admin guard [ ] seat math [ ] send SMS [ ] tests
**DoD:** invites created + SMS sent in sandbox; non-admin/over-seat blocked.

---

### E3-S3 · Join a Susu (+ deposit if required) [BE] (L)
**Story:** As an invited user, I want to join a Susu and pay any required deposit so I hold a seat.

**Acceptance criteria**
```
Scenario: Join without deposit
  Given an open seat and requiresDeposit=false
  When I POST /api/funds/:id/join
  Then a Member { fundStatus: active } is created (one seat consumed)
Scenario: Join with deposit
  Given requiresDeposit=true
  When I join
  Then a deposit collection is initiated (E4 collection mechanics); membership becomes active only after the deposit settles, posting to the `deposit` ledger account
Scenario: Trust lock / full
  Given locked trust OR no seats
  Then 403 TRUST_LOCKED / 409 FUND_FULL
```
**Technical spec**
- `POST /api/funds/:id/join` — guard `canJoinFund`. If `requiresDeposit`, reuse the **collection flow (E4-S1)** with `externalref = d:{fundId}:{userId}` and on settlement post `deposit` ledger leg (`moolre_float += deposit; deposit(fund:user) -= deposit`), then set member `active`+`depositPaid=true`. Else create active member immediately.
- Enforce seat count atomically (row lock on fund / unique seat).
**Data:** `Member`, `LedgerTransaction` (deposit).
**Tasks:** [ ] join (no deposit) [ ] deposit-gated join via collection [ ] ledger deposit posting [ ] concurrency guard [ ] tests
**DoD:** seats can't oversell; deposit funds appear in the `deposit` account; membership reflects deposit state.
**References:** `circlepay-domain/references/risk-and-defaults.md`, `ledger.md`.

---

### E3-S4 · Fund list & detail (read APIs) [BE] (M)
**Story:** As a user, I want to see my funds and a fund's detail (cycles, members, payout order) so the UI can render Home / Funds / detail.

**Acceptance criteria**
```
Scenario: My funds
  When I GET /api/funds?mine=true
  Then I get funds I'm a member of with progress (currentCycle/totalCycles, my next payout cycle)
Scenario: Detail
  When I GET /api/funds/:id
  Then I get members with per-cycle status, the payout order (rotating/random/trust_ordered), and "this cycle" funded count
  And amounts are pesewas; the client formats with formatGhs
```
**Technical spec**
- `GET /api/funds?mine=true|all` and `GET /api/funds/:id`. Compute payout order: `rotating` = join order; `random` = stored shuffle at start; `trust_ordered` = `orderPayoutsByTrust` (`@circlepay/shared`). Derive progress with `cycleProgressPercent`, pot with `cyclePayoutAmount`.
- Authz: members see full detail; non-members see limited public info (or 403 for private Susu).
**Tasks:** [ ] list (mine/all) [ ] detail w/ members+order+cycle [ ] authz [ ] tests
**DoD:** detail matches the existing `/funds/kumasi-traders` UI fields; payout order correct per rule.

---

### E3-S5 · Wire Create-fund + Funds + detail UI [FE] (L)
**Story:** As a user, I want the existing Create-fund, Funds list, and Susu detail screens backed by real data.

**Acceptance criteria**
```
Scenario: Create via form
  Given the /create form (Susu)
  When I submit, it POSTs /api/funds and routes to the success screen, then the new fund shows in /funds and Home
Scenario: Invite from success
  When I open the invite screen and add numbers, it POSTs /api/funds/:id/invites and shows "Invites sent"
Scenario: Detail
  When I open a Susu, it GETs /api/funds/:id and renders cycles, member statuses, payout order, "your turn"
```
**Technical spec**
- Replace mock data in `frontend/app/create`, `app/funds`, `app/funds/[fund]` (currently `kumasi-traders`) with API calls (TanStack Query). Use shared Zod for the create form. Keep `.cp-*` design system + `formatGhs`.
- Make the fund detail route dynamic (`/funds/[id]`) instead of the hardcoded slug.
**Tasks:** [ ] api hooks [ ] create→API [ ] invite→API [ ] dynamic detail [ ] loading/empty/error states [ ] tests
**DoD:** end-to-end create → appears in list/Home → detail renders from API; invite sends SMS.
**References:** `circlepay-stack/references/frontend-conventions.md`.

---

**Epic DoD:** a user can create a Susu, invite/fill seats (SMS sent), join (with optional deposit posting to the ledger), and view list/detail with the correct payout order; seats can't oversell; locked users blocked; UI wired to the API.
