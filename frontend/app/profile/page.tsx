'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { ShieldCheck, KeyRound, Fingerprint, Lock, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function ProfilePage() {
  const [biometric, setBiometric] = useState(true)
  const [appLock, setAppLock] = useState(false)

  const trustScore = 4 // out of 5 segments
  const stats = [
    { label: 'Funds completed', value: '7' },
    { label: 'On-time rate', value: '96%' },
    { label: 'Active funds', value: '3' },
  ]

  return (
    <AppShell currentPage="profile">
      <div className="space-y-6 pb-6 max-w-3xl">
        {/* Identity */}
        <div className="cp-card p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-semibold flex-shrink-0">
            AA
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Ama Asante</h1>
            <p className="text-sm text-secondary">+233 24 123 4567 · MTN MoMo</p>
            <p className="text-xs text-secondary mt-1">Kumasi, Ashanti Region</p>
          </div>
        </div>

        {/* Trust Score */}
        <div className="cp-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">CirclePay trust score</h2>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Good standing
            </span>
          </div>

          {/* 5-segment bar */}
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-2.5 flex-1 rounded-full ${i < trustScore ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-secondary mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-secondary leading-relaxed bg-muted/50 rounded-lg p-3">
            Your score grows with every on-time contribution. Members who default are locked out
            platform-wide — not just from one fund — so every circle stays trustworthy.
          </p>
        </div>

        {/* Security settings */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground px-1">Security</h2>
          <div className="cp-card divide-y divide-border overflow-hidden">
            {/* Change PIN */}
            <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Change PIN</p>
                <p className="text-xs text-secondary">Update your 4-digit security PIN</p>
              </div>
              <ChevronRight className="h-5 w-5 text-secondary flex-shrink-0" />
            </button>

            {/* Biometric */}
            <div className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Fingerprint className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Biometric unlock</p>
                <p className="text-xs text-secondary">Use fingerprint to approve payments</p>
              </div>
              <Toggle on={biometric} onClick={() => setBiometric((v) => !v)} label="Biometric unlock" />
            </div>

            {/* App Lock */}
            <div className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">App lock</p>
                <p className="text-xs text-secondary">Require PIN every time you open CirclePay</p>
              </div>
              <Toggle on={appLock} onClick={() => setAppLock((v) => !v)} label="App lock" />
            </div>
          </div>
        </div>

        <button className="w-full h-12 rounded-full border border-border bg-card text-foreground font-medium hover:bg-muted transition-colors">
          Sign out
        </button>
      </div>
    </AppShell>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
        on ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
          on ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
