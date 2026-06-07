'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Check, X, Loader2, Users } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useMyInvites, useAcceptInvite, useDeclineInvite } from '@/lib/queries'
import { ApiError, type MyInvite } from '@/lib/api'
import { ConfirmDialog } from '@/components/confirm-dialog'

/**
 * Bell + dropdown for pending Susu invitations (matched to the user's MoMo number).
 * Badges only when there's something to act on; lists each invite with Accept / Decline.
 */
export function NotificationsBell() {
  const { data: invites } = useMyInvites()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = invites?.length ?? 0

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifications, ${count} pending invite${count === 1 ? '' : 's'}` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative p-2 text-secondary hover:text-foreground hover:bg-muted rounded-full transition-colors"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold leading-none flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {count > 0 && <span className="text-xs text-secondary">{count} invite{count === 1 ? '' : 's'}</span>}
          </div>

          {count === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-secondary mx-auto mb-2" />
              <p className="text-sm text-secondary">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {invites!.map((inv) => (
                <InviteRow key={inv.id} inv={inv} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function InviteRow({ inv }: { inv: MyInvite }) {
  const accept = useAcceptInvite()
  const decline = useDeclineInvite()
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)
  const per = `${formatGhs(inv.contribution)}/${inv.frequency === 'weekly' ? 'wk' : 'mo'}`
  const pot = formatGhs(inv.contribution * inv.memberCount)

  async function onAccept() {
    setBusy('accept')
    try {
      await accept.mutateAsync(inv.token)
      toast.success(`You joined "${inv.fundName}"`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not join the circle')
      setBusy(null)
    }
  }
  async function onDecline() {
    setBusy('decline')
    try {
      await decline.mutateAsync(inv.id)
      toast.success('Invite declined')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not decline')
      setBusy(null)
    } finally {
      setConfirmDecline(false)
    }
  }

  return (
    <li className="p-4">
      <p className="text-xs text-secondary">
        <span className="font-medium text-foreground">{inv.inviterName}</span> invited you to
      </p>
      <p className="font-semibold text-foreground text-sm mt-0.5">{inv.fundName}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-secondary">
        <span>{per}</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {inv.memberCount}</span>
        <span>Pot {pot}</span>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onAccept}
          disabled={busy !== null}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground h-9 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="h-4 w-4" /> Accept</>)}
        </button>
        <button
          onClick={() => setConfirmDecline(true)}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 h-9 text-sm font-medium text-secondary hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-60"
        >
          {busy === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><X className="h-4 w-4" /> Decline</>)}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDecline}
        title="Decline invitation?"
        message={<>Decline the invite to &ldquo;{inv.fundName}&rdquo;? You can be invited again later.</>}
        confirmLabel="Decline"
        danger
        busy={busy === 'decline'}
        onConfirm={onDecline}
        onCancel={() => setConfirmDecline(false)}
      />
    </li>
  )
}
