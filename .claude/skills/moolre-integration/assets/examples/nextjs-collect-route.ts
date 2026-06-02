/**
 * Next.js App Router — collect a contribution.
 * Path: app/api/contributions/route.ts
 *
 * Frontend posts { channel, payer, amount, externalref, otpcode? } to this route.
 * Server holds the Moolre keys and calls Moolre. Never call Moolre from the browser.
 */
import { NextResponse } from 'next/server'
import { MoolreClient, type CollectionChannel } from '@/lib/moolre' // copy moolre-client.ts to lib/moolre.ts

export const runtime = 'nodejs' // ensure server runtime (keys + fetch)

export async function POST(req: Request) {
  const body = (await req.json()) as {
    channel: CollectionChannel
    payer: string
    amount: string
    externalref: string
    otpcode?: string
  }

  const client = MoolreClient.fromEnv()

  try {
    const result = await client.collect({
      channel: body.channel,
      payer: body.payer,
      amount: body.amount,
      externalref: body.externalref,
      otpcode: body.otpcode,
    })

    if (result.otpRequired) {
      // Tell the UI to prompt for the SMS code, then re-POST with `otpcode` + same externalref.
      return NextResponse.json({ state: 'otp_required' }, { status: 200 })
    }

    // Initiated (TR099). The payer approves on their phone; settlement arrives via webhook/status.
    // TODO: persist the contribution as "initiated" keyed by externalref.
    return NextResponse.json({ state: 'initiated' }, { status: 202 })
  } catch (err: any) {
    return NextResponse.json(
      { state: 'failed', code: err?.code ?? 'ERR', message: err?.message ?? 'Collection failed' },
      { status: 400 },
    )
  }
}
