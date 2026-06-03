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

## Contribute / pay this cycle — `/pay`, `/funds/kumasi-traders`
Confirm amount + platform fee + total, pick MoMo source, approve with PIN → SMS receipt. **Money step: Collection** (`/open/transact/payment`, OTP flow). Mark `settled` only on webhook/status confirmation.

## Susu payout — server/job (not a public page yet)
When a cycle is funded, disburse the pot to the cycle's payee. **Money step: Transfer** (`/open/transact/transfer`). Guard with a balance check; reconcile via status.

## Medical fund — `/funds/kofi-mensah` (in-app), `/f/kofi-mensah` (public)
In-app: progress, contributors (incl. Anonymous), Contribute + Share (WhatsApp/SMS/Copy), USSD note, and the **payout route + verification badge**. Public: hero, "The story", contributors, trust footer ("funds go to the verified payee… Powered by Moolre"). **Money steps:** contribute = Collection; payout = Transfer via the chosen **route** — `hospital_momo` / `hospital_bank` (channel 2) / `individual_cash`.

### Medical payout (route-aware)
After verification, release funds by route: institutional routes pay the hospital MoMo/bank directly; `individual_cash` releases **escrow in receipt-gated tranches** to the KYC'd next-of-kin (ops-gated, caps, refunds). Full model: `references/medical-payouts.md`. Money step: Transfer (+ status/webhook to settle); each tranche posts to the ledger.

## Invite members — `/create` success → invite screen
Add members by MoMo number (+233) and/or share an invite link (`circlepay.app/join/<slug>`) via WhatsApp/SMS/Copy → "Send N invites". No money step.

## Activity & reconciliation — `/activity`
Feed of `contribution | payout | donation | joined` with in/out direction and refs. Backed by Moolre transaction history (`/open/account/status` type 2) once live.
