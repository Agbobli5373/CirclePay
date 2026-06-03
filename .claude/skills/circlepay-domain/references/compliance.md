# Compliance, Trust & Governance

CirclePay moves Ghanaians' money — judges, partners, and regulators will probe this. Bake the posture in from day one.

## Regulatory posture (Bank of Ghana)

- **Non-custodial by design.** CirclePay is **not** a deposit-taking or e-money institution. It never holds customer funds: money is collected and disbursed **through Moolre, same cycle**, under **Moolre's licence/rails**. CirclePay is a software layer that orchestrates funds + records the ledger.
- This is the core compliance argument — keep it true in code (no internal user wallet balances; `moolre_float` is Moolre's, not a customer liability we control) and state it in product copy ("CirclePay never holds your savings").
- Susu/ROSCA operation: position as facilitating peer transfers, not running a collective investment scheme. If pooling ever lingers beyond a cycle, revisit licensing.

## KYC & limits

- Identity anchor: **Ghana Card-verified MoMo number** (per onboarding). Inherit the network's **KYC tier** and **MoMo wallet limits** (min/max balance and daily/transaction caps) — CirclePay must not let a fund's contribution/payout exceed the user's tier limits.
- Configure per-fund **min/max contribution** and a **max members / max pot** guard.
- Store the minimum PII needed; treat phone + Ghana Card reference as sensitive (see Data Protection).

## Data protection (Ghana Data Protection Act, 2012 / Act 843)

- Collect only what's needed; state purpose; get consent at onboarding.
- **Encrypt PII at rest** (phone, Ghana Card ref) and in transit (HTTPS everywhere); hash the PIN (argon2) and OTPs.
- Support data-subject rights: export/delete on request (subject to financial-record retention).
- Don't log full phone numbers / PII in plaintext logs (mask).

## AML / fraud monitoring

- Medical fundraising + payouts is a **laundering/fraud vector**. Add basic transaction monitoring: velocity/threshold flags, repeated payouts to the same receiver, mismatched names (use Moolre's `receivername` to flag), and structuring patterns.
- Sanctions/PEP screening is likely Moolre's responsibility under their licence — confirm the boundary and don't duplicate unsafely.
- Keep the **immutable ledger** as the audit trail; make it queryable for investigations.

## Trust governance & appeals

- The **platform-wide defaulter lock** is powerful and must be **fair and reversible** (see `risk-and-defaults.md`).
- **Who decides:** an **Ops/Trust role** (not a fund admin) adjudicates appeals and verifies hospitals — keep this separate from members to avoid conflicts of interest (see `roles-and-permissions.md`).
- Log every standing change (lock/unlock) with reason + actor for accountability and dispute defence.
- Guard against abuse: a fund admin should not be able to falsely mark a member defaulted to seize a deposit — defaults must be driven by **missed contributions the ledger can prove**, not admin discretion.

## Medical-fund integrity

- **Tiered, cash-aware payouts** (`references/medical-payouts.md`): prefer institutional routes (`hospital_momo`/`hospital_bank`); allow a KYC'd individual (`individual_cash`) only with **escrow + receipt-gated tranches**, caps, organizer trust gating, and ops review — since many Ghanaian facilities take cash.
- **Beneficiary + payee verification** before payout (`PayeeVerificationStatus = verified`); Moolre `receivername` name-match + proforma/bill; ops adjudicates.
- **Donor transparency:** the payout route + verification badge are always shown so donors give with informed consent.
- If a fund is cancelled or funds go unused, **refund contributors** (ledger reversal to the original payers where possible) rather than redirecting funds.

> This is product/operational guidance, not legal advice. Validate the licensing boundary with Moolre and a Ghanaian fintech lawyer before going live.
