# E4 · Contributions (MoMo Collection)

**Goal:** A member pays their cycle via MoMo (Moolre collection + OTP), the system confirms settlement (webhook/status), posts to the ledger, updates member/cycle state, and sends an SMS receipt — idempotently.

**Depends on:** E1, E2, E3. **References:** `moolre-integration/references/{collections,status-and-balance,webhooks,sms}.md`, `circlepay-domain/references/{ledger,flows}.md`, `circlepay-stack/references/operations.md`.

> `externalref = c:{fundId}:{cycle}:{userId}`. Collection channel: MTN `13`, Telecel `6`, AT `7`. Success `TR099`; OTP needed `TP14`; duplicate ref `TP13`. Settlement truth = webhook `P01` / status `SS01` `txstatus:1`.

---

### E4-S1 · Initiate a contribution (with OTP) [BE] (L)
**Story:** As a member, I want to pay my cycle from my MoMo so my contribution counts.

**Acceptance criteria**
```
Scenario: Initiate
  Given I'm an active member with an unpaid current cycle
  When I POST /api/contributions { fundId } (Idempotency-Key header)
  Then a Contribution(status=initiated, externalref=c:fund:cycle:user, fee, total) is created
  And MoolreService.collect(...) is called; if it returns TR099 the response is 202 { state: "initiated" }
Scenario: OTP required
  Given Moolre returns TP14
  Then the response is 200 { state: "otp_required" } and the client re-POSTs with { otpcode } (same Idempotency-Key/externalref)
Scenario: Idempotent double-tap
  Given the same Idempotency-Key is sent twice
  Then the stored first response is replayed; only one Contribution exists
Scenario: Duplicate externalref (TP13)
  Then call getStatus(externalref) and return its real state instead of creating a second
```
**Technical spec**
- `POST /api/contributions` — JWT; body Zod `{ fundId, otpcode? }`; require `Idempotency-Key` header (E2/operations). Compute amount from `SusuDetail.contribution`, `fee` (platform fee policy, e.g. config), `total`.
- Build `externalref = c:{fundId}:{currentCycle}:{userId}`; create/find `Contribution(initiated)`; call `MoolreService.collect({ channel, payer, amount, externalref, otpcode? })`.
- Map results: `TR099` → 202 initiated; `TP14` → 200 otp_required; `TP13` → resolve via `getStatus`.
- **Do not** mark paid here — settlement is async (E4-S2/S3).
**Data:** `Contribution`, `IdempotencyKey`.
**Tasks:** [ ] DTO+idempotency [ ] amount/fee calc [ ] collect + OTP branch [ ] TP13 handling [ ] tests (initiate, otp, idempotent, dup)
**DoD:** initiate + OTP resubmit work in sandbox; no double contributions; nothing marked paid prematurely.

---

### E4-S2 · Settle a contribution (webhook/status → ledger → state) [BE] (L)
**Story:** As the system, I want to finalize a contribution only when Moolre confirms, posting to the ledger and updating cycle/member state.

**Acceptance criteria**
```
Scenario: Settlement
  Given a webhook/status confirms externalref c:fund:cycle:user with txstatus=1
  When the settlement handler runs (idempotent)
  Then in ONE db transaction: Contribution → settled; a balanced LedgerTransaction posts
       moolre_float += amount+fee-moolreFee; fund_pot(fund) -= amount; platform_fee -= fee; moolre_fee += moolreFee
       the Member's current-cycle status → paid (paidAt set); an OutboxEvent(ContributionSettled) is emitted
Scenario: Idempotent
  Given the settlement event/webhook arrives twice
  Then the second is a no-op (keyed on externalref); ledger isn't double-posted
Scenario: Failure
  Given status is failed/expired
  Then Contribution → failed; member cycle stays unpaid; no ledger posting; user is notified to retry (new externalref)
```
**Technical spec**
- A handler (invoked by the webhook receiver E2-S4 and the reconciliation cron) resolves `externalref` → `Contribution`. If settled and not already `settled`: run a Prisma `$transaction` doing the status update + `LedgerService.post(contributionPostings({...moolreFee}))` + mark member cycle paid + `OutboxService.emit('ContributionSettled', …)`.
- Idempotency: guard on `Contribution.status === 'settled'` and unique ledger `externalref`.
**Events/Ledger:** `ContributionSettled`; postings per `ledger.md`.
**Tasks:** [ ] settle handler (idempotent, in-tx) [ ] ledger posting w/ moolre_fee [ ] member cycle update [ ] failure path [ ] tests (settle, duplicate, fail, ledger sum-zero)
**DoD:** a sandbox payment flips to settled exactly once, ledger balances, member shows paid.

---

### E4-S3 · SMS receipt on settlement [BE] (S)
**Story:** As a member, I want an SMS receipt after paying so I have proof.

**Acceptance criteria**
```
Scenario: Receipt
  Given ContributionSettled is dispatched
  When the handler runs
  Then an SMS is sent to the payer: "CirclePay: GHS X received for <fund> (Cycle N). Ref <externalref>. Powered by Moolre."
  And it is idempotent (one receipt per settlement)
```
**Technical spec** — an outbox handler for `ContributionSettled` → `NotificationsService.sendReceipt(...)` → Moolre `sendSms`. Respect user language. Mark handled to avoid duplicates.
**Tasks:** [ ] handler [ ] message template (i18n) [ ] idempotency [ ] test
**DoD:** exactly one receipt per settled contribution in sandbox.
**References:** `moolre-integration/references/sms.md`.

---

### E4-S4 · Pay flow UI [FE] (M)
**Story:** As a member, I want the existing `/pay` flow to make a real payment with OTP and show a real receipt.

**Acceptance criteria**
```
Scenario: Pay
  Given the /pay (or Susu detail "Pay this month") screen
  When I confirm, it POSTs /api/contributions with an Idempotency-Key
  Then if OTP is required I'm prompted for the SMS code and it re-submits; on initiate I see a "processing" state
  And the UI polls GET /api/contributions/:ref (or fund detail) until settled, then shows the SMS-style receipt with the reference
Scenario: Failure
  Given the payment fails
  Then a clear error + retry (new attempt) is shown
```
**Technical spec**
- Wire `frontend/app/pay` + the Susu detail "Pay this month" to the API (TanStack Query mutation + polling on status). Generate/attach `Idempotency-Key`. Show fee + total before confirm (already in UI). Receipt shows `externalref`.
- Add `GET /api/contributions/:externalref` (status) for polling, or reuse fund detail.
**Tasks:** [ ] mutation+idempotency key [ ] OTP modal [ ] poll-to-settled [ ] receipt [ ] error/retry [ ] tests
**DoD:** end-to-end: tap Pay → (OTP) → processing → settled receipt, backed by sandbox.
**References:** `circlepay-stack/references/frontend-conventions.md`.

---

**Epic DoD:** a member contributes via MoMo (with OTP), settlement is confirmed only via Moolre, posts a balanced ledger transaction (incl. `moolre_fee`), flips the member's cycle to paid, sends one SMS receipt, and is fully idempotent (double-tap, duplicate webhook). UI reflects the real flow.
