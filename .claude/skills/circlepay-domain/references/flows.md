# Flows (mapped to routes + Moolre)

Routes are under `frontend/app/`. "Money step" links to the **`moolre-integration`** skill.

## Onboarding — `/onboarding`
Phone (+233, network pick: MTN/Telecel/AirtelTigo, Ghana Card note) → OTP (6 digits, resend timer, USSD `*714#` helper) → Create PIN (4 digits, confirm; reassurance that CirclePay never asks for PIN by call/SMS). No money step.

## AI Fund Advisor — `/advisor`
User describes a need in plain language ("raise GHS 5,000 for my mother's surgery at Korle Bu"). Advisor recommends a fund **type** and returns a **configuration card** (fund type, beneficiary, hospital, target, payout = direct to hospital, shareable link) with Edit / Create actions. Output should map onto the same fields as the Create form. No money step (it configures, then hands off to create).

## Create fund — `/create`
- **Susu:** name, contribution amount, frequency (weekly/monthly), members, start month, payout rule (rotating/random) → live payout summary (`cyclePayoutAmount`). 
- **Medical:** name, goal, beneficiary, hospital (verify note), story, deadline, shareable toggle, payout = direct to verified hospital.
- Success screen → Susu: **Invite members**; Medical: **Share fund**. No money step at creation.

## Contribute / pay this cycle — `/pay?fund=<id>`, from `/funds/[id]`
Confirm amount + platform fee + total, pick MoMo source, approve with PIN → SMS receipt. **Money step: Collection** (`/open/transact/payment`, OTP flow). Sends `Idempotency-Key`; on `otp_required` prompts for the code then polls `GET /api/contributions/:externalref` to `settled`. Mark `settled` only on webhook/status confirmation.

## Susu payout — server/job (not a public page yet)
When a cycle is funded (last member's `ContributionSettled` → `CycleFunded`), disburse the pot to the cycle's payee. **Money step: Transfer** (`/open/transact/transfer`). Exactly-once via unique `Payout.externalref = p:{fundId}:{cycle}`; guard with a balance check; `PayoutSettled` posts the ledger + advances the cycle (or completes the fund + bumps trust).

## Defaults, grace & trust lock — server/job (background)
A scheduled **trust sweep** (every 30s, advisory-locked) reads each member's `dueAt`: past due → `overdue`/`grace` + SMS nudge; past the `GRACE_HOURS` window → `defaulted` + `TrustStanding=locked` **platform-wide** (`canJoinFund` then denies everywhere). Reversible via ops appeal (`POST /api/trust/:userId/unlock`). On-time payments update `TrustScore` on-time counters. See `references/risk-and-defaults.md`.

## Medical fund — `/funds/kofi-mensah` (in-app), `/f/kofi-mensah` (public)
In-app: progress, contributors (incl. Anonymous), Contribute + Share (WhatsApp/SMS/Copy), USSD note, and the **payout route + verification badge**. Public: hero, "The story", contributors, trust footer ("funds go to the verified payee… Powered by Moolre"). **Money steps:** contribute = Collection; payout = Transfer via the chosen **route** — `hospital_momo` / `hospital_bank` (channel 2) / `individual_cash`.

### Medical payout (route-aware)
After verification, release funds by route: institutional routes pay the hospital MoMo/bank directly; `individual_cash` releases **escrow in receipt-gated tranches** to the KYC'd next-of-kin (ops-gated, caps, refunds). Full model: `references/medical-payouts.md`. Money step: Transfer (+ status/webhook to settle); each tranche posts to the ledger.

## Invite members — `/create` success → invite screen; accept at `/join/<token>`
Admin adds members by MoMo number (+233) → each gets a unique invite link (`<APP_BASE_URL>/join/<token>`) by SMS. The invitee opens `/join/<token>` → accept-invite endpoint joins them (token must match their number) → routed into the fund. Susu join is **invite-only** (no open join). No money step.

## Activity & reconciliation — `/activity`
Feed of `contribution | payout | donation | joined` with in/out direction and refs. Backed by Moolre transaction history (`/open/account/status` type 2) once live.
