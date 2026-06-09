'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Logo } from '@/components/logo'
import { BadgeCheck, ShieldCheck, MessageCircle, Copy, Loader2, AlertCircle, CheckCircle2, Heart } from 'lucide-react'
import { formatGhs, toPesewas, toLocal9 } from '@circlepay/shared'
import { usePublicFundraiser } from '@/lib/queries'
import { OtpInput } from '@/components/otp-input'
import { api, ApiError, type Network, type DonateState } from '@/lib/api'

const NETWORKS: Network[] = ['MTN', 'Telecel', 'AirtelTigo']

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

const VERIFY_BADGE: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified payee', cls: 'bg-primary/10 text-primary' },
  pending: { label: 'Verification pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  unverified: { label: 'Verification pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  rejected: { label: 'Not verified', cls: 'bg-destructive/10 text-destructive' },
}

export default function PublicFundraiserPage() {
  const slug = useParams<{ slug: string }>().slug
  const { data: f, isLoading, isError, refetch } = usePublicFundraiser(slug)
  const [donateOpen, setDonateOpen] = useState(false)

  if (isLoading) {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /></Centered>
  }
  if (isError || !f) {
    return (
      <Centered>
        <div className="text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-foreground font-medium">Fundraiser not found</p>
          <Link href="/" className="text-sm text-primary hover:underline">Go home</Link>
        </div>
      </Centered>
    )
  }

  const isIndividual = f.payoutRoute === 'individual_cash'
  const closed = f.status === 'completed'
  const badge = VERIFY_BADGE[f.verificationStatus] ?? VERIFY_BADGE.pending
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareMsg = `Help ${f.beneficiary}: ${f.name}. Give via CirclePay: ${shareUrl}`

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Logo />
          <Link href="/onboarding" className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Start a fund
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block text-xs font-medium bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Medical</span>
            {isIndividual ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 bg-muted text-secondary">
                Family fundraiser
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${badge.cls}`}>
                <BadgeCheck className="h-3.5 w-3.5" /> {badge.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{f.name}</h1>
          {f.hospital && <p className="text-secondary">{f.hospital}</p>}

          <div className="cp-card p-5 space-y-4 text-left">
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-foreground">
                {formatGhs(f.raised)}
                <span className="text-base font-normal text-secondary"> raised of {formatGhs(f.goal)}</span>
              </p>
              <span className="text-lg font-semibold text-primary">{f.progressPercent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${f.progressPercent}%` }} />
            </div>
            <p className="text-sm text-secondary">{f.contributors.length} contributor{f.contributors.length === 1 ? '' : 's'}</p>
            {f.released > 0 && (
              <p className="text-xs text-primary flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" /> {formatGhs(f.released)} released to the payee so far, in tracked steps.
              </p>
            )}

            {closed ? (
              <div className="rounded-xl bg-primary/5 p-4 text-center">
                <p className="text-sm font-medium text-foreground">This fundraiser has closed.</p>
                <p className="text-xs text-secondary mt-1">{formatGhs(f.raised)} was raised for {f.beneficiary}. Medaase to everyone who gave!</p>
              </div>
            ) : !donateOpen ? (
              <button onClick={() => setDonateOpen(true)} className="cp-btn-primary w-full">
                <Heart className="h-4 w-4" /> Donate
              </button>
            ) : (
              <DonatePanel slug={slug} onClose={() => setDonateOpen(false)} onSettled={() => refetch()} />
            )}

            <div className="grid grid-cols-3 gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 hover:border-primary/40 transition-colors">
                <MessageCircle className="h-5 w-5 text-primary" /><span className="text-xs font-medium text-foreground">WhatsApp</span>
              </a>
              <a href={`sms:?body=${encodeURIComponent(shareMsg)}`} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 hover:border-primary/40 transition-colors">
                <MessageCircle className="h-5 w-5 text-primary" /><span className="text-xs font-medium text-foreground">SMS</span>
              </a>
              <CopyButton url={shareUrl} />
            </div>
          </div>
        </div>

        {f.story && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">The story</h2>
            <p className="text-foreground leading-relaxed whitespace-pre-line">{f.story}</p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Contributors</h2>
          {f.contributors.length === 0 ? (
            <p className="text-sm text-secondary">Be the first to give.</p>
          ) : (
            <div className="cp-card divide-y divide-border/60">
              {f.contributors.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                      {c.displayName === 'Anonymous' ? '?' : c.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.displayName}</p>
                      <p className="text-xs text-secondary">{timeAgo(c.ts)}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-primary flex-shrink-0">{formatGhs(c.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-4">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-secondary leading-relaxed">
            {isIndividual
              ? 'This is a personal appeal — funds go to the organiser’s Mobile Money. CirclePay never holds the money. Powered by Moolre.'
              : 'Funds go straight to the verified payee. CirclePay never holds the money. Powered by Moolre.'}
          </p>
        </div>
      </main>
    </div>
  )
}

type Step = 'form' | 'otp' | 'processing' | 'success' | 'error'

function DonatePanel({ slug, onClose, onSettled }: { slug: string; onClose: () => void; onSettled: () => void }) {
  const [step, setStep] = useState<Step>('form')
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [network, setNetwork] = useState<Network>('MTN')
  const [name, setName] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const donationId = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `d-${Date.now()}`)

  const amountNum = Number(amount)
  const canSubmit = amountNum > 0 && phone.replace(/\D/g, '').length >= 9

  async function submit(otpcode?: string) {
    try {
      const res = await api.public.donate(slug, {
        donationId: donationId.current,
        phone: `+233${phone.replace(/\D/g, '').slice(0, 9)}`,
        network,
        amount: toPesewas(amountNum),
        displayName: anonymous ? undefined : name.trim() || undefined,
        anonymous,
        otpcode,
      })
      if (res.state === 'otp_required') setStep('otp')
      else if (res.state === 'settled') { setStep('success'); onSettled() }
      else setStep('processing')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Donation failed')
      setStep('error')
    }
  }

  // Poll the donation status while processing.
  useEffect(() => {
    if (step !== 'processing') return
    const t = setInterval(async () => {
      try {
        const s = await api.public.donationStatus(slug, donationId.current)
        if (s.status === 'settled') { setStep('success'); onSettled() }
        else if (s.status === 'failed') { setErr('The payment failed.'); setStep('error') }
      } catch { /* keep polling */ }
    }, 2000)
    return () => clearInterval(t)
  }, [step, slug, onSettled])

  if (step === 'success') {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center space-y-2">
        <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
        <p className="font-semibold text-foreground">Thank you{!anonymous && name ? `, ${name.split(' ')[0]}` : ''}!</p>
        <p className="text-sm text-secondary">Your {formatGhs(toPesewas(amountNum))} donation is in. Powered by Moolre.</p>
        <button onClick={onClose} className="text-sm text-primary font-medium hover:underline">Done</button>
      </div>
    )
  }
  if (step === 'processing') {
    return (
      <div className="rounded-xl border border-border p-4 text-center space-y-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-foreground">Confirming your donation…</p>
      </div>
    )
  }
  if (step === 'error') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center space-y-2">
        <AlertCircle className="h-7 w-7 text-destructive mx-auto" />
        <p className="text-sm text-foreground">{err}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => setStep('form')} className="text-sm text-primary font-medium hover:underline">Try again</button>
          <button onClick={onClose} className="text-sm text-secondary hover:underline">Cancel</button>
        </div>
      </div>
    )
  }
  if (step === 'otp') {
    return (
      <div className="rounded-xl border border-border p-4 space-y-3 text-left">
        <p className="text-sm font-medium text-foreground">Approve on your phone</p>
        <p className="text-xs text-secondary">Enter the code sent to +233 {phone}.</p>
        <OtpInput value={otp} onChange={setOtp} autoFocus ariaLabel="SMS code" />
        <button onClick={() => submit(otp)} disabled={otp.length < 4} className="cp-btn-primary w-full">Authorise donation</button>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border p-4 space-y-3 text-left">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Amount (GHS)</label>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="100" className="cp-input" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Your MoMo number</label>
        <div className="flex items-center h-11 rounded-lg border border-border bg-card px-3 focus-within:border-primary">
          <span className="text-sm font-medium text-foreground border-r border-border pr-2 mr-2 whitespace-nowrap">🇬🇭 +233</span>
          <input inputMode="numeric" value={phone} onChange={(e) => setPhone(toLocal9(e.target.value))} placeholder="XX XXX XXXX" className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary focus:outline-none" />
        </div>
        <div className="flex gap-2 pt-1">
          {NETWORKS.map((n) => (
            <button key={n} type="button" onClick={() => setNetwork(n)} className={`flex-1 rounded-full py-2 text-xs font-medium transition-colors ${network === n ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground hover:border-primary/40'}`}>{n}</button>
          ))}
        </div>
      </div>
      {!anonymous && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown to others)" maxLength={80} className="cp-input" />
      )}
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Give anonymously
      </label>
      <div className="flex gap-2">
        <button onClick={onClose} className="cp-btn-ghost flex-1">Cancel</button>
        <button onClick={() => submit()} disabled={!canSubmit} className="cp-btn-primary flex-1">
          {amountNum > 0 ? `Give ${formatGhs(toPesewas(amountNum))}` : 'Give'}
        </button>
      </div>
    </div>
  )
}

function CopyButton({ url }: { url: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500) } catch {} }}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 hover:border-primary/40 transition-colors"
    >
      {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5 text-primary" />}
      <span className="text-xs font-medium text-foreground">{done ? 'Copied' : 'Copy link'}</span>
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background flex items-center justify-center px-4">{children}</div>
}
