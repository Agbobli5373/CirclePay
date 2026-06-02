# Moolre API — Overview, Auth & Conventions

## Base URLs

| Environment | Base URL | Keys required? |
|---|---|---|
| Sandbox | `https://sandbox.moolre.com` | No (`X-API-KEY` not required) |
| Live | `https://api.moolre.com` | Yes |

All API calls in this skill are `POST` with a JSON body and JSON response.

## Authentication headers

Generate keys in the Moolre dashboard: **Profile → Security → API Key**. The **private** key is shown only once; regenerating it (or changing your password) invalidates the previous private key. The **public** key is stable (~5 years).

| Header | Required | Used for |
|---|---|---|
| `X-API-USER` | Always | Your Moolre username |
| `X-API-KEY` | Live only | Private key for `/transact/*`; public key for validation/payment links |
| `X-API-PUBKEY` | When generating payment links / validation | Public key |
| `X-API-VASKEY` | SMS / WhatsApp endpoints only | Value-added-services key |

Example headers (live):

```
Content-Type: application/json
X-API-USER: your-username
X-API-KEY: your-private-key
```

> In **sandbox**, send only `X-API-USER` (and `Content-Type`). Keys are not validated.

## Security rules

- Keys are **secrets** — never commit them, never ship them to the browser. Keep all Moolre calls behind your own backend.
- Store keys in environment variables (see SKILL.md "Environment").
- Rotate the private key if it leaks; update `MOOLRE_API_KEY` everywhere.

## Standard response envelope

Every endpoint returns:

```json
{
  "status": 1,        // 1 = request accepted, 0 = rejected (can be string "1"/"0")
  "code": "TR099",    // result code — the real meaning (see status-codes.md)
  "message": null,     // human message or array of messages
  "data": {},          // payload (object, string UUID, or field name on errors)
  "go": null
}
```

Treat `status:1` as "the request was accepted", not "the money moved". Always inspect `code` and (for status checks) `data.txstatus`.

## Channel codes (verify against live docs before launch)

- **Collections** (`/open/transact/payment`): `13` = MTN, `6` = Telecel, `7` = AirtelTigo.
- **Disbursements** (`/open/transact/transfer`): `1` = MTN, `6` = Telecel, `7` = AirtelTigo, `2` = Instant Bank Transfer.

> Note the collection vs disbursement MTN codes differ (13 vs 1). Keep them in separate enums.

## Currency

Ghana Cedis: `"GHS"`. Amounts are sent as **strings** (e.g. `"500"`).

## Account number

`accountnumber` = your Moolre wallet/account number (e.g. `100000157291`), included in nearly every request. Store as `MOOLRE_ACCOUNT_NUMBER`.
