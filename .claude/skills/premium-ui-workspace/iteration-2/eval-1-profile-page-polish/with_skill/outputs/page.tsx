'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { ShieldCheck, KeyRound, Fingerprint, Lock, ChevronRight, CheckCircle2, Loader2, Pencil, Check, X, AlertCircle } from 'lucide-react'
import { useMe, useFunds, useLogout, useUpdateProfile } from '@/lib/queries'

const STANDING: Record<string, { label: string; segments: number }> = {
  new_: { label: 'New member', segments: 1 },
  building: { label: 'Building trust', segments: 2 },
  good: { label: 'Good standing', segments: 4 },
  excellent: { label: 'Excellent standing', segments: 5 },
  locked: { label: 'Locked', segments: 0 },
}

function initialsOf(name: string | null, phone: string) {
  if (name?.trim()) return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return phone.slice(-2)
}
function prettyPhone(phone: string) {
  // +233241234567 -> +233 24 123 4567
  const m = phone.match(/^\+233(\d{2})(\d{3})(\d{4})$/)
  return m ? `+233 ${m[1]} ${m[2]} ${m[3]}` : phone
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: me, isLoading } = useMe()
  const { data: funds } = useFunds('mine')
  const logout = useLogout()
  const updateProfile = useUpdateProfile()
  const [biometric, setBiometric] = useState(true)
  const [appLock, setAppLock] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')

  async function saveName() {
    const n = draftName.trim()
    if (!n) {
      setEditingName(false)
      return
    }
    try {
      await updateProfile.mutateAsync(n)
      setEditingName(false)
      toast.success('Name updated')
    } catch {
      toast.error('Could not update name')
    }
  }

  if (isLoading || !me) {
    return (
      <AppShell currentPage="profile">
        <div className="space-y-6 pb-6 max-w-3xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
            <p className="text-secondary mt-1">Your identity, standing &amp; security</p>
          </div>
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
      </AppShell>
    )
  }

  const standing = STANDING[me.trust?.standing ?? 'new_'] ?? STANDING.new_
  const stats = [
    { label: 'Funds completed', value: String(me.trust?.fundsCompleted ?? 0) },
    { label: 'On-time rate', value: `${me.trust?.onTimeRate ?? 100}%` },
    { label: 'Active funds', value: String(funds?.length ?? 0) },
  ]

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined)
    router.replace('/onboarding')
  }

  return (
    <AppShell currentPage="profile">
      <div className="space-y-8 pb-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="text-secondary mt-1">Your identity, standing &amp; security</p>
        </div>

        {me.trust?.standing === 'locked' && (
          <div className="cp-card border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Account locked</p>
              <p className="text-secondary mt-1 leading-relaxed">
                A missed Susu contribution locked your account across CirclePay. You can&apos;t join or create funds until it&apos;s resolved. Contact support to appeal.
              </p>
            </div>
          </div>
        )}

        {/* Identity */}
        <section className="cp-card p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-semibold tracking-tight flex-shrink-0">
            {initialsOf(me.name, me.phone)}
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  placeholder="Your name"
                  maxLength={80}
                  autoFocus
                  className="cp-input h-10 flex-1"
                />
                <button onClick={saveName} disabled={updateProfile.isPending} className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors" aria-label="Save">
                  {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditingName(false)} className="h-10 w-10 inline-flex items-center justify-center rounded-full text-secondary hover:bg-muted transition-colors" aria-label="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-semibold tracking-tight text-foreground truncate">{me.name?.trim() || prettyPhone(me.phone)}</h2>
                <button
                  onClick={() => { setDraftName(me.name ?? ''); setEditingName(true) }}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-muted transition-colors flex-shrink-0"
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-secondary mt-0.5">{prettyPhone(me.phone)} · {me.network} MoMo</p>
          </div>
        </section>

        {/* Trust Score */}
        <section className="cp-card p-6 space-y-5">
          <div className="flex items-center gap-2 text-secondary">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wide">CirclePay trust score</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-2xl font-bold tracking-tight text-foreground">{standing.label}</p>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-2.5 flex-1 rounded-full ${i < standing.segments ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border/70 border-t border-border/70 pt-5">
            {stats.map((s) => (
              <div key={s.label} className="px-2 text-center first:pl-0 last:pr-0">
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{s.value}</p>
                <p className="text-xs text-secondary mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-secondary leading-relaxed">
            Your score grows with every on-time contribution. Members who default are locked out
            platform-wide — not just from one fund — so every circle stays trustworthy.
          </p>
        </section>

        {/* Security settings (device-side preferences) */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">Security</h2>
          <div className="cp-card divide-y divide-border/70 overflow-hidden">
            <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors text-left">
              <KeyRound className="h-5 w-5 text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Change PIN</p>
                <p className="text-xs text-secondary mt-0.5">Update your 4-digit security PIN</p>
              </div>
              <ChevronRight className="h-5 w-5 text-secondary flex-shrink-0" />
            </button>

            <div className="flex items-center gap-4 p-4">
              <Fingerprint className="h-5 w-5 text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Biometric unlock</p>
                <p className="text-xs text-secondary mt-0.5">Use fingerprint to approve payments</p>
              </div>
              <Toggle on={biometric} onClick={() => setBiometric((v) => !v)} label="Biometric unlock" />
            </div>

            <div className="flex items-center gap-4 p-4">
              <Lock className="h-5 w-5 text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">App lock</p>
                <p className="text-xs text-secondary mt-0.5">Require PIN every time you open CirclePay</p>
              </div>
              <Toggle on={appLock} onClick={() => setAppLock((v) => !v)} label="App lock" />
            </div>
          </div>
        </section>

        <button
          onClick={signOut}
          disabled={logout.isPending}
          className="cp-btn-ghost w-full"
        >
          {logout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign out'}
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
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${
        on ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-card transition-transform ${
          on ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
