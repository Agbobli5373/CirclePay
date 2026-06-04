# Business Rules

## Susu (rotating savings)

1. **Cycles = members.** A Susu with N members runs N cycles. `totalCycles === memberCount`.
2. **Pot per cycle** = `contribution × members`. Demo: GHS 500 × 10 = GHS 5,000 each cycle.
3. **Payout order** is fixed at creation: `rotating` (predetermined sequence) or `random` (drawn). It does not change mid-Susu. Each member receives exactly once.
4. **Cadence** = `weekly` or `monthly`. Each cycle has a due date; contributions are expected before the payout.
5. **Per-cycle member status:** `paid` (✓ + date), `pending` (due in N days), `overdue`. A cycle's payout should only release once the cycle is funded (collected then disbursed the same cycle).
6. **One pot, one payee per cycle.** The current cycle is highlighted; the user's own cycle is marked "your turn".
7. **Invite-only, private circles.** A Susu is private: members join only via a unique invite link (`/join/<token>`) the admin sends to their MoMo number — there is no open/public join. The fund **starts** (member list + payout order lock, cycle-1 due dates set) when active members reach `memberCount`.

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
5. **Shortfall protection & fair defaults (the hard ROSCA problem).** The lock deters repeat offenders but doesn't protect *this* cycle's money. Funds use one or more of: refundable **deposit**, **trust-ordered payouts** (riskiest paid last), **guarantor**, or a **safety pool**; shortfalls are covered in that order and recorded in the ledger. Defaults follow a `overdue → grace → defaulted → appeal` lifecycle, and the lock is **reversible via appeal** (handles failed MoMo debits / wrong numbers). Full design: `references/risk-and-defaults.md`.

## Fund lifecycle & exits

1. **Under-subscribed Susu** (a `planning` pool never reaches its member count by its start date): it does **not** start; any deposits already paid are **refunded** (ledger reversal), and the fund is `cancelled`.
2. **Leaving before start:** a member may leave a `planning` Susu; deposit refunded; seat freed.
3. **Leaving after start:** not freely allowed — the rotation depends on every seat. Exiting mid-Susu is treated like the default path (deposit/guarantor/safety pool cover the remaining obligation); `MemberFundStatus = left`.
4. **Cancelling a fund:**
   - *Susu:* only cleanly cancellable before it starts (refund deposits). After start, it must wind down through the remaining cycles or an ops-supervised settlement.
   - *Fundraiser:* if cancelled or the goal lapses with funds unused, **refund contributors** (reverse to original payers where possible) — never silently redirect funds.
5. Every refund/reversal is a **new ledger transaction** (append-only), never an edit.

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
2. **USSD members are first-class:** a member with no smartphone can join (SMS prompt), **contribute via USSD + PIN**, and receive SMS receipts/reminders — same cycle accounting and ledger as app members. See `references/risk-and-defaults.md`.
3. Plain language, large tap targets, keyboard-friendly, semantic HTML, 4.5:1 contrast.
