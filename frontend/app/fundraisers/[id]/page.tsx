'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { BadgeCheck, ShieldCheck, Copy, Loader2, AlertCircle, CheckCircle2, Banknote, Clock, ChevronLeft } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useFundraiser, useMe, useVerifyPayee, useReleasePayout } from '@/lib/queries'
import { ApiError } from '@/lib/api'

const VERIFY: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Payee verified', cls: 'bg-primary/10 text-primary' },
  pending: { label: 'Verification pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  unverified: { label: 'Verification pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  rejected: { label: 'Payee rejected', cls: 'bg-destructive/10 text-destructive' },
}

export default function FundraiserDetailPage() {
  const id = useParams<{ id: string }>().id
  const { data: me } = useMe()
  const { data: f, isLoading, isError } = useFundraiser(id)
  const verify = useVerifyPayee(id)
  const release = useReleasePayout(id)
  const [busy, setBusy] = useState(false)

  if (isLoading) {
    return <AppShell currentPage="funds"><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AppShell>
  }
  if (isError || !f) {
    return (
      <AppShell currentPage="funds">
        <div className="text-center py-24 space-y-2">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-foreground font-medium">Fundraiser not found</p>
          <Link href="/funds" className="text-sm text-primary hover:underline">Back to funds</Link>
        </div>
      </AppShell>
    )
  }

  const badge = VERIFY[f.verificationStatus] ?? VERIFY.pending
  const completed = f.status === 'completed'
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${f.slug}` : `/f/${f.slug}`
  const canRelease = f.isOwner && f.verificationStatus === 'verified' && !completed && f.raised > 0
  const showOps = !!me?.isOpsAdmin && f.verificationStatus !== 'verified' && !completed

  async function onVerify(decision: 'verified' | 'rejected') {
    setBusy(true)
    try {
      await verify.mutateAsync(decision)
      toast.success(decision === 'verified' ? 'Payee verified' : 'Payee rejected')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not update verification')
    } finally {
      setBusy(false)
    }
  }
  async function onRelease() {
    if (!confirm(`Release ${formatGhs(f!.raised)} to ${f!.payeeName ?? 'the verified payee'}?`)) return
    setBusy(true)
    try {
      const r = await release.mutateAsync()
      toast.success(`Releasing ${formatGhs(r.amount)} to the hospital`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not release payout')
    } finally {
      setBusy(false)
    }
  }
  async function copyShare() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success('Share link copied') } catch { toast.error('Could not copy') }
  }

  return (
    <AppShell currentPage="funds">
      <div className="max-w-3xl space-y-6">
        {/* Back nav */}
        <Link
          href="/funds"
          className="inline-flex items-center gap-1 text-sm text-secondary hover:text-foreground transition-colors -ml-0.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Funds
        </Link>

        <div className="cp-card p-5 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-medium bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Medical</span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${badge.cls}`}>
                <BadgeCheck className="h-3.5 w-3.5" /> {badge.label}
              </span>
              {completed && <span className="cp-pill">Completed</span>}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{f.name}</h1>
            <p className="text-sm text-secondary mt-1">For {f.beneficiary}{f.hospital ? ` · ${f.hospital}` : ''}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <p className="text-xl font-bold text-foreground">{formatGhs(f.raised)}<span className="text-sm font-normal text-secondary"> of {formatGhs(f.goal)}</span></p>
              <span className="text-sm font-semibold text-primary">{f.progressPercent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5"><div className="bg-primary h-2.5 rounded-full" style={{ width: `${f.progressPercent}%` }} /></div>
            <p className="text-xs text-secondary">{f.contributors.length} contributor{f.contributors.length === 1 ? '' : 's'} · payee: {f.payeeName ?? '—'}</p>
          </div>

          {/* Share */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
            <span className="text-xs text-secondary truncate">{shareUrl}</span>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/f/${f.slug}`} className="text-xs font-medium text-primary hover:underline">Open</Link>
              <button onClick={copyShare} className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /> Copy</button>
            </div>
          </div>

          {/* Organizer: release */}
          {f.isOwner && !completed && (
            <button onClick={onRelease} disabled={!canRelease || busy} className="cp-btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Banknote className="h-4 w-4" /> Release {formatGhs(f.raised)} to hospital</>)}
            </button>
          )}
          {f.isOwner && !completed && !canRelease && (
            <p className="text-xs text-secondary flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {f.verificationStatus !== 'verified' ? 'Waiting for ops to verify the payee before you can release funds.' : 'No funds raised yet.'}
            </p>
          )}
          {completed && (
            <p className="text-sm text-primary flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Funds released to {f.payeeName ?? 'the payee'}.</p>
          )}

          {/* Ops: verify */}
          {showOps && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">Ops review</p>
              <p className="text-xs text-secondary">Confirm the payee ({f.payeeName ?? '—'}, {f.payoutRoute === 'hospital_bank' ? 'bank' : 'MoMo'}) before any payout.</p>
              <div className="flex gap-2">
                <button onClick={() => onVerify('verified')} disabled={busy} className="cp-btn-primary flex-1 h-10">Verify payee</button>
                <button onClick={() => onVerify('rejected')} disabled={busy} className="inline-flex items-center justify-center rounded-full border border-border px-4 h-10 text-sm font-semibold text-secondary hover:text-destructive hover:border-destructive/40 transition-colors">Reject</button>
              </div>
            </div>
          )}
        </div>

        {f.story && (
          <div className="cp-card p-5 space-y-2">
            <h2 className="text-base font-semibold text-foreground">The story</h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{f.story}</p>
          </div>
        )}

        <div className="cp-card p-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Contributors</h2>
          {f.contributors.length === 0 ? (
            <p className="text-sm text-secondary">No donations yet — share the link to get going.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {f.contributors.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <span className="text-sm text-foreground">{c.displayName}</span>
                  <span className="text-sm font-semibold text-primary">{formatGhs(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-4">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-secondary leading-relaxed">Funds go straight to the verified payee. CirclePay never holds the money. Powered by Moolre.</p>
        </div>
      </div>
    </AppShell>
  )
}
