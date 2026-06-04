'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useFund } from '@/lib/queries'
import { useMe } from '@/lib/queries'

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
  const iPaid = myMember?.status === 'paid'
  const canPay = fund.started && !!myMember && !iPaid && fund.status === 'active'
  const pct = fund.progressPercent
  const cyclePaidPct = fund.memberCount > 0 ? Math.round((fund.thisCycleFundedCount / fund.memberCount) * 100) : 0

  return (
    <AppShell currentPage="funds">
      <div className="max-w-4xl space-y-6">
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

        {/* Hero */}
        <div className="cp-card p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{fund.name}</h1>
            <div className="flex items-center gap-2">
              <span className="inline-block text-sm font-medium bg-primary/10 text-primary rounded-full px-3 py-1">{fund.type}</span>
              <span className="text-sm text-secondary">{fund.memberCount} members</span>
              {!fund.started && <span className="cp-pill">Waiting for members</span>}
              {fund.status === 'completed' && <span className="cp-pill">Completed</span>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Cycle progress</p>
              <p className="text-2xl font-bold text-foreground mt-2">{fund.currentCycle}/{fund.totalCycles}</p>
            </div>
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Per cycle</p>
              <p className="text-2xl font-bold text-primary mt-2">{formatGhs(fund.contribution)}</p>
            </div>
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">This cycle&apos;s payee</p>
              <p className="text-sm font-semibold text-foreground mt-2">{nameFor(fund.currentPayeeUserId)}</p>
            </div>
            <div>
              <p className="text-xs text-secondary font-medium uppercase tracking-wide">Your payout</p>
              <p className="text-sm font-semibold text-foreground mt-2">
                {fund.myNextPayoutCycle ? `Cycle ${fund.myNextPayoutCycle}` : '—'}
              </p>
            </div>
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
                <Link
                  href={`/pay?fund=${fund.id}`}
                  className="block w-48 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-colors text-center"
                >
                  Pay this cycle
                </Link>
              ) : iPaid ? (
                <div className="w-48 py-3 bg-primary/10 text-primary rounded-full font-medium text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Paid {formatGhs(fund.contribution)}
                </div>
              ) : (
                <div className="w-48 py-3 bg-muted text-secondary rounded-full font-medium text-center text-sm">
                  {fund.started ? 'Not your turn to pay' : 'Not started'}
                </div>
              )}
              <p className="text-xs text-secondary text-center">Pot {formatGhs(fund.potPesewas)} each cycle</p>
            </div>
          </div>
        </div>

        {/* This cycle */}
        <div className="cp-card p-6 space-y-4">
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
        <div className="cp-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Payout order</h2>
          <div className="space-y-3">
            {fund.payoutOrder.map((userId, i) => {
              const cycle = i + 1
              const status = cycle < fund.currentCycle ? 'completed' : cycle === fund.currentCycle ? 'current' : 'upcoming'
              const isMe = me && userId === me.id
              return (
                <div
                  key={userId}
                  className={`flex items-center gap-4 rounded-lg border p-4 ${
                    status === 'current' ? 'border-primary bg-primary/5' : 'border-border bg-card'
                  }`}
                >
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
      </div>
    </AppShell>
  )
}
