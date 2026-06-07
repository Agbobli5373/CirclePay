# Backlog — Later Epics (outline)

These are **outlined** now and expanded to full stories/specs when their milestone is reached (same format as the MVP epics). Ordered by typical priority after the hero loop.

---

> **E6 (Defaults, Grace & Trust Lock) is now built** — see `E6-trust-defaults.md`. The **shortfall-coverage** half (deposit/safety-pool/guarantor consumption + `ShortfallCovered`, which needs deposit collection) remains deferred and is listed there.

## E7/E8 · Full Medical Payouts (escrow + receipt-gated tranches)
**Goal:** The complete cash-aware model deferred from EM. **Ref:** `circlepay-domain/references/medical-payouts.md`.
Candidate stories:
- **E7-S1** `individual_cash` route — ✅ **built** (consolidation phase): organizer releases to a person's MoMo without the ops-verification gate (`payeeNetwork` chooses the channel). **Still later:** KYC'd next-of-kin payee + per-route caps + organizer trust gating / guarantor.
- **E7-S2** Tranche release — ✅ **built** (consolidation phase): release the available delta any time (indexed `mp:{fundId}:{n}`), no auto-complete, explicit `Close`. **Still later:** a planned `splitIntoTranches` schedule and verification-triggered first tranche (today release is organizer-driven, not schedule-driven).
- **E7-S3** Receipts: upload (`proforma`/`receipt`), ops verify; `canReleaseNextTranche` gate; `ReceiptSubmitted`/`TrancheReleased`. *(schema fields `requiresReceipts`/`firstTrancheCap`/`totalCap` already exist — feature not built.)*
- **E7-S4** Refunds: cancel/lapse/flagged → reverse contributions to original payers (append-only); `MedicalFundRefunded`. *(also covers stuck `held` payout tranches → retry/refund.)*
- **E7-S5** Verification anchors: social-welfare letter / referral / community voucher capture.

## E9 · Activity Feed & Notifications
**Goal:** Unified activity + comms. **Ref:** `circlepay-domain/references/{entities,flows}.md`, `moolre-integration/references/sms.md`.
- **E9-S1** Activity feed API/UI from `ActivityItem` (+ derive from ledger/events).
- **E9-S2** Notification center (in-app bell) + preferences.
- **E9-S3** SMS templating + language; delivery logging.

## E10 · USSD Flows
**Goal:** Feature-phone parity. **Ref:** `circlepay-domain/references/{ghana-context,risk-and-defaults}.md`, `moolre-integration` (USSD `*203#`).
- **E10-S1** USSD session handler (Moolre USSD integration): authenticate (phone + PIN).
- **E10-S2** Join a Susu / accept invite via USSD.
- **E10-S3** Contribute via USSD (collection with `sessionid`).
- **E10-S4** Check balance / next payout via USSD.

## E11 · AI Advisor Seam
**Goal:** Plain-language → validated fund config; swap stub → Claude later. **Ref:** `circlepay-stack/references/ai-advisor.md`, `claude-api` skill.
- **E11-S1** `POST /api/advisor/configure` returns a Zod-validated fund config (rules-based stub).
- **E11-S2** Wire `/advisor` UI to the endpoint (replace scripted demo).
- **E11-S3** (Later) Claude structured-output implementation behind the same contract.

## E12 · Ops / Admin Console
**Goal:** Tools for the `ops` role. **Ref:** `circlepay-domain/references/{roles-and-permissions,compliance}.md`.
- **E12-S1** Payee/hospital verification queue.
- **E12-S2** Appeals queue.
- **E12-S3** AML/transaction-monitoring flags + review.
- **E12-S4** Ledger reconciliation dashboard (float vs Moolre) + alerts.

## E13 · Hardening & Compliance
**Goal:** Production readiness. **Ref:** `circlepay-stack/references/operations.md`, `circlepay-domain/references/compliance.md`.
- **E13-S1** Global rate limiting + abuse protection.
- **E13-S2** Observability: structured logs, metrics, Sentry, alerting (ledger drift, stuck payouts, failed outbox).
- **E13-S3** Data protection: PII encryption at rest, log masking, data export/delete.
- **E13-S4** i18n rollout (English/Twi/Ga) across app + SMS/USSD.
- **E13-S5** KYC tiers + MoMo limit enforcement.
- **E13-S6** Load/perf pass + per-route bundle budgets (use `senior-frontend`).

---

When starting a later epic, copy the MVP epic format (stories with Gherkin AC + technical spec + tasks + DoD) and move it into its own `E#-*.md` file; update `README.md`'s epic map.
