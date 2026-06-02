# Collections — Charge a Mobile Money wallet

Use to **collect** money from a customer's MoMo wallet (CirclePay: a Susu/Medical **contribution**).

## Endpoint

```
POST {BASE}/open/transact/payment
```

Headers: `X-API-USER`, `X-API-KEY` (live only), `Content-Type: application/json`.

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | integer | Yes | Always `1` |
| `channel` | string | Yes | `13`=MTN, `6`=Telecel, `7`=AirtelTigo |
| `currency` | string | Yes | `"GHS"` |
| `payer` | string | Yes | Customer phone number (e.g. `"0241234567"`) |
| `amount` | string | Yes | e.g. `"500"` |
| `externalref` | string | Yes | **Unique** per attempt; reuse → `TP13` |
| `accountnumber` | string | Yes | Your Moolre account number |
| `otpcode` | string | No | Only on the OTP resubmit step |
| `sessionid` | string | No | USSD session id, if collecting via USSD |
| `reference` | string | No | Optional note |

```json
{
  "type": 1,
  "channel": "13",
  "currency": "GHS",
  "payer": "0241234567",
  "amount": "500",
  "externalref": "kumasi-traders-c3-ama-001",
  "accountnumber": "100000157291"
}
```

## Responses

**Initiated (200)** — a USSD approval prompt is pushed to the payer's phone:

```json
{ "status": 1, "code": "TR099", "message": null, "data": "<uuid>", "go": null }
```

**OTP required (200)** — Moolre sent the payer an SMS code:

```json
{
  "status": 1,
  "code": "TP14",
  "message": "Please complete the verification process sent to you via SMS and try again.",
  "data": "all",
  "go": null
}
```

**Duplicate reference (400):**

```json
{ "status": "0", "code": "TP13", "message": "External Reference is required and must be unique.", "data": "externalref", "go": null }
```

## OTP flow (handle this explicitly)

1. POST the body above.
2. If `code === "TP14"` → ask the user for the SMS code, then **POST the exact same body again with `otpcode` added** (same `externalref`).
3. On `TR099`, the request is initiated; the payer approves the prompt on their phone.
4. **Settlement is asynchronous.** Confirm via webhook (`code:"P01"`, `data.txstatus:1`) or by polling `/open/transact/status`. Do not mark "Paid" off the `TR099` alone.

## Tips

- Generate `externalref` deterministically so a retry of the *same* logical payment reuses it (idempotent), but a genuinely new attempt gets a new one. See `circlepay-flows.md`.
- `payer` formatting: send the local 10-digit form (e.g. `0241234567`) unless the live docs state otherwise.
