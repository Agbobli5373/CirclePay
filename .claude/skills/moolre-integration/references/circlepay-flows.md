# CirclePay ↔ Moolre Flow Mapping

How each CirclePay action maps to Moolre, with the idempotency scheme.

## Action → Moolre call

| CirclePay action | Moolre endpoint | Channel | Notes |
|---|---|---|---|
| Susu **contribution** (member pays the cycle) | `/open/transact/payment` | collection (13/6/7) | OTP flow; `payer` = member MoMo |
| Susu **payout** to cycle recipient | `/open/transact/transfer` | disbursement (1/6/7) | `receiver` = recipient MoMo |
| **Medical** contribution | `/open/transact/payment` | collection | same as Susu contribution |
| **Medical** payout to hospital | `/open/transact/transfer` | wallet or bank (`2`) | "Direct to verified hospital" |
| Mark "Paid" / receipt | `/open/transact/status` or webhook | — | confirm `txstatus:1` before crediting |
| Activity feed / reconciliation | `/open/account/status` (`type:2`) | — | list transactions |
| Balance before payout | `/open/account/status` (`type:1`) | — | ensure funds |

## `externalref` scheme (idempotency)

`externalref` must be unique per logical money movement, but **stable across retries** of that same movement so a network retry doesn't double-charge.

Suggested patterns:

- Contribution: `c:{fundId}:{cycle}:{userId}` → `c:kumasi-traders:3:ama-asante`
- Payout: `p:{fundId}:{cycle}` → `p:kumasi-traders:3`
- Medical contribution: `mc:{fundId}:{userId}:{n}` (n increments only for a genuinely new attempt)
- Medical payout: `mp:{fundId}:{batch}`

Rules:
- Reuse the **same** ref when retrying the identical action (idempotent). Moolre returns `TP13` if it already exists — on `TP13`, call `/transact/status` with that ref to learn the real outcome instead of blindly retrying.
- Persist `{externalref → internal record}` so webhooks/status checks can resolve back to the contribution/payout row.
- **Book Moolre's fee.** Transfer responses return `fee`/`amountfee`; collections are charged too. Record a `moolre_fee` ledger leg for every movement so `moolre_float` reconciles to the real Moolre balance (see `circlepay-domain/references/ledger.md`).

## Settlement state machine (per contribution/payout)

```
initiated → (TR099)            # request accepted
   ↓ webhook P01 / status SS01 (txstatus:1)
settled  → mark Paid, emit SMS receipt, update fund progress
   ↓ status txstatus != 1 after timeout
failed   → surface to user, allow retry with a NEW externalref
```

## Where this lives in the app

The current CirclePay app *simulates* payment at `/pay` (frontend-only). To go live:
1. Put `MoolreClient` (see `assets/moolre-client.ts`) in a **server** module — Next.js `app/api/*` route handlers or a Nest.js `MoolreService`.
2. `/pay` (and the Susu detail "Pay this month") calls **your** API route, which calls `client.collect(...)`, handles the OTP step, and returns a status to the UI.
3. Add `app/api/webhooks/moolre/<secret>/route.ts` to receive `P01`, re-confirm via `getStatus`, then flip the contribution to Paid.
4. Payouts (Susu cycle recipient, hospital) call `client.transfer(...)` from a server action / job, guarded by a balance check.
