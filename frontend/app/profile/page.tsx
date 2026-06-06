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
    router.replace('/onboarding?mode=login')
  }

  return (
    <AppShell currentPage="profile">
      <div className="space-y-6 pb-6 max-w-3xl">
        {me.trust?.standing === 'locked' && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Account locked</p>
              <p className="text-secondary mt-0.5">
                A missed Susu contribution locked your account across CirclePay. You can&apos;t join or create funds until it&apos;s resolved. Contact support to appeal.
              </p>
            </div>
          </div>
        )}

        {/* Identity */}
        <div className="cp-card p-5 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-semibold flex-shrink-0">
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
                <button onClick={saveName} disabled={updateProfile.isPending} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20" aria-label="Save">
                  {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditingName(false)} className="p-2 rounded-lg text-secondary hover:bg-muted" aria-label="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground truncate">{me.name?.trim() || prettyPhone(me.phone)}</h1>
                <button
                  onClick={() => { setDraftName(me.name ?? ''); setEditingName(true) }}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-muted transition-colors flex-shrink-0"
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-secondary">{prettyPhone(me.phone)} · {me.network} MoMo</p>
          </div>
        </div>

        {/* Trust Score */}
        <div className="cp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">CirclePay trust score</h2>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {standing.label}
            </span>
          </div>

          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`h-2.5 flex-1 rounded-full ${i < standing.segments ? 'bg-primary' : 'bg-muted'}`} />
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

        {/* Security settings (device-side preferences) */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground px-1">Security</h2>
          <div className="cp-card divide-y divide-border overflow-hidden">
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
