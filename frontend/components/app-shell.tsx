'use client'

import { Home, Wallet, Users, ActivitySquare, User, ChevronLeft, ChevronRight, LogOut, Loader2 } from 'lucide-react'
import { Logo, LogoMark } from './logo'
import { NotificationsBell } from './notifications-bell'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMe, useLogout } from '@/lib/queries'

const STANDING_LABEL: Record<string, string> = {
  new_: 'New member',
  building: 'Building trust',
  good: 'Good standing',
  excellent: 'Excellent standing',
  locked: 'Locked',
}

function initialsOf(name: string | null, phone: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  }
  return phone.slice(-2)
}

interface AppShellProps {
  children: React.ReactNode
  currentPage?: 'home' | 'funds' | 'pools' | 'activity' | 'profile'
  title?: string
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'funds', label: 'Funds', icon: Wallet, href: '/funds' },
  { id: 'pools', label: 'Pools', icon: Users, href: '/pools' },
  { id: 'activity', label: 'Activity', icon: ActivitySquare, href: '/activity' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
]

export function AppShell({ children, currentPage = 'home' }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()
  const { data: me, isLoading, isError } = useMe()
  const logout = useLogout()

  // Client-side auth gate (session cookie lives on the API origin, so middleware can't see it).
  useEffect(() => {
    if (isError) router.replace('/onboarding')
  }, [isError, router])

  if (isLoading || !me) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const initials = initialsOf(me.name, me.phone)
  const displayName = me.name?.trim() || me.phone
  const standing = STANDING_LABEL[me.trust?.standing ?? 'new_'] ?? 'Member'

  async function handleLogout() {
    await logout.mutateAsync().catch(() => undefined)
    router.replace('/onboarding')
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar (in-flow, sticky) */}
      <aside
        className={`cp-sidebar relative hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen shrink-0 border-r border-border transition-[width] duration-300 ease-out ${
          isSidebarOpen ? 'lg:w-64' : 'lg:w-[72px]'
        }`}
      >
        {/* Floating collapse chevron on the right edge */}
        <button
          onClick={() => setIsSidebarOpen((v) => !v)}
          className="absolute -right-3 top-20 z-50 h-6 w-6 rounded-full border border-border bg-card flex items-center justify-center text-secondary hover:text-primary hover:border-primary/40 transition-colors"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Header: logo */}
        <div className={`flex items-center h-16 ${isSidebarOpen ? 'px-5' : 'px-0 justify-center'}`}>
          {isSidebarOpen ? <Logo /> : <LogoMark />}
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            const link = (
              <a
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-secondary hover:text-foreground hover:bg-muted'
                } ${!isSidebarOpen && 'justify-center'}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isSidebarOpen && <span>{item.label}</span>}
              </a>
            )

            if (isSidebarOpen) {
              return <div key={item.id}>{link}</div>
            }

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Account block */}
        <div className="p-3 border-t border-border">
          {(() => {
            const account = (
              <a
                href="/profile"
                className={`flex items-center gap-3 rounded-2xl p-2 hover:bg-muted transition-colors ${!isSidebarOpen && 'justify-center'}`}
              >
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
                  {initials}
                </div>
                {isSidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-secondary">{standing}</p>
                  </div>
                )}
              </a>
            )

            if (isSidebarOpen) return account

            return (
              <Tooltip>
                <TooltipTrigger asChild>{account}</TooltipTrigger>
                <TooltipContent side="right">{displayName} · Profile</TooltipContent>
              </Tooltip>
            )
          })()}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-40 hidden lg:flex items-center justify-end gap-1 h-16 px-6 border-b border-border bg-background">
          <NotificationsBell />
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-secondary hover:text-destructive hover:bg-muted rounded-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/90 backdrop-blur-sm lg:hidden">
          <Logo />
          <NotificationsBell />
        </header>

        {/* Page content */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-8 pb-24 lg:px-10 lg:pb-12 2xl:px-14">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card px-2 py-2 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <a
              key={item.id}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg p-2 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-secondary hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
