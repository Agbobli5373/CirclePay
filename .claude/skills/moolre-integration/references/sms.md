# SMS (Value-Added Services)

Send transactional SMS — payment receipts, payout alerts, contribution reminders. Used by CirclePay for the "SMS receipt" after a contribution and overdue/payout notifications.

## Endpoint

```
POST {BASE}/open/sms/send
```

- Live: `https://api.moolre.com/open/sms/send`
- Sandbox: `https://sandbox.moolre.com/open/sms/send`

## Auth — different from transact endpoints

SMS authenticates with **`X-API-VASKEY` only**. Do **not** send `X-API-USER`/`X-API-KEY`, and there is **no `accountnumber`** in the body.

```
Content-Type: application/json
X-API-VASKEY: your-vas-key
```

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | integer | Yes | Always `1` |
| `senderid` | string | Yes | Registered & **approved** Sender ID, max 11 chars (e.g. `CirclePay`) |
| `messages` | array | Yes | One or more `{ recipient, message, ref? }` (bulk in a single call) |

`messages[].recipient` = phone number; `messages[].message` = text; `messages[].ref` = optional tracking reference.

```json
{
  "type": 1,
  "senderid": "CirclePay",
  "messages": [
    {
      "recipient": "0241234567",
      "message": "CirclePay: GHS 505.00 received for Kumasi Traders (Cycle 3). Ref CP-8F32A1. Powered by Moolre.",
      "ref": "c:kumasi-traders:3:ama"
    }
  ]
}
```

## Responses

**Success (200):**

```json
{ "status": 1, "code": "SMS01", "message": "Success", "data": null, "go": null }
```

**Errors:**

| Code | Meaning | Fix |
|---|---|---|
| `ASMS07` | Sender ID not approved | Log in at `app.moolre.com` and set up / get the Sender ID approved |
| `AIN01` | Authentication error | Check `X-API-VASKEY` (and that you're not sending the transact keys here) |

## Notes

- **Sender ID must be pre-registered and approved** before any SMS will send — do this in the Moolre dashboard.
- **Bulk:** put multiple objects in `messages` to send in one call.
- A GET variant exists (same fields as query params, same codes); prefer POST for anything with message content.
- Keep messages short, include the amount + reference, and end transactional payment texts with trust copy (e.g. "Powered by Moolre"). Don't put secrets/OTPs you generate yourself in plain SMS beyond what's necessary.
- Client method: `client.sendSms({ senderId, messages })` in `assets/moolre-client.ts`.
