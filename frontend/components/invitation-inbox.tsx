'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Mail, Check, X, Loader2, Users } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useMyInvites, useAcceptInvite, useDeclineInvite } from '@/lib/queries'
import { ApiError, type MyInvite } from '@/lib/api'

/**
 * In-app "Invitations" inbox — surfaces pending Susu invites addressed to the
 * current user (matched by MoMo number, no SMS needed) with Accept / Decline.
 * Renders nothing when there are no pending invites.
 */
export function InvitationInbox() {
  const { data: invites, isLoading } = useMyInvites()
  if (isLoading || !invites || invites.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="text-base font-semibold text-foreground">
          You&apos;ve been invited
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold h-5 min-w-5 px-1.5">
            {invites.length}
          </span>
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {invites.map((inv) => (
          <InviteCard key={inv.id} inv={inv} />
        ))}
      </div>
    </section>
  )
}

function InviteCard({ inv }: { inv: MyInvite }) {
  const accept = useAcceptInvite()
  const decline = useDeclineInvite()
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null)
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
    if (!confirm(`Decline the invite to "${inv.fundName}"?`)) return
    setBusy('decline')
    try {
      await decline.mutateAsync(inv.id)
      toast.success('Invite declined')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not decline')
      setBusy(null)
    }
  }

  return (
    <div className="cp-card p-5 border-l-4 border-l-primary">
      <p className="text-xs text-secondary">
        <span className="font-medium text-foreground">{inv.inviterName}</span> invited you to
      </p>
      <h4 className="font-bold text-foreground text-base mt-0.5">{inv.fundName}</h4>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="cp-pill">{per}</span>
        <span className="cp-pill inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {inv.memberCount} members
        </span>
        <span className="cp-pill">Pot {pot}</span>
      </div>
      <p className="text-xs text-secondary mt-2">
        {inv.seatsLeft > 0 ? `${inv.seatsLeft} seat${inv.seatsLeft === 1 ? '' : 's'} left` : 'Last seat'} · you pay {per},
        and collect the {pot} pot on your turn.
      </p>

      <div className="flex gap-2 mt-4">
        <button onClick={onAccept} disabled={busy !== null} className="cp-btn-primary flex-1">
          {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="h-4 w-4" /> Accept</>)}
        </button>
        <button
          onClick={onDecline}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-border px-4 h-11 text-sm font-semibold text-secondary hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
        >
          {busy === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><X className="h-4 w-4" /> Decline</>)}
        </button>
      </div>
    </div>
  )
}
