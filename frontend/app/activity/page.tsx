'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { ArrowDownLeft, ArrowUpRight, Heart, UserPlus, Loader2 } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import { useActivity } from '@/lib/queries'
import type { ActivityItem } from '@/lib/api'

const filters = [
  { id: 'all', label: 'All' },
  { id: 'contribution', label: 'Contributions' },
  { id: 'payout', label: 'Payouts' },
  { id: 'donation', label: 'Donations' },
] as const

const iconFor: Record<ActivityItem['type'], { icon: typeof ArrowUpRight; bg: string; color: string }> = {
  contribution: { icon: ArrowUpRight, bg: 'bg-primary/10', color: 'text-primary' },
  payout: { icon: ArrowDownLeft, bg: 'bg-primary/10', color: 'text-primary' },
  donation: { icon: Heart, bg: 'bg-destructive/10', color: 'text-destructive' },
  joined: { icon: UserPlus, bg: 'bg-muted', color: 'text-secondary' },
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Date-group label: Today / Yesterday / "12 June" (+ year if not this year). */
function groupLabel(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
}

/** Group items into date sections, preserving the (chronological) order they arrive in. */
function groupByDay(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const groups: { label: string; items: ActivityItem[] }[] = []
  for (const item of items) {
    const label = groupLabel(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')
  const { data: activity, isLoading, isError } = useActivity()

  const all = activity ?? []
  const filtered = all.filter((a) => filter === 'all' || a.type === filter)
  const groups = groupByDay(filtered)

  // Honest recap of the activity shown (filters affect the feed, not this summary).
  const totalIn = all.reduce((s, a) => s + (a.direction === 'in' ? a.amount ?? 0 : 0), 0)
  const totalOut = all.reduce((s, a) => s + (a.direction === 'out' ? a.amount ?? 0 : 0), 0)
  const txnCount = all.filter((a) => a.amount != null).length
  const hasActivity = !isLoading && !isError && all.length > 0

  return (
    <AppShell currentPage="activity">
      <div className="max-w-5xl mx-auto space-y-6 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity</h1>
          <p className="text-secondary mt-1">Your contributions, payouts and donations</p>
        </div>

        <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:items-start space-y-6 lg:space-y-0">
          {/* Left rail: overview + filters */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            {hasActivity && (
              <div className="cp-card p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Overview</p>
                <SummaryRow label="Money in" value={formatGhs(totalIn)} accent />
                <SummaryRow label="Money out" value={formatGhs(totalOut)} />
                <div className="border-t border-border pt-3">
                  <SummaryRow label="Transactions" value={String(txnCount)} />
                </div>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors lg:w-full lg:text-left ${
                    filter === f.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground hover:border-primary/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Right: the feed */}
          <div>
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {isError && <p className="text-center py-12 text-secondary">Could not load your activity.</p>}

            {!isLoading && !isError && groups.length > 0 && (
              <div className="space-y-6">
                {groups.map((group) => (
                  <section key={group.label} className="space-y-2">
                    <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-secondary">{group.label}</h2>
                    <div className="cp-card divide-y divide-border overflow-hidden">
                      {group.items.map((item) => {
                        const { icon: Icon, bg, color } = iconFor[item.type]
                        return (
                          <div key={item.id} className="flex items-start gap-3 p-4">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                              <Icon className={`h-5 w-5 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.title}</p>
                              <p className="text-xs text-secondary mt-0.5">{item.detail}</p>
                              {item.reference && <p className="text-xs text-secondary mt-1 break-all">Ref: {item.reference}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.amount != null && (
                                <p className={`text-sm font-semibold tabular-nums ${item.direction === 'in' ? 'text-primary' : 'text-foreground'}`}>
                                  {item.direction === 'in' ? '+' : '−'} {formatGhs(item.amount)}
                                </p>
                              )}
                              <p className="text-xs text-secondary mt-0.5 whitespace-nowrap">{formatTime(item.createdAt)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {!isLoading && !isError && groups.length === 0 && (
              <div className="cp-card p-10 text-center">
                <p className="text-secondary">
                  {all.length === 0
                    ? 'No activity yet — contribute to a Susu to get started.'
                    : 'Nothing here for this filter.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-secondary">{label}</span>
      <span className={`text-base font-bold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
