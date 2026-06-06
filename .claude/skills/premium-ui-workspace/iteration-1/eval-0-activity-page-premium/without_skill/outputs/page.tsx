'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { ArrowDownLeft, ArrowUpRight, Heart, UserPlus, Loader2, Hash } from 'lucide-react'
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

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

// Group items into calm, human time buckets for a timeline feel.
function bucketFor(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = d.getTime()
  if (t >= startOfToday) return 'Today'
  if (t >= startOfToday - 86400_000) return 'Yesterday'
  if (t >= startOfToday - 7 * 86400_000) return 'This week'
  return 'Earlier'
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier']

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')
  const { data: activity, isLoading, isError } = useActivity()

  const filtered = (activity ?? []).filter((a) => filter === 'all' || a.type === filter)

  // Preserve incoming order within each bucket; order the buckets themselves.
  const groups = BUCKET_ORDER.map((label) => ({
    label,
    items: filtered.filter((a) => bucketFor(a.createdAt) === label),
  })).filter((g) => g.items.length > 0)

  return (
    <AppShell currentPage="activity">
      <div className="mx-auto w-full max-w-2xl space-y-8 pb-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-[2rem] font-bold tracking-tight text-foreground leading-none">Activity</h1>
          <p className="text-sm text-secondary">Your contributions, payouts and donations</p>
        </header>

        {/* Segmented filter control */}
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {filters.map((f) => {
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
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
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-secondary">Loading your activity…</p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="cp-card flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">Could not load your activity</p>
            <p className="text-sm text-secondary">Please check your connection and try again.</p>
          </div>
        )}

        {/* Timeline */}
        {!isLoading && !isError && (
          <>
            {groups.length > 0 ? (
              <div className="space-y-7">
                {groups.map((group) => (
                  <section key={group.label} className="space-y-3">
                    <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                      {group.label}
                    </h2>

                    <div className="cp-card divide-y divide-border/70 overflow-hidden">
                      {group.items.map((item) => {
                        const { icon: Icon, bg, color } = iconFor[item.type]
                        const incoming = item.direction === 'in'
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
                          >
                            <div
                              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${bg}`}
                            >
                              <Icon className={`h-5 w-5 ${color}`} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground leading-snug">
                                {item.title}
                              </p>
                              <p className="truncate text-xs text-secondary mt-0.5">{item.detail}</p>
                              {item.reference && (
                                <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                                  <Hash className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{item.reference}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex-shrink-0 text-right">
                              {item.amount != null && (
                                <p
                                  className={`text-sm font-semibold tabular-nums tracking-tight ${
                                    incoming ? 'text-primary' : 'text-foreground'
                                  }`}
                                >
                                  {incoming ? '+' : '−'}&nbsp;{formatGhs(item.amount)}
                                </p>
                              )}
                              <p className="mt-0.5 whitespace-nowrap text-xs text-secondary tabular-nums">
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
              <div className="cp-card flex flex-col items-center gap-3 px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ArrowUpRight className="h-6 w-6 text-secondary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No activity yet</p>
                  <p className="text-sm text-secondary">Contribute to a Susu to get started.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
