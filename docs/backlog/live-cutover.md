# Moolre live cutover — readiness checklist (Phase 2 / Milestone D)

> **Status: ready to execute the moment Moolre activates API access (`AIN04`).** The whole
> money path (Susu contributions, deposits, payouts, medical donations + payouts, shortfall
> coverage) is verified on the in-process **mock** that self-settles via the real webhook
> pipeline. Going live is a config flip + a smoke test — not a build — **except** the two
> items below (D1 fee capture, D2 reconciliation) which need a real Moolre response shape to
> wire correctly, and so are deliberately deferred to this checklist rather than guessed at now.

## 0. Pre-flight (no Moolre dependency — do anytime)
- [ ] Confirm `.env` has the live values and is **never committed** (it's gitignored):
  `MOOLRE_BASE_URL` (https://api.moolre.com), `MOOLRE_API_USER`, `MOOLRE_API_KEY` (live private key),
  `MOOLRE_ACCOUNT_NUMBER`, `MOOLRE_VASKEY` + `MOOLRE_SMS_SENDER_ID` (approved Sender ID for SMS),
  `MOOLRE_SUBLIST_ID` (payout beneficiary sublist), `MOOLRE_WEBHOOK_SECRET` (long, random).
- [ ] `MOOLRE_MOCK_ENABLED=false` in the live/staging env. (In production the mock is hard-guarded
  off regardless via `NODE_ENV !== 'production'`, but set it explicitly too.)
- [ ] Webhook reachable at `POST /api/webhooks/moolre/{MOOLRE_WEBHOOK_SECRET}` and registered with
  Moolre. Auth model today = **secret path token + server-side `MoolreService.isSettled()` re-confirm**
  before any ledger post (Moolre sends no HMAC). Confirm the secret is long/random and **never logged**.

## 1. Cutover (on `AIN04` activation)
- [ ] Point a **staging** env at live Moolre with a tiny float.
- [ ] **Live smoke** (low value, e.g. GHS 1):
  - one **collect** (a Susu contribution or deposit) → OTP on a real handset → settles via webhook;
  - one **transfer** (a cycle payout or medical payout) to a test MoMo number;
  - confirm both produce settled `Contribution`/`Payout` rows and balanced `LedgerTransaction`s.
- [ ] Reconcile the two live transactions against the Moolre dashboard statement by hand.
- [ ] **Rollback**: set `MOOLRE_MOCK_ENABLED=true` (non-prod) to return to local testing — no code change.

## D1 · Capture the real `moolre_fee`  (needs a live response to wire)
Today three settlement sites post `moolreFee: 0` (the ledger still balances; the fee just isn't
separately booked yet):
- `backend/src/contributions/contributions.settlement.ts` (`moolreFee = 0`)
- `backend/src/payouts/payouts.service.ts` (`moolreFee = 0`)
- `backend/src/fundraisers/fundraisers.service.ts` (medical payout, `moolreFee: 0`)

`contributionPostings` / `payoutPostings` already accept `moolreFee` + `moolreFeeAccountId` and book a
`moolre_fee` leg when it's > 0 — so wiring is a one-line change **once we know where the fee is**:
- **Transfers (payouts):** `transfer()` returns `TransferData.fee` / `amountfee` at disburse time. To
  use it at settlement, capture it then and **persist it** (add a `fee` column to `Payout`, set it in
  `disburse`, read it in `settle`). Verify the field name + units (pesewas vs GHS string) on a live
  transfer first.
- **Collections (contributions/deposits):** `StatusData` (from `getStatus`) currently exposes **no fee**
  field — only `amount` and `value`. Before wiring, confirm on a live collect/status response whether
  the fee is derivable (e.g. `amount − value`) or returned elsewhere; do **not** guess.
- [ ] Once confirmed: thread the fee in + a unit test (mock the client to return a fee; assert a
  `moolre_fee` leg is posted and the transaction still sums to zero).

## D2 · Reconciliation cron  (needs live `getBalance` semantics)
- [ ] Add `backend/src/reconciliation/reconciliation.cron.ts` mirroring the outbox dispatcher:
  `@Cron(EVERY_5_MINUTES)` wrapped in `lock.tryWithLock(<new key>, …)` (`pg_try_advisory_xact_lock`,
  see `outbox/lock.service.ts`).
- [ ] Compare the `moolre_float` ledger balance (`LedgerService.balance`) to
  `MoolreService.getBalance()` (`BalanceData.balance`) — **confirm the units first** (the ledger is
  integer pesewas; Moolre's `balance` is a number of unconfirmed unit). Alert/log on drift beyond a
  small threshold. `getBalance()` / `listTransactions()` already exist and are currently unused.
- [ ] Optional pre-live value: a *self-consistency* variant of this job (assert every
  `LedgerTransaction`'s postings sum to zero and `moolre_float` = Σ its legs) is Moolre-independent and
  could ship now if a ledger watchdog is wanted before cutover.

## Notes
- KYC tiers + MoMo transaction limits (`E13-S5`) are separate and not required for cutover.
- This checklist supersedes the D1/D2/D3 bullets in `PHASE-2-gap-closing.md`.
