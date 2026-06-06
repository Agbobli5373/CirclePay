'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '@/components/logo'
import { OtpInput } from '@/components/otp-input'
import { ShieldCheck, CheckCircle2, X, Loader2, AlertCircle } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { api, ApiError, type ContributionResult } from '@/lib/api'
import { useFund, useMe } from '@/lib/queries'

type Step = 'confirm' | 'otp' | 'processing' | 'success' | 'error'

function newKey() {
  return (globalThis.crypto?.randomUUID?.() ?? `cp-${Date.now()}-${Math.random()}`)
}

function PayInner() {
  const params = useSearchParams()
  const fundId = params.get('fund') ?? ''
  const { data: me } = useMe()
  const { data: fund, isLoading } = useFund(fundId)

  const [step, setStep] = useState<Step>('confirm')
  const [idemKey, setIdemKey] = useState(newKey)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ContributionResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const externalref = result?.externalref ?? null

  // Poll settlement once initiated.
  const { data: poll } = useQuery({
    queryKey: ['contrib', externalref],
    queryFn: () => api.contributions.status(externalref as string),
    enabled: !!externalref && step === 'processing',
    refetchInterval: (q) =>
      q.state.data?.status === 'settled' || q.state.data?.status === 'failed' ? false : 2000,
  })

  useEffect(() => {
    if (!poll) return
    if (poll.status === 'settled') setStep('success')
    else if (poll.status === 'failed') {
      setErrorMsg('The payment failed. Please try again.')
      setStep('error')
    }
  }, [poll])

  async function submit(otpcode?: string) {
    setBusy(true)
    try {
      const res = await api.contributions.initiate(fundId, idemKey, otpcode)
      setResult(res)
      if (res.state === 'otp_required') setStep('otp')
      else if (res.state === 'settled') setStep('success')
      else if (res.state === 'failed') {
        setErrorMsg('The payment failed. Please try again.')
        setStep('error')
      } else setStep('processing') // initiated → poll
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
      setStep('error')
    } finally {
      setBusy(false)
    }
  }

  function retry() {
    setIdemKey(newKey())
    setOtp('')
    setResult(null)
    setErrorMsg('')
    setStep('confirm')
  }

  if (!fundId) {
    return <Centered><p className="text-secondary">No fund selected.</p><Link href="/funds" className="cp-btn-ghost mt-3">Back to funds</Link></Centered>
  }
  if (isLoading) return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /></Centered>
  if (!fund) {
    return <Centered><p className="text-secondary">Fund not found.</p><Link href="/funds" className="cp-btn-ghost mt-3">Back to funds</Link></Centered>
  }

  const payeeName = fund.currentPayeeUserId === me?.id ? 'You' : fund.members.find((m) => m.userId === fund.currentPayeeUserId)?.name || 'Member'
  const amount = result?.amount ?? fund.contribution
  const fee = result?.fee ?? 0
  const total = result?.total ?? amount + fee
  const maskedNumber = me ? `0${me.phone.slice(4, 6)} ••• ••${me.phone.slice(-2)}` : ''

  return (
    <div className="w-full max-w-md">
      {step === 'success' ? (
        <div className="cp-card p-5 sm:p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Payment sent</h1>
              <p className="text-sm text-secondary mt-1">{formatGhs(total)} paid to {fund.name}</p>
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2 font-mono text-xs text-foreground">
            <p className="text-secondary">CirclePay · MoMo receipt</p>
            <p>Paid {formatGhs(amount)} to {fund.name}.</p>
            <p>Fee {formatGhs(fee)}. Total {formatGhs(total)}.</p>
            <p>Cycle {result?.cycle ?? fund.currentCycle} recipient: {payeeName}.</p>
            <p className="break-all">Ref: {externalref}</p>
            <p className="text-secondary">Powered by Moolre.</p>
          </div>
          <Link href={`/funds/${fundId}`} className="cp-btn-primary w-full">Done</Link>
        </div>
      ) : step === 'error' ? (
        <div className="cp-card p-5 sm:p-6 space-y-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Payment failed</h1>
            <p className="text-sm text-secondary mt-1">{errorMsg}</p>
          </div>
          <div className="flex gap-3">
            <Link href={`/funds/${fundId}`} className="cp-btn-ghost flex-1">Back</Link>
            <button onClick={retry} className="cp-btn-primary flex-1">Try again</button>
          </div>
        </div>
      ) : step === 'processing' ? (
        <div className="cp-card p-6 space-y-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Confirming your payment…</h1>
            <p className="text-sm text-secondary mt-1">Waiting for Moolre to settle. This usually takes a few seconds.</p>
          </div>
        </div>
      ) : step === 'otp' ? (
        <div className="cp-card p-5 sm:p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Approve on your phone</h1>
            <p className="text-sm text-secondary">Enter the MoMo OTP / voucher code to authorise {formatGhs(total)}.</p>
          </div>
          <OtpInput value={otp} onChange={setOtp} autoFocus ariaLabel="MoMo OTP / voucher code" />
          <button
            onClick={() => submit(otp)}
            disabled={otp.length < 4 || busy}
            className="cp-btn-primary w-full"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Authorise payment'}
          </button>
        </div>
      ) : (
        /* CONFIRM */
        <div className="cp-card overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">GHS</span>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{formatGhs(amount, { withSymbol: false })}</p>
                <p className="text-sm text-secondary mt-1">Susu contribution · Cycle {fund.currentCycle} of {fund.totalCycles}</p>
              </div>
            </div>

            <div className="border-t border-border" />

            <div className="space-y-3 text-sm">
              <Row label="Fund" value={fund.name} />
              <Row label="This cycle's recipient" value={payeeName} />
              <Row label="Platform fee" value={formatGhs(fee)} />
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="font-medium text-foreground">Total</span>
                <span className="font-bold text-foreground">{formatGhs(total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-600">
                  {me?.network?.slice(0, 3).toUpperCase() ?? 'MTN'}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{me?.network ?? 'MoMo'}</p>
                  <p className="text-xs text-secondary">{maskedNumber}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
              <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-secondary leading-relaxed">
                Secured by Moolre. Collected and paid out the same cycle — CirclePay never holds your savings.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href={`/funds/${fundId}`} className="cp-btn-ghost flex-1">
                Cancel
              </Link>
              <button onClick={() => submit()} disabled={busy} className="cp-btn-primary flex-1 disabled:opacity-70">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${formatGhs(total)}`}
              </button>
            </div>

            <p className="text-xs text-secondary text-center">You&apos;ll approve with your MoMo PIN, then get an SMS receipt.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PayPage() {
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
        <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-primary" />}>
          <PayInner />
        </Suspense>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md flex flex-col items-center text-center">{children}</div>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
