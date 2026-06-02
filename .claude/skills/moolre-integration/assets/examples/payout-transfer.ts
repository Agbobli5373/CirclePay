/**
 * Disburse a Susu payout (or a medical payout to a hospital).
 * Call this from a server action / job — never the browser.
 */
import { MoolreClient, TransferChannel } from '@/lib/moolre'

export async function payoutSusuCycle(opts: {
  recipientPhone: string
  amount: string // e.g. "5000"
  fundId: string
  cycle: number
  sublistid: string // from your Moolre account
}) {
  const client = MoolreClient.fromEnv()

  // Optional safety: ensure we hold enough before paying out.
  const balance = await client.getBalance()
  if (Number(balance.data?.balance ?? 0) < Number(opts.amount)) {
    throw new Error('Insufficient Moolre balance for payout')
  }

  const externalref = `p:${opts.fundId}:${opts.cycle}` // stable + unique per cycle

  const res = await client.transfer({
    channel: TransferChannel.MTN, // pick by recipient network; TransferChannel.Bank for bank accounts
    receiver: opts.recipientPhone,
    amount: opts.amount,
    externalref,
    sublistid: opts.sublistid,
    reference: `Susu payout cycle ${opts.cycle}`,
  })

  // res.code === 'OBGH01' on success; reconcile later via client.isSettled(externalref).
  return { transactionid: res.data.transactionid, receivername: res.data.receivername, externalref }
}
