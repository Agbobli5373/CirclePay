# Webhooks (Payment Callbacks)

Moolre `POST`s a JSON payload to your registered **callback URL** when a transaction's state changes. This is the primary way to learn that an asynchronous collection/transfer settled.

## Payload

```json
{
  "status": 1,
  "code": "P01",
  "message": "Transaction Successful",
  "data": {
    "txstatus": 1,
    "txtype": 2,
    "accountnumber": "100000100002",
    "payer": "0209151872",
    "amount": "1",
    "transactionid": "31772290",
    "externalref": "1231231-128",
    "ts": "2023-11-21 03:57:25"
  }
}
```

- Match the event to your record using `data.externalref`.
- `data.txstatus: 1` = success.
- `txtype` distinguishes collection vs transfer (confirm exact mapping in live docs).

## Registering the callback URL

Set it on the account via **Account Update** (or at account creation) using the `callback` field. Verify the current value through `/open/account/status` (`type:1`) → `data.callback`.

## Hardening (no built-in signature)

Moolre does not document an HMAC signature on callbacks, so add your own defenses:

1. **Secret in the URL.** Register a callback like `https://yourapp.com/api/webhooks/moolre/<MOOLRE_WEBHOOK_SECRET>` and reject any request whose path token doesn't match. (Or require a secret query param / shared header.)
2. **Re-confirm before crediting.** On receipt, call `/open/transact/status` with `idtype:"1"` and the `externalref`; only mark the contribution/payout settled when *that* returns `SS01` / `txstatus:1`. Never credit purely on the inbound body.
3. **Idempotency.** Webhooks can be retried/duplicated — key your "mark paid" on `externalref` (or `transactionid`) and make it a no-op if already settled.
4. **Respond fast.** Return `200` quickly; do heavy work async so Moolre doesn't retry unnecessarily.
5. **Allowlist** Moolre's source IPs if they publish them.

## Don't rely on webhooks alone

Networks/tunnels drop. Keep a reconciliation job that polls `/open/transact/status` for any contribution/payout still "pending" after N minutes.
