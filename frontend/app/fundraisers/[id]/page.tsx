'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { BadgeCheck, ShieldCheck, Copy, Loader2, AlertCircle, CheckCircle2, Banknote, Clock, ChevronLeft, FileText } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useFundraiser, useMe, useVerifyPayee, useReleasePayout, useCloseFundraiser, useUploadReceipt, useVerifyReceipt } from '@/lib/queries'
import { ApiError } from '@/lib/api'
import { FundraiserInvites } from '@/components/fundraiser-invites'
import { ThankContributors } from '@/components/thank-contributors'
import { ConfirmDialog } from '@/components/confirm-dialog'

const VERIFY: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Payee verified', cls: 'bg-primary/10 text-primary' },
  pending: { label: 'Verification pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  unverified: { label: 'Verification pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  rejected: { label: 'Payee rejected', cls: 'bg-destructive/10 text-destructive' },
}

const TRANCHE_STATUS: Record<string, string> = { held: 'Reserved', released: 'Sent', settled: 'Delivered', refunded: 'Refunded' }

/** Organizer pastes a link to the bill/receipt for a released tranche. */
function AddReceiptForm({ onAdd, busy }: { onAdd: (docUrl: string) => void; busy: boolean }) {
  const [url, setUrl] = useState('')
  return (
    <div className="flex gap-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a link to the bill / receipt"
        className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
      />
      <button
        onClick={() => { onAdd(url); setUrl('') }}
        disabled={busy || !url.trim()}
        className="cp-btn-primary h-9 px-3 text-xs disabled:opacity-50"
      >
        Add receipt
      </button>
    </div>
  )
}

