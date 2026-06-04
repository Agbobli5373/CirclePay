# E6 · Defaults, Grace & Trust Lock — **built** (shortfall coverage deferred)

**Goal:** Enforce CirclePay's moat — a missed Susu contribution locks the member **platform-wide** — fairly (overdue → grace → defaulted → appeal), and grow an on-time reputation. This epic was promoted from the `BACKLOG-later.md` outline and implemented in the `trust` feature + contributions/funds.

**Depends on:** E3, E4, E5. **References:** `circlepay-domain/references/{risk-and-defaults,business-rules}.md`, `circlepay-stack/references/operations.md`.

> Per-cycle `MemberStatus` (`paid|pending|overdue`) is distinct from fund-level `MemberFundStatus` (`active|grace|defaulted|left|completed`); the platform-wide consequence is `TrustStanding=locked`.

---

### E6-S1 · Cadence due dates [BE] (S) — DONE
When a Susu fills (starts), each member's cycle-1 `dueAt` is set from `frequency` (weekly=7d, monthly=30d); on cycle advance (`PayoutSettled`) members reset to `pending` and a new `dueAt` is set. (`funds.service` start block; payouts advance.)

### E6-S2 · Overdue / grace / default sweep [BE] (M) — DONE
`trust.scheduler` runs every 30s, single-flight via the Postgres advisory lock (`LockService`, exported from the outbox module):
- `pending` + `now > dueAt` (within grace) → `status=overdue`, `fundStatus=grace`, SMS nudge.
- unpaid + `now > dueAt + GRACE_HOURS` → `fundStatus=defaulted` + `TrustStanding=locked` (in one tx) + SMS + activity item.
- Scoped to started, active Susu; grace window = `GRACE_HOURS` (default 48h).
**DoD:** a member past grace is locked; `canJoinFund` denies them across **all** funds (verified live: locked user gets `403 TRUST_LOCKED` on create/join).

### E6-S3 · On-time scoring [BE] (S) — DONE
On each settled contribution, `TrustScore.contributionsTotal`/`contributionsOnTime` update and `onTimeRate = round(onTime/total·100)` (paid on/before `dueAt`). (contributions settlement.)

### E6-S4 · Appeal / unlock [BE] (S) — DONE
`POST /api/trust/:userId/unlock` (ops-only) restores standing from `segmentsFilled` and reinstates `defaulted` memberships to `active`. (`trust.service` + `trust.controller`.)

### E6-S5 · Frontend lock surfaces [FE] (S) — DONE
Fund detail shows member `grace`/`defaulted` chips + a "locked" banner; profile shows a locked notice; a locked user's create/join is blocked with a clear error.

### Demo affordance
`POST /api/funds/:id/dev/expire` (non-prod only) backdates the caller's `dueAt` so the sweep marks overdue/default within one tick — lets a judge see the lock fire in seconds.

---

## Deferred (the next epic — NOT in E6 as built)
- **Shortfall coverage:** consume the defaulter's **deposit** → **safety pool** → guarantor → delay/pro-rate at payout time; emit `ShortfallCovered`; postings per `risk-and-defaults.md`. Requires **deposit collection** first (`requiresDeposit` is currently rejected at create).
- **Guarantor** model + **safety-pool** surcharge config.
- Richer appeal workflow (member-initiated dispute + ops queue, E12) vs the current ops-only unlock.

**Epic DoD (met for the built scope):** a missed contribution moves the member through overdue→grace→defaulted, locks them platform-wide, is reversible by ops appeal, and on-time payments build the trust score — all idempotent and single-flight.
