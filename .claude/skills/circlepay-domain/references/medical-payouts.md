# Medical Payouts — Routes, Cash Handling & Receipts

Medical/fundraiser payouts must work in the **real Ghanaian context**: many facilities have **no MoMo merchant and take cash**, and costs often sit outside the hospital (pharmacy, lab, blood, transport). "Verified hospital only" is too rigid. This model lets organizers name a receiver **without** reopening the fraud door, by scaling safeguards to risk and proving use after the fact.

## Payout routes (most-trusted first) — `MedicalPayoutRoute`

| Route | Payee | When | Trust handling |
|---|---|---|---|
| `hospital_momo` | Verified hospital MoMo merchant | Facility is onboarded | Direct payout, "Verified hospital" badge |
| `hospital_bank` | Hospital **bank account** (Moolre channel 2) + patient bill/folder ref | No MoMo, but has a bank account (most large facilities) | Name-matched; preferred institutional route |
| `individual_cash` | KYC'd **patient / next-of-kin** MoMo | Cash-only facility / external costs | **Escrow + receipt-gated tranches** (below) |

**Principle: pay the bill, not the person.** Always prefer an institutional route; use `individual_cash` only when there is genuinely no payable facility account.

## Payee verification — `PayeeVerificationStatus`

`unverified → pending → verified | rejected`. An organizer-entered provider starts `pending`; **ops** verifies via Moolre `receivername` name-match + a proforma/bill before any payout. Payout is **blocked** until `verified`. Surface the status on the fund.

## Escrow + receipt-gated tranches (`individual_cash` and high-value funds)

Raised funds sit in **escrow** — undisbursed `fund_pot` inside `moolre_float` — until released.

1. Release in **tranches** (`PayoutTranche`: `held → released → settled | refunded`, `amount`, `receiptId?`).
2. Each tranche **after the first** is gated on a **verified, stamped hospital `Receipt`** for the prior tranche (`canReleaseNextTranche` in `rules.ts`).
3. **Caps:** first-tranche + total caps for unverified/low-trust organizers; raise as trust/verification grows.
4. **Organizer gating:** only sufficiently-trusted organizers (or with a **guarantor**) can run `individual_cash`; new organizers get the lowest caps.
5. **Refund window:** donors can be refunded (ledger reversal to original payers) if verification fails or the fund is flagged before release.
6. **Post-payout receipts:** missing/late receipts hit the organizer's **trust score** and restrict future funds.

## Verification anchors (Ghana-appropriate)

- **Ghana Card** KYC of the receiver + **Moolre `receivername`** match on the MoMo/bank.
- **Hospital medical social-welfare officer** letter / referral (public hospitals have these for needy patients).
- **Proforma invoice / bill** up front; **stamped official receipt** after each tranche.
- **Community voucher** (assembly member / religious leader) for higher amounts.
- **Ops** adjudicates verification, appeals, and refunds (kept separate from organizers — see `roles-and-permissions.md`).

## Donor transparency (always on)

Every Medical fund shows its **route + verification status + trust badge** on the in-app and public pages, so donors give with informed consent:
- "✅ Verified hospital" (`hospital_momo`/`hospital_bank`, verified)
- "🏦 Hospital bank — pending verification"
- "👤 Goes to [Name] — receipts required" (`individual_cash`)

## Ledger & events

- A tranche release is a normal **payout posting** (`fund_pot += amount; moolre_float -= amount + moolreFee; moolre_fee += fee`) — see `ledger.md`. Escrow is simply the undisbursed `fund_pot` balance; no separate account needed.
- Refunds are **append-only reversals** to the original contributors.
- Events: `PayeeVerified`, `TrancheReleased`, `ReceiptSubmitted`, `MedicalFundRefunded` (outbox — drive SMS, trust updates, donor notices).

Types: `MedicalPayoutRoute`, `PayeeVerificationStatus`, `TrancheStatus`, `ReceiptKind`, `ReceiptStatus`, `Payee`, `PayoutTranche`, `Receipt` in `assets/domain/types.ts`. Helpers: `canReleaseNextTranche`, `splitIntoTranches` in `assets/domain/rules.ts`. Persistence: `circlepay-stack`.
