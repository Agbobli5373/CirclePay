'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Search, Filter, Plus, Users, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

interface Fund {
  id: string
  name: string
  type: 'Susu' | 'Medical' | 'Education' | 'Business'
  description: string
  members: number
  target: number
  raised: number
  monthlyContribution?: number
  createdBy: string
  daysLeft?: number
  tags: string[]
  href?: string
}

const fundsList: Fund[] = [
  {
    id: '1',
    name: 'Kumasi Traders Susu',
    type: 'Susu',
    description: 'Weekly savings group for market traders in Kumasi Central Market',
    members: 10,
    target: 5000,
    raised: 3250,
    monthlyContribution: 500,
    createdBy: 'Yaa Owusu',
    tags: ['Trading', 'Weekly', 'Active'],
    href: '/funds/kumasi-traders',
  },
  {
    id: '2',
    name: 'Kofi Medical Emergency',
    type: 'Medical',
    description: 'Urgent surgery needed. Help Kofi with medical expenses',
    members: 8,
    target: 5000,
    raised: 3200,
    daysLeft: 2,
    createdBy: 'Family Friends',
    tags: ['Urgent', 'Hospital', 'Emergency'],
    href: '/funds/kofi-mensah',
  },
  {
    id: '3',
    name: 'Accra Teachers Education Fund',
    type: 'Education',
    description: 'Support education for underprivileged children in Accra',
    members: 24,
    target: 10000,
    raised: 6800,
    monthlyContribution: 300,
    createdBy: 'Education Alliance',
    tags: ['Education', 'Children', 'Monthly'],
  },
  {
    id: '4',
    name: 'Women Traders Business Susu',
    type: 'Susu',
    description: 'Rotating fund for women entrepreneurs in commerce',
    members: 15,
    target: 3000,
    raised: 2100,
    monthlyContribution: 200,
    createdBy: 'Ama Mensah',
    tags: ['Women', 'Business', 'Growth'],
  },
  {
    id: '5',
    name: 'Tema Hospital Fund',
    type: 'Medical',
    description: 'Emergency medical fund for Tema residents',
    members: 32,
    target: 15000,
    raised: 8400,
    createdBy: 'Tema Community',
    tags: ['Health', 'Community', 'Hospital'],
  },
  {
    id: '6',
    name: 'Takoradi Youth Innovation Fund',
    type: 'Business',
    description: 'Support for young entrepreneurs starting their first business',
    members: 18,
    target: 8000,
    raised: 4500,
    monthlyContribution: 250,
    createdBy: 'Youth Development Org',
    tags: ['Youth', 'Startup', 'Innovation'],
  },
]

const fundTypeBadge: Record<Fund['type'], string> = {
  'Susu': 'bg-primary/15 text-primary',
  'Medical': 'bg-destructive/15 text-destructive',
  'Education': 'bg-amber-500/15 text-amber-600',
  'Business': 'bg-sky-500/15 text-sky-600',
}

export default function FundsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<Fund['type'] | 'All'>('All')

  const filteredFunds = fundsList.filter(fund => {
    const matchesSearch = fund.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'All' || fund.type === selectedType
    return matchesSearch && matchesType
  })

  const getProgress = (raised: number, target: number) => (raised / target) * 100

  return (
    <AppShell currentPage="funds">
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Explore Funds</h1>
            <p className="text-secondary mt-1">Discover funds to join or create your own</p>
          </div>
          <Link href="/create" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            Create Fund
          </Link>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
              <Input
                placeholder="Search funds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-card border-border"
              />
            </div>
            <button className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors">
              <Filter className="h-5 w-5 text-foreground" />
            </button>
          </div>

          {/* Type Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['All', 'Susu', 'Medical', 'Education', 'Business'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as Fund['type'] | 'All')}
                className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors text-sm ${
                  selectedType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground hover:border-primary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-secondary">
          {filteredFunds.length} fund{filteredFunds.length !== 1 ? 's' : ''} found
        </p>

        {/* Funds Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFunds.map((fund) => {
            const progress = getProgress(fund.raised, fund.target)

            return (
              <div
                key={fund.id}
                className="cp-card cp-card-interactive p-5"
              >
                {/* Header */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-base leading-snug">{fund.name}</h3>
                      <p className="text-xs text-secondary mt-1">{fund.description}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 flex-shrink-0 ${fundTypeBadge[fund.type]}`}>
                      {fund.type}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-secondary font-medium">
                        GHS {fund.raised.toLocaleString()} of GHS {fund.target.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-3 text-xs text-secondary pt-1">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{fund.members} members</span>
                    </div>
                    {fund.monthlyContribution && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>GHS {fund.monthlyContribution}/mo</span>
                      </div>
                    )}
                    {fund.daysLeft && (
                      <span className="font-medium text-destructive">{fund.daysLeft} days left</span>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4 pt-3 border-t border-border/50">
                  {fund.tags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="text-xs bg-muted px-2 py-1 rounded text-secondary">
                      {tag}
                    </span>
                  ))}
                  {fund.tags.length > 2 && (
                    <span className="text-xs bg-muted px-2 py-1 rounded text-secondary">
                      +{fund.tags.length - 2}
                    </span>
                  )}
                </div>

                {/* Creator */}
                <p className="text-xs text-secondary">Created by <span className="font-medium text-foreground">{fund.createdBy}</span></p>

                {/* CTA Button */}
                <Link
                  href={fund.href ?? '#'}
                  className="block w-full mt-4 py-2.5 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors text-sm text-center"
                >
                  View Details
                </Link>
              </div>
            )
          })}
        </div>

        {filteredFunds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary">No funds match your search</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
