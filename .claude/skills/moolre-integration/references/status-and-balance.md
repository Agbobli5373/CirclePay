# Transaction Status, Balance & History

## Transaction status

```
POST {BASE}/open/transact/status
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | integer | Yes | Always `1` |
| `idtype` | string | Yes | `"1"` = look up by your `externalref`; `"2"` = by Moolre `transactionid` |
| `id` | string | Yes | The reference/id to check |
| `accountnumber` | string | Yes | Your Moolre account number |

```json
{ "type": 1, "idtype": "1", "id": "kumasi-traders-c3-ama-001", "accountnumber": "100000157291" }
```

**Success (200):**

```json
{
  "status": 1,
  "code": "SS01",
  "message": "Transaction Successful",
  "data": {
    "txstatus": 1,
    "txtype": 2,
    "accountnumber": "100000100002",
    "payer": "",
    "payee": "0246798993",
    "amount": "5",
    "value": "5",
    "transactionid": "31830714",
    "externalref": "1231231-12985",
    "thirdpartyref": "141704447750",
    "ts": "2024-01-05 09:42:33"
  },
  "go": null
}
```

Use `data.txstatus` as the source of truth (`1` = successful). Poll this when a webhook is missed, or to reconcile after `TR099`/`OBGH01`. Prefer `idtype:"1"` (your `externalref`) so you don't need to persist Moolre ids.

## Account balance

```
POST {BASE}/open/account/status
```

```json
{ "type": 1, "accountnumber": "100000157291" }
```

**Success:**

```json
{
  "status": 1,
  "code": "SW01",
  "message": "Wallet Found",
  "data": { "balance": 10.67, "accountname": "Zagey", "callback": "https://example.com/callback" }
}
```

`data.callback` shows your currently registered webhook URL — handy to verify configuration.

## Transaction history

Same endpoint with `type: 2`:

```json
{ "type": 2, "accountnumber": "100000157291", "startdate": "2026-06-01", "enddate": "2026-06-30", "limit": 50, "status": 1 }
```

Returns a list of transactions for reconciliation / the Activity feed.
