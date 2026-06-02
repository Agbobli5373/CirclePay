'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { ArrowDownLeft, ArrowUpRight, Heart, UserPlus } from 'lucide-react'

type ActivityType = 'contribution' | 'payout' | 'donation' | 'joined'

interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  detail: string
  amount?: number
  direction?: 'in' | 'out'
  date: string
  reference?: string
}

const activity: ActivityItem[] = [
  {
    id: '1',
    type: 'contribution',
    title: 'Paid GHS 500 to Kumasi Traders',
    detail: 'Susu contribution · Cycle 3 of 10',
    amount: 500,
    direction: 'out',
    date: 'Today, 09:14',
    reference: 'CP-8F32A1',
  },
  {
    id: '2',
    type: 'donation',
    title: "Donated GHS 200 to Kofi's surgery",
    detail: 'Medical fund · Korle Bu Teaching Hospital',
    amount: 200,
    direction: 'out',
    date: 'Yesterday, 18:02',
    reference: 'CP-7C19B4',
  },
  {
    id: '3',
    type: 'payout',
    title: 'Received GHS 5,000 payout',
    detail: 'Kumasi Traders Susu · Cycle 2 complete',
    amount: 5000,
    direction: 'in',
    date: '15 May, 11:30',
    reference: 'CP-6A04C7',
  },
  {
    id: '4',
    type: 'contribution',
    title: 'Paid GHS 300 to Accra Teachers Fund',
    detail: 'Education fund · Monthly contribution',
    amount: 300,
    direction: 'out',
    date: '12 May, 08:45',
    reference: 'CP-5B22D9',
  },
  {
    id: '5',
    type: 'joined',
    title: 'Joined Women Traders Business Susu',
    detail: 'GHS 200/month · 15 members · Admin: Ama Mensah',
    date: '8 May, 14:20',
  },
  {
    id: '6',
    type: 'payout',
    title: 'Received GHS 200 refund',
    detail: 'Tema Hospital Fund · Overpayment returned',
    amount: 200,
    direction: 'in',
    date: '3 May, 16:10',
    reference: 'CP-4E88F0',
  },
]

const filters = [
  { id: 'all', label: 'All' },
  { id: 'contribution', label: 'Contributions' },
  { id: 'payout', label: 'Payouts' },
  { id: 'donation', label: 'Donations' },
] as const

const iconFor: Record<ActivityType, { icon: typeof ArrowUpRight; bg: string; color: string }> = {
  contribution: { icon: ArrowUpRight, bg: 'bg-primary/10', color: 'text-primary' },
  payout: { icon: ArrowDownLeft, bg: 'bg-primary/10', color: 'text-primary' },
  donation: { icon: Heart, bg: 'bg-destructive/10', color: 'text-destructive' },
  joined: { icon: UserPlus, bg: 'bg-muted', color: 'text-secondary' },
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')

  const filtered = activity.filter((a) => filter === 'all' || a.type === filter)

  return (
    <AppShell currentPage="activity">
      <div className="space-y-6 pb-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground lg:hidden">Activity</h1>
          <p className="text-secondary mt-1">Your contributions, payouts and donations</p>
        </div>

        {/* Filters */}
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

        {/* Feed */}
        <div className="space-y-2">
          {filtered.map((item) => {
            const { icon: Icon, bg, color } = iconFor[item.type]
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 cp-card p-4 hover:bg-muted/30 transition-colors"
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-secondary mt-0.5">{item.detail}</p>
                  {item.reference && (
                    <p className="text-xs text-secondary mt-1">Ref: {item.reference}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {item.amount && (
                    <p
                      className={`text-sm font-semibold ${
                        item.direction === 'in' ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {item.direction === 'in' ? '+' : '−'} GHS {item.amount.toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-secondary mt-0.5 whitespace-nowrap">{item.date}</p>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-secondary">No activity here yet</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
