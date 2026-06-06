'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Search, Plus, Users, RefreshCcw, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useFunds, useMyFundraisers } from '@/lib/queries'
import { formatGhs } from '@circlepay/shared'
import type { FundSummary } from '@/lib/api'
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

export default function FundsPage() {
  const [search, setSearch] = useState('')
  const { data: funds, isLoading, isError, refetch } = useFunds('mine')
  const { data: medical } = useMyFundraisers()

  const q = search.toLowerCase()
  const filtered = (funds ?? []).filter((f) => f.name.toLowerCase().includes(q))
  const filteredMedical = (medical ?? []).filter((m) => m.name.toLowerCase().includes(q) || m.beneficiary.toLowerCase().includes(q))

  return (
    <AppShell currentPage="funds">
      <div className="space-y-6 pb-6">
        {/* Title bar: title | search (constrained) | action — one row on desktop, stacked on mobile */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-foreground">Funds</h1>
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

        {!isLoading && !isError && (
          <>
            {filtered.length > 0 && (
              <section className="space-y-3">
                {filteredMedical.length > 0 && (
                  <h2 className="text-xs font-semibold text-secondary uppercase tracking-wide">Susu circles</h2>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((fund) => (
                    <FundCard key={fund.id} fund={fund} />
                  ))}
                </div>
              </section>
            )}

            {filteredMedical.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-secondary uppercase tracking-wide">Medical fundraisers</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredMedical.map((m) => (
                    <MedicalFundCard key={m.id} f={m} />
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && filteredMedical.length === 0 && (
              <div className="text-center py-12">
                <p className="text-secondary">{search ? 'No funds match your search.' : 'You haven’t created any funds yet.'}</p>
                {!search && (
                  <Link href="/create" className="cp-btn-primary mt-4 inline-flex">
                    <Plus className="h-4 w-4" /> Create your first fund
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
