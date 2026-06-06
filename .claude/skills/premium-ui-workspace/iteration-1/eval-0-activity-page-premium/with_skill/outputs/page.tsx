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
  contribution: { icon: ArrowUpRight, bg: 'bg-muted', color: 'text-secondary' },
  payout: { icon: ArrowDownLeft, bg: 'bg-primary/10', color: 'text-primary' },
  donation: { icon: Heart, bg: 'bg-destructive/10', color: 'text-destructive' },
  joined: { icon: UserPlus, bg: 'bg-muted', color: 'text-secondary' },
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

/** Coarse, human day-buckets used to group the timeline. */
function dayGroup(iso: string): string {
  const d = new Date(iso)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dayMs = 86400000
  const days = Math.floor((startOfToday.getTime() - d.getTime()) / dayMs)
  if (d.getTime() >= startOfToday.getTime()) return 'Today'
  if (days < 1) return 'Yesterday'
  if (days < 7) return 'Earlier this week'
  if (days < 30) return 'Earlier this month'
  return d.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')
  const { data: activity, isLoading, isError } = useActivity()

  const filtered = (activity ?? []).filter((a) => filter === 'all' || a.type === filter)

  // Group sequentially so the existing API order (newest-first) is preserved.
  const groups: { label: string; items: ActivityItem[] }[] = []
  for (const item of filtered) {
    const label = dayGroup(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return (
    <AppShell currentPage="activity">
      <div className="max-w-2xl space-y-8 pb-6">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground lg:hidden">Activity</h1>
          <p className="mt-1.5 text-sm text-secondary lg:mt-0">
            Your contributions, payouts and donations
          </p>
        </header>

        {/* Segmented filter */}
        <div
          role="tablist"
          aria-label="Filter activity"
          className="flex w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1"
        >
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Loading — skeleton that matches the real list shape (no layout shift) */}
        {isLoading && (
          <div className="cp-card divide-y divide-border/70" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading activity…</span>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-3.5 w-16 flex-shrink-0 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="cp-card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
              <Loader2 className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Could not load your activity</p>
              <p className="mt-1 text-sm text-secondary">Check your connection and try again.</p>
            </div>
          </div>
        )}

        {/* Loaded */}
        {!isLoading && !isError && (
          <>
            {groups.length > 0 ? (
              <div className="space-y-7">
                {groups.map((group) => (
                  <section key={group.label} className="space-y-3">
                    <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-secondary">
                      {group.label}
                    </h2>
                    <div className="cp-card divide-y divide-border/70">
                      {group.items.map((item) => {
                        const { icon: Icon, bg, color } = iconFor[item.type]
                        const incoming = item.direction === 'in'
                        return (
                          <div key={item.id} className="flex items-center gap-4 p-4">
                            <div
                              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${bg}`}
                            >
                              <Icon className={`h-5 w-5 ${color}`} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium leading-snug text-foreground">
                                {item.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-secondary">
                                {item.detail}
                                {item.reference && (
                                  <span className="text-secondary/70"> · Ref {item.reference}</span>
                                )}
                              </p>
                            </div>

                            <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-right">
                              {item.amount != null && (
                                <p
                                  className={`text-sm font-semibold tabular-nums ${
                                    incoming ? 'text-primary' : 'text-foreground'
                                  }`}
                                >
                                  {incoming ? '+' : '−'} {formatGhs(item.amount)}
                                </p>
                              )}
                              <p className="whitespace-nowrap text-xs text-secondary tabular-nums">
                                {formatWhen(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              /* Empty — calm copy + one next action */
              <div className="cp-card flex flex-col items-center gap-4 px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ArrowUpRight className="h-6 w-6 text-secondary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {filter === 'all' ? 'No activity yet' : 'Nothing here yet'}
                  </p>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-secondary">
                    {filter === 'all'
                      ? 'Contribute to a Susu and your payments and payouts will show up here.'
                      : 'Try a different filter, or contribute to a Susu to get started.'}
                  </p>
                </div>
                <a href="/funds" className="cp-btn-primary mt-1">
                  Go to my funds
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
