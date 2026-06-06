'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { CheckCircle2, AlertCircle, Clock, Loader2, UserPlus, UserCircle2, ChevronLeft } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useFund, useMe } from '@/lib/queries'
import { InviteMembers } from '@/components/invite-members'

export default function SusuFundPage() {
  const params = useParams<{ fund: string }>()
  const fundId = params.fund
  const { data: me } = useMe()
  const { data: fund, isLoading, isError } = useFund(fundId)

  if (isLoading) {
    return (
      <AppShell currentPage="funds">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  if (isError || !fund) {
    return (
      <AppShell currentPage="funds">
        <div className="max-w-md mx-auto text-center py-20 space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Fund not available</h1>
          <p className="text-secondary text-sm">It may not exist, or you&apos;re not a member of this Susu.</p>
          <Link href="/funds" className="cp-btn-ghost inline-flex">Back to funds</Link>
        </div>
      </AppShell>
    )
  }

  const nameFor = (userId: string | null) => {
    if (!userId) return '—'
    if (me && userId === me.id) return 'You'
    return fund.members.find((m) => m.userId === userId)?.name || 'Member'
  }

  const myMember = me ? fund.members.find((m) => m.userId === me.id) : undefined
  const isAdmin = myMember?.role === 'admin'
  const joined = fund.members.length
  const pendingInvites = fund.pendingInviteCount
  const openSeats = fund.openSeats // memberCount − members − pendingInvites (free to invite into)
  const seatsPct = fund.memberCount > 0 ? Math.round((joined / fund.memberCount) * 100) : 0

  const iPaid = myMember?.status === 'paid'
  const canPay = fund.started && !!myMember && !iPaid && fund.status === 'active'
  const pct = fund.progressPercent
  const cyclePaidPct = fund.memberCount > 0 ? Math.round((fund.thisCycleFundedCount / fund.memberCount) * 100) : 0

  return (
    <AppShell currentPage="funds">
      <div className="max-w-4xl space-y-6">
        {/* Back nav */}
        <Link
          href="/funds"
          className="inline-flex items-center gap-1 text-sm text-secondary hover:text-foreground transition-colors -ml-0.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Funds
        </Link>

        {(myMember?.fundStatus === 'defaulted' || me?.trust?.standing === 'locked') && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Your account is locked</p>
              <p className="text-secondary mt-0.5">
                A missed contribution locked you across all of CirclePay. Pay what you owe or contact support to appeal.
              </p>
            </div>
          </div>
        )}

        {!fund.started ? (
          /* ───────── AWAITING MEMBERS ───────── */
          <>
            <div className="cp-card p-5 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{fund.name}</h1>
                <div className="flex items-center gap-2">
                  <span className="inline-block text-sm font-medium bg-primary/10 text-primary rounded-full px-3 py-1">{fund.type}</span>
                  <span className="cp-pill">Waiting for members</span>
                </div>
              </div>

              {/* Seats filling */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold text-foreground">
                    {joined} <span className="text-secondary font-medium text-lg">of {fund.memberCount} joined</span>
                  </p>
                  <p className="text-sm font-semibold text-primary">{openSeats} seat{openSeats === 1 ? '' : 's'} left</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${seatsPct}%` }} />
                </div>
              </div>

              {/* Plan stats (no cycle machinery yet) */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Stat label="Per cycle" value={formatGhs(fund.contribution)} accent />
                <Stat label="Pot each cycle" value={formatGhs(fund.potPesewas)} />
                <Stat label="Frequency" value={fund.frequency === 'weekly' ? 'Weekly' : 'Monthly'} />
                <Stat label="Members" value={`${fund.memberCount}`} />
              </div>

              <p className="text-sm text-secondary leading-relaxed bg-primary/5 rounded-xl p-3">
                This Susu starts automatically once all {fund.memberCount} members join — the payout order is set then.
              </p>

              {!isAdmin && (
                <div className="w-full py-3 bg-muted text-secondary rounded-full font-medium text-center text-sm">
                  Waiting for the group to fill
                </div>
              )}
            </div>

            {/* Invite & manage (admin) */}
            {isAdmin && (
              <div className="cp-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Invite & manage</h2>
                </div>
                <InviteMembers fundId={fund.id} fundName={fund.name} remaining={openSeats} />
              </div>
            )}

            {/* Members + open seats */}
            <div className="cp-card p-5 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Members ({joined} of {fund.memberCount})</h2>
              <div className="grid gap-2">
                {fund.members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <p className="text-sm font-medium text-foreground truncate">
                      {me && m.userId === me.id ? 'You' : m.name || 'Member'}
                      {m.role === 'admin' && <span className="ml-2 cp-pill">Admin</span>}
                    </p>
                  </div>
                ))}
                {Array.from({ length: pendingInvites }).map((_, i) => (
                  <div key={`pending-${i}`} className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-foreground">Invited · awaiting response</p>
                  </div>
                ))}
                {Array.from({ length: openSeats }).map((_, i) => (
                  <div key={`seat-${i}`} className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
                    <UserCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
                    <p className="text-sm text-secondary">Open seat</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-secondary border-t border-border/50 pt-3">Payout order is set when the circle fills.</p>
            </div>
          </>
        ) : (
          /* ───────── RUNNING ───────── */
          <>
            <div className="cp-card p-5 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{fund.name}</h1>
                <div className="flex items-center gap-2">
                  <span className="inline-block text-sm font-medium bg-primary/10 text-primary rounded-full px-3 py-1">{fund.type}</span>
                  <span className="text-sm text-secondary">{fund.memberCount} members</span>
                  {fund.status === 'completed' && <span className="cp-pill">Completed</span>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="Cycle progress" value={`${fund.currentCycle}/${fund.totalCycles}`} />
                <Stat label="Per cycle" value={formatGhs(fund.contribution)} accent />
                <Stat label="This cycle's payee" value={nameFor(fund.currentPayeeUserId)} small />
                <Stat label="Your payout" value={fund.myNextPayoutCycle ? `Cycle ${fund.myNextPayoutCycle}` : '—'} small />
              </div>

              <div className="flex items-center justify-center gap-8 flex-wrap">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#E7E3DC" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="54" fill="none" stroke="#1D9E75" strokeWidth="8"
                      strokeDasharray={`${(pct / 100) * 339.29} 339.29`}
                      strokeLinecap="round"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{pct}%</p>
                      <p className="text-xs text-secondary">Complete</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {canPay ? (
                    <Link href={`/pay?fund=${fund.id}`} className="cp-btn-primary w-48">
                      Pay this cycle
                    </Link>
                  ) : iPaid ? (
                    <div className="w-48 h-11 bg-primary/10 text-primary rounded-full font-medium text-center flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-5 w-5" /> Paid {formatGhs(fund.contribution)}
                    </div>
                  ) : (
                    <div className="w-48 h-11 bg-muted text-secondary rounded-full font-medium text-center text-sm flex items-center justify-center">Not your turn to pay</div>
                  )}
                  <p className="text-xs text-secondary text-center">Pot {formatGhs(fund.potPesewas)} each cycle</p>
                </div>
              </div>
            </div>

            {/* This cycle */}
            <div className="cp-card p-5 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">This cycle ({fund.currentCycle} of {fund.totalCycles})</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-secondary">{fund.thisCycleFundedCount} of {fund.memberCount} paid</p>
                  <p className="text-sm text-secondary">{cyclePaidPct}%</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${cyclePaidPct}%` }} />
                </div>
              </div>
              <div className="grid gap-2 mt-4">
                {fund.members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {m.status === 'paid' && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                      {m.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                      {m.status === 'overdue' && <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {me && m.userId === me.id ? 'You' : m.name || 'Member'}
                          {m.role === 'admin' && <span className="ml-2 cp-pill">Admin</span>}
                          {m.fundStatus === 'grace' && (
                            <span className="ml-2 rounded-full bg-yellow-500/15 text-yellow-600 text-xs font-semibold px-2 py-0.5">Grace</span>
                          )}
                          {m.fundStatus === 'defaulted' && (
                            <span className="ml-2 rounded-full bg-destructive/15 text-destructive text-xs font-semibold px-2 py-0.5">Defaulted · locked</span>
                          )}
                        </p>
                        <p className="text-xs text-secondary capitalize">{m.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payout order */}
            <div className="cp-card p-5 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Payout order</h2>
              <div className="space-y-3">
                {fund.payoutOrder.map((userId, i) => {
                  const cycle = i + 1
                  const status = cycle < fund.currentCycle ? 'completed' : cycle === fund.currentCycle ? 'current' : 'upcoming'
                  const isMe = me && userId === me.id
                  return (
                    <div key={userId} className={`flex items-center gap-4 rounded-lg border p-4 ${status === 'current' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                          backgroundColor: status === 'completed' ? '#E7E3DC' : status === 'current' ? '#1D9E75' : '#F5F3ED',
                          color: status === 'completed' ? '#78716C' : status === 'current' ? '#FFFFFF' : '#1C1917',
                        }}
                      >
                        {cycle}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{isMe ? 'You' : nameFor(userId)}</p>
                        <p className="text-xs text-secondary">{formatGhs(fund.potPesewas)}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {status === 'completed' && <span className="text-xs font-medium text-secondary">Completed</span>}
                        {status === 'current' && <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">Current</span>}
                        {status === 'upcoming' && isMe && <span className="text-xs font-medium text-primary">Your turn</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function Stat({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div>
      <p className="text-xs text-secondary font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-2 font-bold ${small ? 'text-sm font-semibold text-foreground' : accent ? 'text-2xl text-primary' : 'text-2xl text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}
