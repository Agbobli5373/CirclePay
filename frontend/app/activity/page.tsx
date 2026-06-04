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

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')
  const { data: activity, isLoading, isError } = useActivity()

  const filtered = (activity ?? []).filter((a) => filter === 'all' || a.type === filter)

  return (
    <AppShell currentPage="activity">
      <div className="space-y-6 pb-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground lg:hidden">Activity</h1>
          <p className="text-secondary mt-1">Your contributions, payouts and donations</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground hover:border-primary/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {isError && <p className="text-center py-12 text-secondary">Could not load your activity.</p>}

        {!isLoading && !isError && (
          <div className="space-y-2">
            {filtered.map((item) => {
              const { icon: Icon, bg, color } = iconFor[item.type]
              return (
                <div key={item.id} className="flex items-start gap-3 cp-card p-4">
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
                      <p className={`text-sm font-semibold ${item.direction === 'in' ? 'text-primary' : 'text-foreground'}`}>
                        {item.direction === 'in' ? '+' : '−'} {formatGhs(item.amount)}
                      </p>
                    )}
                    <p className="text-xs text-secondary mt-0.5 whitespace-nowrap">{formatWhen(item.createdAt)}</p>
                  </div>
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <p className="text-secondary">No activity yet — contribute to a Susu to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
