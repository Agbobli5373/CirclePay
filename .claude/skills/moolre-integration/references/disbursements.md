# Disbursements — Pay out to a wallet or bank

Use to **send** money to a recipient (CirclePay: Susu **payout** to the cycle recipient, or **medical** payout to a hospital).

## Endpoint

```
POST {BASE}/open/transact/transfer
```

Headers: `X-API-USER`, `X-API-KEY` (private key, live only), `Content-Type: application/json`.

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | integer | Yes | Always `1` |
| `channel` | string | Yes | `1`=MTN, `6`=Telecel, `7`=AirtelTigo, `2`=Instant Bank Transfer |
| `currency` | string | Yes | `"GHS"` |
| `amount` | string | Yes | e.g. `"5000"` |
| `receiver` | string | Yes | Recipient wallet/phone (or bank account for `channel:2`) |
| `sublistid` | string | Yes | Payout source/sub-list id from your Moolre account |
| `externalref` | string | Yes | **Unique** per payout |
| `reference` | string | No | Optional message shown on the transfer |
| `accountnumber` | string | Yes | Your Moolre account number |

```json
{
  "type": 1,
  "channel": "1",
  "currency": "GHS",
  "amount": "5000",
  "receiver": "0246798993",
  "sublistid": "300303",
  "externalref": "kumasi-traders-c3-payout",
  "reference": "Susu payout cycle 3",
  "accountnumber": "100000157291"
}
```

## Success response (200)

```json
{
  "status": "1",
  "code": "OBGH01",
  "message": ["Pay out Successful"],
  "data": {
    "txstatus": 1,
    "receiver": "0246798993",
    "transactionid": "32759150",
    "externalref": "kumasi-traders-c3-payout",
    "receivername": "YUSIF YA-ADZAGEY",
    "amount": "5000",
    "amountfee": "5000.01",
    "fee": "0.01"
  }
}
```

## Notes

- `channel:2` = **bank** transfer; `receiver` is the bank account number and you may need bank-specific fields per the live docs.
- Confirm `data.receivername` matches the intended recipient before relying on a transfer (helps catch wrong numbers).
- Ensure sufficient balance first via `/open/account/status` (`type:1`). See `status-and-balance.md`.
- A transfer can still settle asynchronously; reconcile with `/open/transact/status` using the `externalref`.
- Keep a **disbursement** channel enum separate from the **collection** one (MTN = `1` here vs `13` for collections).
