# Risk, Defaults & Shortfall Protection

The hard problem in any rotating-savings scheme (Susu/ROSCA): a member who **defaults after receiving their payout**. The platform-wide trust lock *deters* repeat offenders, but it does not by itself *protect the other members' money this cycle*. This doc defines how CirclePay covers shortfalls and handles the default lifecycle fairly.

## Shortfall-protection mechanisms (configurable per Susu)

Pick one or combine at fund creation:

1. **Refundable deposit / collateral (default for higher-value Susu).**
   Each member pays a deposit (e.g. one contribution) at join, held in a `deposit` ledger account (a liability we owe back). If they miss a contribution, the deposit covers it; the deposit is **refunded** when the Susu completes successfully.
2. **Trust-ordered payouts.**
   `payoutRule = 'trust_ordered'` → highest-trust members are paid earliest, riskiest **last**. A low-trust member must therefore contribute through most cycles before receiving anything, sharply cutting exposure. (vs `rotating` fixed order / `random` draw.)
3. **Guarantor.**
   A member can be vouched for by a higher-trust user who accepts liability for a shortfall. Optional; good for `new` members joining established circles.
4. **Safety pool (mutual insurance).**
   A tiny surcharge per contribution accrues into a `safety_pool` ledger account that covers shortfalls across funds. Spreads risk; transparent.

## Covering a shortfall at payout time

When a cycle is due to pay out but is **underfunded** because a member defaulted, cover in this order and **record every step in the ledger** (emit `ShortfallCovered`):

1. The defaulter's **deposit**.
2. The **safety pool** (if enabled).
3. **Guarantor** charge (if any).
4. Last resort: **delay or pro-rate** the payout (members are notified by SMS) — never silently lose money.

Example postings (deposit covers a missed GHS 500):
```
deposit(fund:member) += 500      // consume the held deposit
fund_pot(fund)       -= 500       // pot made whole for the payout
```

## Default lifecycle (fair, with appeal)

```
pending ──(due date passes)──▶ overdue
overdue ──(grace window, SMS reminders)──▶ grace
grace   ──(grace expires, still unpaid)──▶ defaulted
   • forfeit deposit to cover the cycle  → emit ShortfallCovered
   • emit MemberDefaulted → TrustStanding = locked (PLATFORM-WIDE)
defaulted ──(member disputes)──▶ appeal
   • ops/admin review (wrong number, failed MoMo, hardship, network error)
   • upheld  → standing restored / unlocked, deposit reinstated
   • rejected → remains locked
```

- **Grace window** is configurable (e.g. 48–72h) with escalating SMS reminders (`MemberOverdue` → reminders).
- **Lock is reversible** only via the appeal path — this defuses the "informal blacklist" fairness critique and handles false positives (failed MoMo debits, wrong numbers).
- A locked user **cannot join any fund** (`canJoinFund` denies) until cleared.

## Member fund status

Distinct from the per-cycle `MemberStatus` (`paid|pending|overdue`), a member has a **fund-level** status: `active | grace | defaulted | left | completed` (`MemberFundStatus`). The platform-wide consequence is carried by `TrustStanding = locked`.

## USSD participation (not just invites)

A Susu member may have no smartphone. They must be able to: receive a join prompt by SMS, **contribute via USSD** (`*...#` → enter PIN), and get SMS receipts/reminders. The fund's member list and cycle accounting are identical whether a member acts via app or USSD — the contribution still flows through Moolre Collections and posts to the same ledger.

## Hospital verification (Medical)

A Medical fund's `hospital` is `hospitalVerified = false` until checked against an approved-providers list (and/or Moolre's verified payee directory). Payout (`direct`) is **blocked** until verified. Surface the "Verified hospital" badge only when true.

## Types & events

`SusuFund.requiresDeposit/depositAmount`, `payoutRule: 'trust_ordered'`, `Member.fundStatus/depositPaid`, ledger accounts `deposit`/`safety_pool`, events `MemberInGrace`/`ShortfallCovered` — see `assets/domain/types.ts`. Payout-ordering helper `orderPayoutsByTrust` in `assets/domain/rules.ts`. Persistence: `circlepay-stack`.
