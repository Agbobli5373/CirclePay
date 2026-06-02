# Moolre Result Codes

The `code` field carries the real meaning of a response. Common codes seen across endpoints (confirm the full list against the live docs):

| Code | Meaning | Where |
|---|---|---|
| `TR099` | Payment request / internal transfer initiated (success) | Collection |
| `TP14` | OTP/verification required — resubmit with `otpcode` | Collection |
| `TP13` | `externalref` missing or not unique | Collection |
| `OBGH01` | Pay-out successful | Disbursement |
| `SS01` | Transaction successful | Status check |
| `SW01` | Wallet found (balance returned) | Account status |
| `P01` | Transaction successful (webhook event) | Webhook |
| `AIN01` | Authentication error (bad/missing keys) | Any |

## Handling guidance

- `status` may come back as number `1` or string `"1"` — normalize (`String(status) === "1"`).
- Treat the **request** as accepted on `status:1`, but treat the **money** as moved only on `txstatus:1` (from status check or webhook).
- `AIN01` → check `X-API-USER` / `X-API-KEY` and that you're hitting the right base URL (sandbox vs live).
- `TP13` → your `externalref` collided; generate a fresh unique one (or you double-submitted — reconcile via status before retrying).
- `TP14` → expected for OTP-protected collections; not an error. Drive the OTP resubmit.

> This table is a starting set from the docs samples. Always cross-check `https://docs.moolre.com` for the authoritative, complete code list before launch.
