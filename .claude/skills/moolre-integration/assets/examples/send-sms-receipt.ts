/**
 * Send an SMS receipt after a contribution settles, and a payout alert.
 * Call from your webhook handler / settlement job (server-side).
 * Requires MOOLRE_VASKEY and an approved Sender ID (set up at app.moolre.com).
 */
import { MoolreClient } from '@/lib/moolre' // copy moolre-client.ts here
import { formatGhs } from '@/lib/domain/rules' // from circlepay-domain skill (optional)

const SENDER_ID = 'CirclePay' // must be approved in the Moolre dashboard

export async function sendContributionReceipt(opts: {
  phone: string
  amountPesewas: number
  fundName: string
  cycle: number
  reference: string
}) {
  const client = MoolreClient.fromEnv()
  await client.sendSms({
    senderId: SENDER_ID,
    messages: [
      {
        recipient: opts.phone,
        message: `CirclePay: ${formatGhs(opts.amountPesewas)} received for ${opts.fundName} (Cycle ${opts.cycle}). Ref ${opts.reference}. Powered by Moolre.`,
        ref: opts.reference,
      },
    ],
  })
}

/** Notify the cycle recipient that their payout was sent. */
export async function sendPayoutAlert(opts: { phone: string; amountPesewas: number; fundName: string }) {
  const client = MoolreClient.fromEnv()
  await client.sendSms({
    senderId: SENDER_ID,
    messages: [
      {
        recipient: opts.phone,
        message: `CirclePay: Your ${opts.fundName} payout of ${formatGhs(opts.amountPesewas)} is on the way to your MoMo. Powered by Moolre.`,
      },
    ],
  })
}

/** Bulk reminder to members with pending/overdue contributions. */
export async function sendDueReminders(recipients: string[], fundName: string) {
  const client = MoolreClient.fromEnv()
  await client.sendSms({
    senderId: SENDER_ID,
    messages: recipients.map((recipient) => ({
      recipient,
      message: `CirclePay: Your contribution to ${fundName} is due. Dial the USSD code or open the app to pay. Powered by Moolre.`,
    })),
  })
}
