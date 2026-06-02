---
name: "moolre-integration"
description: Integrate the Moolre payments API (collections, disbursements/payouts, transaction status, account balance, webhooks, USSD) for mobile money (MTN, Telecel, AirtelTigo) and bank transfers in Ghana. Use when implementing or debugging payments, contributions, payouts, MoMo collection with OTP, Moolre webhooks, or wiring CirclePay's contribution/payout flows to Moolre. Framework-agnostic (Next.js route handlers or Nest.js).
---

# Moolre Integration

How to call the Moolre API to collect mobile-money payments, disburse payouts, check status, read balances, and handle webhooks — mapped onto CirclePay's Susu and Medical flows.

> Source of truth: https://docs.moolre.com (AI pages at `/ai/*`, full dump at `/llms-full.txt`). Always re-check the live docs for channel codes and new fields before going live.

## Golden rules

1. **Server-side only.** API keys must NEVER appear in client code or the browser bundle. All Moolre calls go through a backend (Next.js route handler or Nest.js service). The frontend calls *your* backend; your backend calls Moolre.
2. **Idempotency via `externalref`.** Every collection/transfer needs a unique `externalref`. Reusing one returns `TP13`. Use a deterministic scheme so retries are safe (see `references/circlepay-flows.md`).
3. **Never trust the client for "paid".** Mark a contribution/payout settled only after confirming with the **status endpoint** or a verified **webhook** — not from the initiating response alone.
4. **Money is integer-safe.** Send amounts as strings (e.g. `"500"`); store minor units / use a decimal-safe type server-side.

## Environment

```
MOOLRE_BASE_URL=https://sandbox.moolre.com   # https://api.moolre.com in production
MOOLRE_API_USER=your-moolre-username
MOOLRE_API_KEY=your-private-api-key          # required in LIVE only (not sandbox)
MOOLRE_PUBKEY=your-public-api-key            # validation / payment links
MOOLRE_VASKEY=your-vas-key                   # SMS / WhatsApp only
MOOLRE_ACCOUNT_NUMBER=100000157291           # your Moolre account number
MOOLRE_WEBHOOK_SECRET=long-random-string     # your own guard for the callback URL
```

Auth headers on every request: `X-API-USER` (always) and `X-API-KEY` (private for transact, public for validation/links; omitted in sandbox). `X-API-PUBKEY` for payment links/validation; `X-API-VASKEY` for SMS/WhatsApp. Details: `references/api-overview.md`.

## Channel codes (verify against live docs)

- **Collections** (`/transact/payment`): `13`=MTN, `6`=Telecel, `7`=AirtelTigo.
- **Disbursements** (`/transact/transfer`): `1`=MTN, `6`=Telecel, `7`=AirtelTigo, `2`=Instant Bank Transfer.

## Core endpoints (all `POST`, base = `MOOLRE_BASE_URL`)

| Purpose | Path | Key body fields | Success code |
|---|---|---|---|
| Collect (MoMo debit) | `/open/transact/payment` | `type:1, channel, currency, payer, amount, externalref, accountnumber, [otpcode], [sessionid]` | `TR099` |
| Disburse (payout) | `/open/transact/transfer` | `type:1, channel, currency, amount, receiver, sublistid, externalref, [reference], accountnumber` | `OBGH01` |
| Transaction status | `/open/transact/status` | `type:1, idtype(1=externalref,2=moolre id), id, accountnumber` | `SS01` |
| Balance | `/open/account/status` | `type:1, accountnumber` | `SW01` |
| List transactions | `/open/account/status` | `type:2, accountnumber, [startdate,enddate,limit,status]` | — |

Every response is `{ status, code, message, data, go }`. `status:1` = accepted; check `code` and `data.txstatus` for the real outcome. Codes table: `references/status-codes.md`.

## Collection with OTP (the important flow)

1. `POST /open/transact/payment` with the contribution details.
2. If response `code === "TP14"` → Moolre sent the payer an SMS OTP. Collect the code from the user and **resubmit the same request plus `otpcode`** (keep the same `externalref`).
3. On `TR099`, the debit request is initiated; the payer approves the USSD prompt on their phone.
4. Confirm final settlement via webhook (`code:"P01"`, `data.txstatus:1`) or by polling `/transact/status`.

Full request/response in `references/collections.md`.

## CirclePay mapping

| App action | Moolre call |
|---|---|
| Susu **contribution** (member pays in) | Collection `/transact/payment` (MoMo, OTP) |
| Susu **payout** to the cycle's recipient | Disbursement `/transact/transfer` to their wallet |
| **Medical** contribution | Collection `/transact/payment` |
| **Medical** payout to verified hospital | Disbursement `/transact/transfer` (wallet or bank `channel:2`) |
| Receipt / "Paid" state | Webhook `P01` or `/transact/status` `SS01` |

Reference-and-mapping detail, plus the `externalref` scheme (`fundId-cycle-userId`): `references/circlepay-flows.md`.

## Using the client

A framework-agnostic `MoolreClient` is in `assets/moolre-client.ts` (reads the env vars above; methods `collect`, `transfer`, `getStatus`, `getBalance`, `listTransactions`). Copy it into your backend (`lib/` for Next.js or a provider in Nest.js). Worked examples in `assets/examples/`:

- `nextjs-collect-route.ts` — collect a contribution + OTP resubmit.
- `nextjs-webhook-route.ts` — verify + re-confirm + mark paid.
- `nestjs-moolre.service.ts` — same client as a Nest provider/controller.
- `payout-transfer.ts` — disburse to the next member / a hospital.

## References

- `references/api-overview.md` — base URLs, headers/keys, security, channels.
- `references/collections.md` — collect + OTP, request/response.
- `references/disbursements.md` — transfer (wallet & bank).
- `references/status-and-balance.md` — status, balance, transaction list.
- `references/webhooks.md` — payload, registering `callback`, hardening (no built-in signature).
- `references/status-codes.md` — result codes.
- `references/circlepay-flows.md` — app → Moolre mapping and idempotency.