export default function FundraiserDetailPage() {
  const id = useParams<{ id: string }>().id
  const { data: me } = useMe()
  const { data: f, isLoading, isError } = useFundraiser(id)
  const verify = useVerifyPayee(id)
  const release = useReleasePayout(id)
  const close = useCloseFundraiser(id)
  const uploadReceipt = useUploadReceipt(id)
  const verifyReceipt = useVerifyReceipt(id)
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<null | 'release' | 'close'>(null)

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
  const isIndividual = f.payoutRoute === 'individual_cash'
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${f.slug}` : `/f/${f.slug}`
  // Individual (personal MoMo) payouts release without ops verification; hospital routes need it.
  const activeTranches = f.tranches.filter((t) => t.status !== 'refunded')
  const nextAmount = activeTranches.length === 0 && f.firstTrancheCap ? Math.min(f.releasable, f.firstTrancheCap) : f.releasable
  const canRelease = f.isOwner && !completed && f.canReleaseNext
  const showOps = !!me?.isOpsAdmin && !isIndividual && f.verificationStatus !== 'verified' && !completed

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
    setBusy(true)
    try {
      const r = await release.mutateAsync()
      toast.success(`Releasing ${formatGhs(r.amount)} to ${f!.payeeName ?? 'the payee'}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not release payout')
    } finally {
      setBusy(false)
      setConfirmAction(null)
    }
  }
  async function onClose() {
    setBusy(true)
    try {
      await close.mutateAsync()
      toast.success('Fundraiser closed')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not close the fundraiser')
    } finally {
      setBusy(false)
      setConfirmAction(null)
    }
  }
  async function copyShare() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success('Share link copied') } catch { toast.error('Could not copy') }
  }
  async function onUploadReceipt(trancheId: string, docUrl: string) {
    if (!docUrl.trim()) return
    setBusy(true)
    try {
      await uploadReceipt.mutateAsync({ trancheId, kind: 'receipt', docUrl: docUrl.trim() })
      toast.success('Receipt submitted for review')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add the receipt')
    } finally {
      setBusy(false)
    }
  }
  async function onVerifyReceipt(receiptId: string, decision: 'verified' | 'rejected') {
    setBusy(true)
    try {
      await verifyReceipt.mutateAsync({ receiptId, decision })
      toast.success(decision === 'verified' ? 'Receipt verified — next release unlocked' : 'Receipt rejected')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not update the receipt')
    } finally {
      setBusy(false)
    }
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

          {/* Organizer: release + close */}
          {f.isOwner && !completed && (
            <div className="space-y-2">
              {f.released > 0 && (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> {formatGhs(f.released)} already sent to {f.payeeName ?? 'the payee'}.
                </p>
              )}
              <button onClick={() => setConfirmAction('release')} disabled={!canRelease || busy} className="cp-btn-primary w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Banknote className="h-4 w-4" /> Release {formatGhs(nextAmount)} to {isIndividual ? (f.payeeName || 'the payee') : 'hospital'}</>)}
              </button>
              {!canRelease && (
                <p className="text-xs text-secondary flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  {f.releasable <= 0
                    ? (f.released > 0 ? 'All funds raised so far have been released.' : 'No funds raised yet — release opens once a donation comes in.')
                    : f.nextBlockedReason === 'receipt_required'
                      ? 'Add the previous step’s receipt and have ops verify it to release more.'
                      : 'Waiting for ops to verify the payee before you can release funds.'}
                </p>
              )}
              {isIndividual && f.releasable > 0 && (
                <p className="text-xs text-secondary flex items-start gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  Pays out to the MoMo number you entered ({f.payeeName || '—'}). Release any time — no review needed.
                </p>
              )}
              <button onClick={() => setConfirmAction('close')} disabled={busy} className="cp-btn-ghost w-full">Close fundraiser</button>
            </div>
          )}
          {completed && (
            <p className="text-sm text-primary flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Closed · {formatGhs(f.released)} sent to {f.payeeName ?? 'the payee'}{f.released < f.raised ? ` of ${formatGhs(f.raised)} raised` : ''}.
            </p>
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

        {/* Payout steps (tranches) + receipt gate */}
        {(f.tranches.length > 0 || f.requiresReceipts) && (
          <div className="cp-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Payout steps</h2>
              {f.requiresReceipts && <span className="cp-pill">Receipt-gated</span>}
            </div>
            {f.requiresReceipts && (
              <p className="text-xs text-secondary">
                Funds move in steps. After a release, add that step&apos;s receipt — once ops verify it, the next release unlocks.
              </p>
            )}
            {f.tranches.length === 0 ? (
              <p className="text-sm text-secondary">No funds released yet.</p>
            ) : (
              <div className="space-y-3">
                {f.tranches.map((t, i) => {
                  const rcpts = f.receipts.filter((r) => r.trancheId === t.id)
                  const verified = rcpts.some((r) => r.kind === 'receipt' && r.status === 'verified')
                  const pending = rcpts.some((r) => r.status === 'submitted')
                  const needsReceipt = f.requiresReceipts && (t.status === 'released' || t.status === 'settled') && !verified
                  return (
                    <div key={t.id} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Step {i + 1} · {formatGhs(t.amount)}</span>
                        <span className="cp-pill">{TRANCHE_STATUS[t.status] ?? t.status}</span>
                      </div>
                      {rcpts.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2">
                          <a
                            href={r.docUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1 text-xs hover:underline truncate ${r.status === 'verified' ? 'text-primary' : 'text-secondary'}`}
                          >
                            <FileText className="h-3.5 w-3.5 flex-shrink-0" /> {r.kind === 'proforma' ? 'Bill' : 'Receipt'} · {r.status}
                          </a>
                          {me?.isOpsAdmin && r.status === 'submitted' && (
                            <span className="flex gap-2 flex-shrink-0">
                              <button onClick={() => onVerifyReceipt(r.id, 'verified')} disabled={busy} className="text-xs font-semibold text-primary hover:underline">Verify</button>
                              <button onClick={() => onVerifyReceipt(r.id, 'rejected')} disabled={busy} className="text-xs font-semibold text-secondary hover:text-destructive">Reject</button>
                            </span>
                          )}
                        </div>
                      ))}
                      {needsReceipt && !pending && f.isOwner && (
                        <AddReceiptForm busy={busy} onAdd={(url) => onUploadReceipt(t.id, url)} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Organizer: invite family & friends to contribute */}
        {f.isOwner && !completed && <FundraiserInvites fundraiserId={f.id} />}

        {f.story && (
          <div className="cp-card p-5 space-y-2">
            <h2 className="text-base font-semibold text-foreground">The story</h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{f.story}</p>
          </div>
        )}

        <div className="cp-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Contributors</h2>
            {f.isOwner && f.contributors.length > 0 && <ThankContributors fundraiserId={f.id} />}
          </div>
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
          <p className="text-sm text-secondary leading-relaxed">
            {isIndividual
              ? 'Funds go to the MoMo number the organiser entered. CirclePay never holds the money. Powered by Moolre.'
              : 'Funds go straight to the verified payee. CirclePay never holds the money. Powered by Moolre.'}
          </p>
        </div>

        <ConfirmDialog
          open={confirmAction === 'release'}
          title="Release funds?"
          message={<>Send <span className="font-semibold text-foreground">{formatGhs(nextAmount)}</span> to {f.payeeName ?? 'the payee'} now? This pays out the next step.</>}
          confirmLabel="Release"
          busy={busy}
          onConfirm={onRelease}
          onCancel={() => setConfirmAction(null)}
        />
        <ConfirmDialog
          open={confirmAction === 'close'}
          title="Close fundraiser?"
          message="No more donations will be accepted. You can still thank contributors afterwards."
          confirmLabel="Close fundraiser"
          busy={busy}
          onConfirm={onClose}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    </AppShell>
  )
}
