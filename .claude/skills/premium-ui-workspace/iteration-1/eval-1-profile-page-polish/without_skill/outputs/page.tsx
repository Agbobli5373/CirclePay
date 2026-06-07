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
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
      <div className="mx-auto w-full max-w-2xl space-y-10 pb-10">
        {/* Page heading */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="mt-1.5 text-sm text-secondary">Your identity, standing &amp; security</p>
        </header>

        {me.trust?.standing === 'locked' && (
          <div className="flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/15">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-destructive">Account locked</p>
              <p className="mt-1 text-secondary">
                A missed Susu contribution locked your account across CirclePay. You can&apos;t join or create funds until it&apos;s resolved. Contact support to appeal.
              </p>
            </div>
          </div>
        )}

        {/* Identity + trust hero */}
        <section className="cp-gradient relative overflow-hidden rounded-3xl p-7 text-white lg:p-9">
          {/* Soft brand-tone glow for depth */}
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-50"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.18), transparent 70%)' }}
            aria-hidden
          />

          <div className="relative">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold ring-1 ring-white/25 backdrop-blur-sm">
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
                      className="h-11 flex-1 rounded-xl border border-white/30 bg-white/10 px-3.5 text-base font-medium text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none focus:ring-4 focus:ring-white/15"
                    />
                    <button
                      onClick={saveName}
                      disabled={updateProfile.isPending}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 text-white transition-colors hover:bg-white/30"
                      aria-label="Save"
                    >
                      {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-2xl font-bold tracking-tight">{me.name?.trim() || prettyPhone(me.phone)}</h2>
                    <button
                      onClick={() => { setDraftName(me.name ?? ''); setEditingName(true) }}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                      aria-label="Edit name"
                      title="Edit name"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {!editingName && (
                  <p className="mt-1 truncate text-sm text-white/80">{prettyPhone(me.phone)} · {me.network} MoMo</p>
                )}
              </div>
            </div>

            {/* Trust meter */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-white/90" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/80">CirclePay trust score</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {standing.label}
                </span>
              </div>

              <div className="mt-3 flex gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-colors ${i < standing.segments ? 'bg-white' : 'bg-white/20'}`}
                  />
                ))}
              </div>
            </div>

            {/* Stats triptych */}
            <div className="mt-7 grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                  <p className="mt-1 text-xs text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How trust works */}
        <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-secondary">
            Your score grows with every on-time contribution. Members who default are locked out
            platform-wide — not just from one fund — so every circle stays trustworthy.
          </p>
        </div>

        {/* Security settings (device-side preferences) */}
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-secondary">Security</h2>
          <div className="cp-card divide-y divide-border overflow-hidden">
            <button className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/40">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Change PIN</p>
                <p className="mt-0.5 text-xs text-secondary">Update your 4-digit security PIN</p>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-secondary" />
            </button>

            <div className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Fingerprint className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Biometric unlock</p>
                <p className="mt-0.5 text-xs text-secondary">Use fingerprint to approve payments</p>
              </div>
              <Toggle on={biometric} onClick={() => setBiometric((v) => !v)} label="Biometric unlock" />
            </div>

            <div className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">App lock</p>
                <p className="mt-0.5 text-xs text-secondary">Require PIN every time you open CirclePay</p>
              </div>
              <Toggle on={appLock} onClick={() => setAppLock((v) => !v)} label="App lock" />
            </div>
          </div>
        </section>

        <button
          onClick={signOut}
          disabled={logout.isPending}
          className="flex h-12 w-full items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-secondary transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
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
