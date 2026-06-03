# E5 · Susu Cycle Engine & Payouts

**Goal:** When a cycle is fully funded, pay the pot to that cycle's recipient via Moolre disbursement — exactly once — then advance the cycle and notify. This closes the Susu hero loop.

**Depends on:** E2, E3, E4. **References:** `circlepay-domain/references/{business-rules,ledger,flows}.md`, `assets/domain/rules.ts`; `moolre-integration/references/{disbursements,status-and-balance,webhooks}.md`; `circlepay-stack/references/operations.md`.

> `externalref = p:{fundId}:{cycle}` (UNIQUE → exactly-once payout). Transfer channel: MTN `1`, Telecel `6`, AT `7`, bank `2`. Success `OBGH01`. Settlement truth = webhook/status.

---

### E5-S1 · Detect "cycle funded" & resolve recipient [BE] (M)
**Story:** As the system, I want to know when all members have paid the current cycle and who receives the pot.

**Acceptance criteria**
```
Scenario: Cycle becomes funded
  Given every active member's current-cycle status is paid
  When the last ContributionSettled is handled
  Then (in the same logic) the system marks the cycle funded and emits CycleFunded once
Scenario: Recipient
  Given the fund's payoutRule
  Then the recipient is resolved: rotating=order[cycle-1]; random=stored shuffle; trust_ordered=orderPayoutsByTrust(...)[cycle-1]
Scenario: Not yet funded
  Given at least one member is pending/overdue
  Then no CycleFunded is emitted
```
**Technical spec**
- In the `ContributionSettled` handler (E4-S2), after marking paid, check funded status **inside a transaction with a row lock** on the `Cycle`/`Fund` (prevents two concurrent settlements both firing). If funded and not already, set `Cycle.status='current'→funded` (or a flag) and `OutboxService.emit('CycleFunded', { fundId, cycle, payeeUserId })`.
- Resolve recipient via shared helpers; `payeeUserId = nextPayee(order, cycle)` / `orderPayoutsByTrust`.
**Events:** `CycleFunded`.
**Tasks:** [ ] funded check w/ lock [ ] recipient resolution per rule [ ] emit once [ ] tests (funded, not-funded, concurrency)
**DoD:** `CycleFunded` fires exactly once when the last member pays; correct recipient per rule.

---

### E5-S2 · Disburse the payout (exactly once) [BE] (L)
**Story:** As the cycle recipient, I want to receive the pot to my MoMo automatically when the cycle is funded.

**Acceptance criteria**
```
Scenario: Payout
  Given CycleFunded is dispatched
  When the payout handler runs
  Then a Payout(status=initiated, externalref=p:fund:cycle) is created and MoolreService.transfer(...) is called to the recipient
  And on OBGH01 the response/transfer is recorded; settlement awaits webhook/status
Scenario: Exactly once
  Given CycleFunded is delivered twice OR two instances run
  Then the UNIQUE Payout.externalref + single-flight lock ensure only one transfer is attempted
Scenario: Insufficient float (safety)
  Given the Moolre balance < pot (should not happen, but)
  Then the payout is held and an alert is raised (no partial transfer)
```
**Technical spec**
- Outbox handler for `CycleFunded`: create `Payout` keyed on `externalref=p:{fundId}:{cycle}` (unique → second attempt no-ops); optional `getBalance()` guard; `MoolreService.transfer({ channel, receiver, amount: cyclePayoutAmount(...), externalref, sublistid })`.
- Settlement handler (webhook/status) posts the ledger payout: `fund_pot += amount; moolre_float -= amount+moolreFee; moolre_fee += moolreFee`; `Payout → settled`; emit `PayoutSettled`.
**Events/Ledger:** `PayoutSettled`; payout postings per `ledger.md`.
**Tasks:** [ ] payout handler (unique externalref) [ ] transfer call [ ] settle→ledger [ ] balance guard+alert [ ] tests (single transfer under double delivery, ledger sum-zero)
**DoD:** funded cycle pays the recipient once in sandbox; ledger balances; duplicates impossible.

---

### E5-S3 · Advance cycle, close fund, notify [BE] (M)
**Story:** As a member, I want the Susu to move to the next cycle (and complete at the end) with an SMS payout alert.

**Acceptance criteria**
```
Scenario: Advance
  Given PayoutSettled for cycle N (< totalCycles)
  Then currentCycle becomes N+1, all members reset to pending for the new cycle, and members are notified it's a new cycle
Scenario: Complete
  Given PayoutSettled for the last cycle
  Then Fund.status=completed, each member's TrustScore.fundsCompleted increments, FundCompleted is emitted
Scenario: Payout SMS
  Then the recipient gets: "CirclePay: Your <fund> payout of GHS X is on the way to your MoMo."
```
**Technical spec**
- `PayoutSettled` handler: advance `SusuDetail.currentCycle`, reset member cycle statuses (new `Cycle` row / per-cycle status), or close the fund + bump trust at the end (`FundCompleted`). Send payout SMS (Notifications). All idempotent.
- Trust update: recompute `segmentsFilled`/`onTimeRate`/`standing` (shared `trustStanding`, `onTimeRate`).
**Events:** `FundCompleted`.
**Tasks:** [ ] advance/reset [ ] complete + trust bump [ ] payout SMS [ ] idempotency [ ] tests
**DoD:** cycle advances correctly; final cycle completes the fund and credits trust; one payout SMS.

---

### E5-S4 · Payout/cycle UI [FE] (M)
**Story:** As a member, I want the Susu detail to reflect live cycle progress, who's next, and payout status.

**Acceptance criteria**
```
Scenario: Live detail
  Given a Susu in progress
  Then the detail shows current cycle X/N, the funded/paid count, the highlighted current recipient, my "your turn" cycle, and payout status (pending/sent) — from the API
```
**Technical spec** — extend the E3-S5 detail wiring with cycle/payout state from `GET /api/funds/:id`; show payout status and "your turn"; poll/refresh after contributions. `formatGhs` for amounts.
**Tasks:** [ ] render cycle+payout state [ ] your-turn marker [ ] refresh after pay [ ] tests
**DoD:** detail mirrors backend cycle/payout state end-to-end.

---

**Epic DoD:** when all members pay, the pot disburses to the correct recipient **exactly once**, the ledger balances (with `moolre_fee`), the cycle advances (or the fund completes + trust updates), and the recipient gets an SMS — all idempotent under duplicate events/instances. The Susu hero loop (create→contribute→payout) works end-to-end on Moolre sandbox.
