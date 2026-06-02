/**
 * Next.js App Router — Moolre payment webhook.
 * Path: app/api/webhooks/moolre/[secret]/route.ts
 *
 * Register your callback in Moolre as:
 *   https://yourapp.com/api/webhooks/moolre/<MOOLRE_WEBHOOK_SECRET>
 *
 * Moolre sends no signature, so we (1) check the secret path token and
 * (2) re-confirm via the status endpoint before crediting anything.
 */
import { NextResponse } from 'next/server'
import { MoolreClient } from '@/lib/moolre'

export const runtime = 'nodejs'

interface WebhookBody {
  status: number | string
  code: string
  data?: { externalref?: string; transactionid?: string; txstatus?: number }
}

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  if (secret !== process.env.MOOLRE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const body = (await req.json()) as WebhookBody
  const externalref = body.data?.externalref
  if (!externalref) return NextResponse.json({ ok: true }, { status: 200 }) // ack, nothing to do

  // Re-confirm with Moolre — do NOT trust the inbound body alone.
  const client = MoolreClient.fromEnv()
  const settled = await client.isSettled(externalref)

  if (settled) {
    // TODO: idempotently mark the contribution/payout Paid (no-op if already settled),
    // update fund progress, and send the SMS receipt.
  }

  // Respond fast; heavy work should be queued.
  return NextResponse.json({ ok: true }, { status: 200 })
}
