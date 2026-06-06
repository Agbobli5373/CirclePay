'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Plus, Sparkles, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useMe, useFunds, useActivity, useMyFundraisers } from '@/lib/queries'
import { MedicalFundCard } from '@/components/medical-fund-card'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

export default function Home() {
  const { data: me } = useMe()
  const { data: funds, isLoading: fundsLoading } = useFunds('mine')
  const { data: medical } = useMyFundraisers()
  const { data: activity } = useActivity()
  const firstName = me?.name?.trim()?.split(/\s+/)[0] || me?.phone || 'there'
  const list = funds ?? []
  const activeCount = list.length
  const totalPerCycle = list.reduce((s, f) => s + f.contribution, 0)
  const totalMembers = list.reduce((s, f) => s + f.memberCount, 0)
  const upcoming = list.filter((f) => f.myNextPayoutCycle != null)
  const nextTurn = [...upcoming].sort(
    (a, b) => (a.myNextPayoutCycle! - a.currentCycle) - (b.myNextPayoutCycle! - b.currentCycle),
  )[0]
  const recent = (activity ?? []).slice(0, 4)

  return (
    <AppShell currentPage="home">
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Akwaaba, {firstName}</h2>
          <p className="text-sm text-secondary mt-1.5">Here&apos;s how your funds are doing</p>
        </div>

        {/* Row 1: Per-cycle commitment + next payout */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Commitment Card */}
          <div className="lg:col-span-2 cp-gradient rounded-3xl p-6 lg:p-8 text-white">
            <p className="text-sm font-medium text-white/80">You contribute each cycle</p>
            <p className="text-4xl lg:text-5xl font-bold mt-2 tracking-tight">{formatGhs(totalPerCycle)}</p>
            <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold bg-white/20 rounded-full px-3 py-1">
              <ArrowUpRight className="h-4 w-4" />
              {activeCount} active circle{activeCount === 1 ? '' : 's'}
            </span>

            <div className="grid grid-cols-3 gap-4 mt-7 pt-6 border-t border-white/20">
              <div>
                <p className="text-2xl font-bold tracking-tight">{activeCount}</p>
                <p className="text-xs text-white/70 mt-1">Active funds</p>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{totalMembers}</p>
                <p className="text-xs text-white/70 mt-1">Group members</p>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{upcoming.length}</p>
                <p className="text-xs text-white/70 mt-1">Upcoming payouts</p>
              </div>
            </div>
          </div>

          {/* Next payout card */}
          <div className="cp-card p-6 flex flex-col">
            <p className="text-sm font-medium text-foreground">Your next payout</p>
            {nextTurn ? (
              <div className="flex-1 flex flex-col justify-center mt-3">
                <p className="text-3xl font-bold text-primary tracking-tight">{formatGhs(nextTurn.potPesewas)}</p>
                <p className="text-sm text-foreground mt-2 font-medium truncate">{nextTurn.name}</p>
                <p className="text-xs text-secondary mt-1">
                  Cycle {nextTurn.myNextPayoutCycle} of {nextTurn.totalCycles}
                </p>
                <Link href={`/funds/${nextTurn.id}`} className="text-xs text-primary font-medium hover:underline mt-3">
                  View fund →
                </Link>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center mt-3">
                <p className="text-sm text-secondary leading-relaxed">
                  No payouts queued yet. Join or create a Susu to start a rotation.
                </p>
                <Link href="/create" className="text-xs text-primary font-medium hover:underline mt-3">
                  Create a Susu →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/create" className="cp-btn-primary">
            <Plus className="h-4 w-4" />
            Create a fund
          </Link>
          <Link href="/advisor" className="cp-btn-ghost">
            <Sparkles className="h-4 w-4 text-primary" />
            Ask the Advisor
          </Link>
        </div>

        {/* Row 2: Funds (left) + Activity rail (right) */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* My funds */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">My funds</h3>
              <Link href="/funds" className="text-xs text-primary font-medium hover:underline">View all</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {fundsLoading && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              {!fundsLoading &&
                (funds ?? []).map((f) => (
                  <FundCard
                    key={f.id}
                    href={`/funds/${f.id}`}
                    name={f.name}
                    type={f.type}
                    typeClass="bg-primary/15 text-primary"
                    meta={`${f.memberCount} members`}
                    amount={`${formatGhs(f.contribution)}/${f.frequency === 'weekly' ? 'wk' : 'mo'}`}
                    progressLabel={`Cycle ${f.currentCycle} of ${f.totalCycles}`}
                    percent={f.progressPercent}
                    note={
                      f.myNextPayoutCycle != null
                        ? `Your turn: cycle ${f.myNextPayoutCycle} · ${formatGhs(f.potPesewas)}`
                        : `Pot ${formatGhs(f.potPesewas)} each cycle`
                    }
                  />
                ))}

              {/* Quiet create tile */}
              <Link
                href="/create"
                className="rounded-2xl border border-dashed border-border p-5 flex flex-col items-center justify-center text-center gap-2 hover:bg-muted/40 transition-colors min-h-[150px]"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-4 w-4 text-secondary" />
                </div>
                <p className="text-sm font-medium text-foreground">Create a new fund</p>
                <p className="text-xs text-secondary">Or ask the Advisor to set one up</p>
              </Link>
            </div>
          </div>

          {/* Recent activity rail */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Recent activity</h3>
              <Link href="/activity" className="text-xs text-primary font-medium hover:underline">View all</Link>
            </div>
            <div className="cp-card divide-y divide-border/70">
              {recent.length > 0 ? (
                recent.map((a) => (
                  <ActivityRow
                    key={a.id}
                    icon={a.direction === 'in' ? 'in' : 'out'}
                    title={a.title}
                    detail={a.detail}
                    date={formatWhen(a.createdAt)}
                  />
                ))
              ) : (
                <p className="p-4 text-sm text-secondary">No activity yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Medical fundraisers you organize */}
        {(medical?.length ?? 0) > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Medical fundraisers</h3>
              <Link href="/funds" className="text-xs text-primary font-medium hover:underline">View all</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {medical!.slice(0, 3).map((m) => (
                <MedicalFundCard key={m.id} f={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function FundCard({
  href,
  name,
  type,
  typeClass,
  meta,
  amount,
  progressLabel,
  percent,
  note,
}: {
  href?: string
  name: string
  type: string
  typeClass: string
  meta: string
  amount: string
  progressLabel: string
  percent: number
  note: string
}) {
  const inner = (
    <>
      <div className="mb-4">
        <h4 className="font-bold text-foreground text-base">{name}</h4>
        <div className="flex gap-2 mt-2">
          <span className={`inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 ${typeClass}`}>
            {type}
          </span>
          <span className="cp-pill">{meta}</span>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-secondary font-medium">{amount}</span>
            <span className="text-sm font-bold text-primary">{progressLabel}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div className="cp-gradient h-2.5 rounded-full" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <p className="text-xs text-secondary">{note}</p>
      </div>
    </>
  )

  const className = 'cp-card cp-card-interactive p-5'
  return href ? (
    <Link href={href} className={`block ${className}`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}

function ActivityRow({
  icon,
  title,
  detail,
  date,
}: {
  icon: 'in' | 'out'
  title: string
  detail: string
  date: string
}) {
  const Icon = icon === 'in' ? ArrowDownLeft : ArrowUpRight
  return (
    <div className="flex items-start gap-3 p-4">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{title}</p>
        <p className="text-xs text-secondary mt-0.5">{detail}</p>
      </div>
      <p className="text-xs text-secondary whitespace-nowrap flex-shrink-0">{date}</p>
    </div>
  )
}
