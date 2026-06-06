'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Users, Calendar, CheckCircle2, Clock, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'

interface Pool {
  id: string
  name: string
  status: 'active' | 'completed' | 'planning'
  members: number
  maxMembers: number
  monthlyAmount: number
  nextPayout?: string
  cycleLength: number
  location: string
  admin: string
  isAdmin?: boolean
}

const poolsList: Pool[] = [
  {
    id: '1',
    name: 'Kumasi Traders Circle',
    status: 'active',
    members: 8,
    maxMembers: 10,
    monthlyAmount: 500,
    nextPayout: 'Yaa Owusu - 15 June',
    cycleLength: 10,
    location: 'Kumasi Central Market',
    admin: 'Kofi Mensah',
    isAdmin: true,
  },
  {
    id: '2',
    name: 'Accra Women Entrepreneurs',
    status: 'active',
    members: 12,
    maxMembers: 12,
    monthlyAmount: 800,
    nextPayout: 'Ama Asante - 30 June',
    cycleLength: 12,
    location: 'Accra, Greater Accra',
    admin: 'Abena Kwarteng',
  },
  {
    id: '3',
    name: 'Tema Port Workers Union',
    status: 'active',
    members: 15,
    maxMembers: 20,
    monthlyAmount: 1000,
    nextPayout: 'David Amah - 10 July',
    cycleLength: 15,
    location: 'Tema, Greater Accra',
    admin: 'Ibrahim Hassan',
    isAdmin: true,
  },
  {
    id: '4',
    name: 'Cape Coast Teachers Fund',
    status: 'planning',
    members: 4,
    maxMembers: 8,
    monthlyAmount: 300,
    cycleLength: 8,
    location: 'Cape Coast, Central Region',
    admin: 'Osei Boateng',
  },
  {
    id: '5',
    name: 'Sekondi-Takoradi Student Pool',
    status: 'active',
    members: 7,
    maxMembers: 10,
    monthlyAmount: 200,
    nextPayout: 'Emmanuel Osei - 25 July',
    cycleLength: 10,
    location: 'Sekondi-Takoradi, Western Region',
    admin: 'Abena Mills',
  },
  {
    id: '6',
    name: 'Kumasi Completed Cycle 2023',
    status: 'completed',
    members: 10,
    maxMembers: 10,
    monthlyAmount: 500,
    cycleLength: 10,
    location: 'Kumasi Central Market',
    admin: 'Kofi Mensah',
  },
]

const statusConfig: Record<Pool['status'], { label: string; icon: React.ReactNode; dot: string }> = {
  'active': {
    label: 'Active',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
    dot: 'bg-primary',
  },
  'planning': {
    label: 'Planning',
    icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    dot: 'bg-amber-500',
  },
  'completed': {
    label: 'Completed',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />,
    dot: 'bg-secondary',
  },
}

export default function PoolsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('active')

  const filteredPools = poolsList.filter(pool => {
    if (filter === 'all') return true
    return pool.status === filter
  })

  return (
    <AppShell currentPage="pools">
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Pools</h1>
            <p className="text-secondary mt-1">Manage your Susu groups and save together</p>
          </div>
          <Link href="/create" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            Create Pool
          </Link>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'active', 'planning', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors text-sm capitalize ${
                filter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground hover:border-primary'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Pools List */}
        <div className="space-y-3">
          {filteredPools.map((pool) => {
            const config = statusConfig[pool.status]
            const isFull = pool.members === pool.maxMembers
            const isMyPool = pool.isAdmin ?? false

            return (
              <div
                key={pool.id}
                className="cp-card cp-card-interactive p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground text-base">{pool.name}</h3>
                      <span className="cp-pill">
                        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-secondary">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{pool.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>
                          {pool.members} of {pool.maxMembers} members
                          {isFull && ' (Full)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>GHS {pool.monthlyAmount}/month • {pool.cycleLength} cycle</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Content */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    {/* Admin Badge */}
                    {isMyPool && (
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        You Admin
                      </span>
                    )}

                    {/* Next Payout */}
                    {pool.nextPayout && (
                      <div className="text-right">
                        <p className="text-xs text-secondary mb-0.5">Next payout:</p>
                        <p className="text-sm font-semibold text-foreground">{pool.nextPayout}</p>
                      </div>
                    )}

                    {/* Member Progress */}
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(pool.members / pool.maxMembers) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex gap-2 pt-4 border-t border-border/50">
                  <button className="flex-1 py-2 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 font-medium text-sm transition-colors">
                    View Pool
                  </button>
                  {!isFull && pool.status === 'planning' && (
                    <button className="flex-1 py-2 rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 font-medium text-sm transition-colors">
                      Join Pool
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filteredPools.length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary mb-4">No {filter !== 'all' ? filter : ''} pools yet</p>
            <Link href="/create" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors w-fit mx-auto">
              <Plus className="h-4 w-4" />
              Create Your First Pool
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}
