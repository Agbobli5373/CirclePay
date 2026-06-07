'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Search, Plus, Users, RefreshCcw, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useMemo, useState } from 'react'
import { useFunds, useMyFundraisers } from '@/lib/queries'
import { formatGhs } from '@circlepay/shared'
import type { FundSummary, MyFundraiser } from '@/lib/api'
import { MedicalFundCard } from '@/components/medical-fund-card'

function FundCard({ fund }: { fund: FundSummary }) {
  return (
    <Link href={`/funds/${fund.id}`} className="cp-card cp-card-interactive p-5 block">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base leading-snug truncate">{fund.name}</h3>
          <p className="text-xs text-secondary mt-1 capitalize">
            {formatGhs(fund.contribution)} · {fund.frequency}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 flex-shrink-0 bg-primary/15 text-primary">
          {fund.type}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-secondary font-medium">
            Cycle {fund.currentCycle} of {fund.totalCycles}
          </span>
          <span className="text-xs font-semibold text-primary">{fund.progressPercent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${fund.progressPercent}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-secondary">
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{fund.memberCount} members</span>
        </div>
        <span>Pot {formatGhs(fund.potPesewas)}</span>
      </div>

      {fund.myNextPayoutCycle != null && (
        <p className="mt-3 pt-3 border-t border-border/50 text-xs text-foreground">
          Your turn: <span className="font-semibold text-primary">cycle {fund.myNextPayoutCycle}</span>
        </p>
      )}
    </Link>
  )
}

type TypeFilter = 'all' | 'Susu' | 'Medical'
type StatusFilter = 'all' | 'active' | 'completed'
type SortKey = 'recent' | 'name' | 'progress'

/** Normalised row so Susu funds + medical fundraisers can share one filterable/sortable grid. */
type Row =
  | { kind: 'Susu'; id: string; name: string; status: string; progress: number; createdAt: string; fund: FundSummary }
  | { kind: 'Medical'; id: string; name: string; beneficiary: string; status: string; progress: number; createdAt: string; m: MyFundraiser }

export default function FundsPage() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const { data: funds, isLoading, isError, refetch } = useFunds('mine')
  const { data: medical } = useMyFundraisers()

  const all: Row[] = useMemo(
    () => [
      ...(funds ?? []).map((f): Row => ({ kind: 'Susu', id: f.id, name: f.name, status: f.status, progress: f.progressPercent, createdAt: f.createdAt, fund: f })),
      ...(medical ?? []).map((m): Row => ({ kind: 'Medical', id: m.id, name: m.name, beneficiary: m.beneficiary, status: m.status, progress: m.progressPercent, createdAt: m.createdAt, m })),
    ],
    [funds, medical],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = all.filter((r) => {
      if (type !== 'all' && r.kind !== type) return false
      if (status !== 'all' && r.status !== status) return false
      if (q && !r.name.toLowerCase().includes(q) && !(r.kind === 'Medical' && r.beneficiary.toLowerCase().includes(q))) return false
      return true
    })
    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'progress') return b.progress - a.progress
      return b.createdAt.localeCompare(a.createdAt) // recent — ISO strings sort chronologically
    })
  }, [all, search, type, status, sort])

  const types: TypeFilter[] = ['all', 'Susu', 'Medical']
  const selectCls = 'h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground focus:outline-none focus:border-primary cursor-pointer'

  return (
    <AppShell currentPage="funds">
      <div className="space-y-5 pb-6">
        {/* Title bar: title | search | action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Funds</h1>
            <p className="text-secondary mt-1">Your savings circles &amp; fundraisers</p>
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
            <Input
              placeholder="Search your funds..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-card border-border"
            />
          </div>
          <Link
            href="/create"
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Fund
          </Link>
        </div>

        {/* Filter / sort bar: type pills (left) · status + sort (right) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 h-10 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  type === t ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:border-primary/40'
                }`}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={selectCls}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
              <option value="recent">Newest</option>
              <option value="name">Name (A–Z)</option>
              <option value="progress">Most progress</option>
            </select>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12 space-y-3">
            <p className="text-secondary">Could not load funds.</p>
            <button onClick={() => refetch()} className="cp-btn-ghost mx-auto">
              <RefreshCcw className="h-4 w-4" /> Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (r.kind === 'Susu' ? <FundCard key={r.id} fund={r.fund} /> : <MedicalFundCard key={r.id} f={r.m} />))}
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="text-center py-12">
            {all.length === 0 ? (
              <>
                <p className="text-secondary">You haven&apos;t created any funds yet.</p>
                <Link href="/create" className="cp-btn-primary mt-4 inline-flex">
                  <Plus className="h-4 w-4" /> Create your first fund
                </Link>
              </>
            ) : (
              <p className="text-secondary">No funds match these filters.</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
