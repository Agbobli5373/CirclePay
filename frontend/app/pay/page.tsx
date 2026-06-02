'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ShieldCheck, CheckCircle2, X } from 'lucide-react'

const payment = {
  fund: 'Kumasi Traders',
  recipient: 'Kofi Boateng',
  cycle: 'Cycle 3 of 10',
  amount: 500,
  fee: 5,
  network: 'MTN MoMo',
  maskedNumber: '024 ••• ••67',
}

export default function PayPage() {
  const [done, setDone] = useState(false)
  const [processing, setProcessing] = useState(false)
  const total = payment.amount + payment.fee
  const reference = 'CP-8F32A1'

  const handleConfirm = () => {
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      setDone(true)
    }, 1400)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Logo />
          <Link href="/" className="p-2 text-secondary hover:text-foreground rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          {!done ? (
            /* CONFIRM */
            <div className="cp-card overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-3">
                  <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">GHS</span>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-foreground">GHS {payment.amount.toFixed(2)}</p>
                    <p className="text-sm text-secondary mt-1">Susu contribution · {payment.cycle}</p>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div className="space-y-3 text-sm">
                  <Row label="Fund" value={payment.fund} />
                  <Row label="This cycle's recipient" value={payment.recipient} />
                  <Row label="Platform fee" value={`GHS ${payment.fee.toFixed(2)}`} />
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="font-medium text-foreground">Total</span>
                    <span className="font-bold text-foreground">GHS {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Pay from */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-600">
                      MTN
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{payment.network}</p>
                      <p className="text-xs text-secondary">{payment.maskedNumber}</p>
                    </div>
                  </div>
                  <button className="text-sm font-medium text-primary hover:underline">Change</button>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                  <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-secondary leading-relaxed">
                    Secured by Moolre. Collected and paid out the same cycle — CirclePay never holds your savings.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/"
                    className="flex-1 h-12 rounded-full border border-border text-foreground font-medium hover:bg-muted transition-colors flex items-center justify-center"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleConfirm}
                    disabled={processing}
                    className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-70 transition-colors"
                  >
                    {processing ? 'Processing…' : `Confirm GHS ${total}`}
                  </button>
                </div>

                <p className="text-xs text-secondary text-center">
                  You&apos;ll approve with your PIN, then get an SMS receipt.
                </p>
              </div>
            </div>
          ) : (
            /* SUCCESS */
            <div className="cp-card p-6 sm:p-8 space-y-6">
              <div className="text-center space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Payment sent</h1>
                  <p className="text-sm text-secondary mt-1">
                    GHS {total.toFixed(2)} paid to {payment.fund}
                  </p>
                </div>
              </div>

              {/* SMS-style receipt */}
              <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2 font-mono text-xs text-foreground">
                <p className="text-secondary">CirclePay · MoMo receipt</p>
                <p>Paid GHS {payment.amount.toFixed(2)} to {payment.fund}.</p>
                <p>Fee GHS {payment.fee.toFixed(2)}. Total GHS {total.toFixed(2)}.</p>
                <p>Recipient this cycle: {payment.recipient}.</p>
                <p>Ref: {reference}</p>
                <p className="text-secondary">Powered by Moolre.</p>
              </div>

              <Link
                href="/"
                className="block w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-center leading-[3rem]"
              >
                Done
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
