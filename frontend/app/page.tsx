import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { TrendingUp, Plus, Sparkles, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

const contributions = [
  { month: 'Jan', value: 600 },
  { month: 'Feb', value: 800 },
  { month: 'Mar', value: 700 },
  { month: 'Apr', value: 1000 },
  { month: 'May', value: 900 },
  { month: 'Jun', value: 1200 },
]

function ContributionsChart() {
  const w = 280
  const h = 96
  const pad = 8
  const values = contributions.map((c) => c.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (contributions.length - 1)
  const points = contributions.map((c, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (c.value - min) / range) * (h - pad * 2)
    return { x, y }
  })
  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
      <polygon points={area} fill="#1D9E75" fillOpacity="0.06" />
      <polyline points={line} fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : 0} fill="#1D9E75" />
      ))}
    </svg>
  )
}

export default function Home() {
  return (
    <AppShell currentPage="home">
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Akwaaba, Ama</h2>
          <p className="text-sm text-secondary mt-1.5">Here&apos;s how your funds are doing</p>
        </div>

        {/* Row 1: Balance + Contributions chart */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Balance Card */}
          <div className="lg:col-span-2 cp-gradient rounded-3xl p-6 lg:p-8 text-white">
            <p className="text-sm font-medium text-white/80">Total saved across all funds</p>
            <p className="text-4xl lg:text-5xl font-bold mt-2 tracking-tight">GHS 4,820.00</p>
            <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold bg-white/20 rounded-full px-3 py-1">
              <ArrowUpRight className="h-4 w-4" />
              GHS 1,200 this month
            </span>

            <div className="grid grid-cols-3 gap-4 mt-7 pt-6 border-t border-white/20">
              <div>
                <p className="text-2xl font-bold tracking-tight">3</p>
                <p className="text-xs text-white/70 mt-1">Active funds</p>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">24</p>
                <p className="text-xs text-white/70 mt-1">Group members</p>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">6</p>
                <p className="text-xs text-white/70 mt-1">Months saved</p>
              </div>
            </div>
          </div>

          {/* Contributions Chart */}
          <div className="cp-card p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Contributions</p>
              <span className="text-xs font-medium text-primary flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> +18%
              </span>
            </div>
            <p className="text-xs text-secondary mt-1">Last 6 months</p>
            <div className="flex-1 flex items-center mt-4">
              <ContributionsChart />
            </div>
            <div className="flex justify-between mt-3">
              {contributions.map((c) => (
                <span key={c.month} className="text-[10px] text-secondary">{c.month}</span>
              ))}
            </div>
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
              <FundCard
                href="/funds/kumasi-traders"
                name="Kumasi Traders"
                type="Susu"
                typeClass="bg-primary/15 text-primary"
                meta="10 members"
                amount="GHS 500/month"
                progressLabel="Cycle 3 of 10"
                percent={30}
                note="Your payout in 4 cycles · GHS 5,000"
              />
              <FundCard
                href="/funds/kofi-mensah"
                name="Kofi's Surgery"
                type="Medical"
                typeClass="bg-destructive/15 text-destructive"
                meta="32 contributors"
                amount="GHS 3,200 raised"
                progressLabel="64%"
                percent={64}
                note="Goal: GHS 5,000 · 2 days left"
              />
              <FundCard
                name="Ama's School Fund"
                type="Education"
                typeClass="bg-amber-500/15 text-amber-600"
                meta="5 supporters"
                amount="GHS 2,400 saved"
                progressLabel="48%"
                percent={48}
                note="Goal: GHS 5,000 · For school fees"
              />

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
              <ActivityRow icon="out" title="Paid GHS 500 to Kumasi Traders" detail="Susu · Cycle 3" date="28 May" />
              <ActivityRow icon="in" title="Received GHS 5,000 payout" detail="Kumasi Traders · Cycle 2" date="15 May" />
              <ActivityRow icon="out" title="Donated GHS 200 to Kofi's Surgery" detail="Medical fund" date="10 May" />
              <ActivityRow icon="in" title="Joined Kumasi Traders Susu" detail="GHS 500/mo · 10 members" date="3 May" />
            </div>
          </div>
        </div>
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
