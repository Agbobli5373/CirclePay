# Business Rules

## Susu (rotating savings)

1. **Cycles = members.** A Susu with N members runs N cycles. `totalCycles === memberCount`.
2. **Pot per cycle** = `contribution × members`. Demo: GHS 500 × 10 = GHS 5,000 each cycle.
3. **Payout order** is fixed at creation: `rotating` (predetermined sequence) or `random` (drawn). It does not change mid-Susu. Each member receives exactly once.
4. **Cadence** = `weekly` or `monthly`. Each cycle has a due date; contributions are expected before the payout.
5. **Per-cycle member status:** `paid` (✓ + date), `pending` (due in N days), `overdue`. A cycle's payout should only release once the cycle is funded (collected then disbursed the same cycle).
6. **One pot, one payee per cycle.** The current cycle is highlighted; the user's own cycle is marked "your turn".

## Fundraising (Medical / Education / Business)

1. **Goal-based:** progress = `raised / goal`. Many contributors, no rotation.
2. **Medical requires a beneficiary**; **hospital must be verified** before any payout, shown with a verified badge.
3. **Payout is direct** to the verified recipient/hospital — never to an individual's personal balance. Reinforce "funds go straight to the hospital" in copy.
4. **Anonymous contributions** are allowed (display "Anonymous"); amounts still count toward the total.
5. **Shareable public link** (`/f/<slug>`) lets non-users contribute; a slim public page shows hero, story, contributors, and the trust footer.

## Trust & defaulter protection

1. **One score, platform-wide.** Reliability is per **User**, not per fund.
2. Score is driven by **on-time rate** and **funds completed**; rendered as 5 segments + a standing label (`new → building → good → excellent`).
3. **Defaulting → platform-wide lock.** A defaulter's standing becomes `locked`; `canJoinFund` must deny them across **all** funds, not just remove them from one. This is CirclePay's moat ("trust that compounds").
4. Members may carry a trust tag (`reliable` / `new`) shown to others for transparency.

## Money & fees

1. **CirclePay never holds savings.** Collect and disburse within the same cycle via Moolre.
2. A small **platform fee** applies to a contribution (demo: GHS 5 on GHS 500). Show fee + total before confirming.
3. Store money as integer **pesewas**; never use floats for arithmetic. Format with `formatGhs`.

## Security

1. Auth is **phone → OTP → 4-digit PIN**. Networks: MTN/Telecel/AirtelTigo; numbers are Ghana Card-verified.
2. CirclePay **never** asks for the PIN by call or SMS — state this in onboarding copy.
3. Payments require PIN approval; receipts are delivered by SMS.

## Settlement & idempotency (defer mechanics to `moolre-integration`)

1. A contribution/payout is only **settled** after Moolre webhook (`P01`) or status (`SS01`, `txstatus:1`) confirms it — never off the initiating response.
2. Every money movement carries a unique, retry-stable `externalref` (e.g. `c:{fundId}:{cycle}:{userId}`, `p:{fundId}:{cycle}`).
3. "Mark paid" must be idempotent (keyed on `externalref`).

## Accessibility / inclusivity

1. Every core action reachable via **USSD/MoMo** (no smartphone/internet required).
2. Plain language, large tap targets, keyboard-friendly, semantic HTML, 4.5:1 contrast.
