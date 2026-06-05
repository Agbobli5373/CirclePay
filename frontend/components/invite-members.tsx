'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, X, UserPlus, Loader2, Copy, MessageCircle, Send, RotateCw, Trash2, CheckCircle2 } from 'lucide-react'
import { useInvite, useFundInvites, useResendInvite, useRevokeInvite } from '@/lib/queries'
import { ApiError, type Invite } from '@/lib/api'

const fmtRaw = (d: string) => `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 9)}`
const dispPhone = (p: string) => {
  const m = p.match(/^\+233(\d{2})(\d{3})(\d{4})$/)
  return m ? `+233 ${m[1]} ${m[2]} ${m[3]}` : p
}

const STATUS: Record<Invite['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-yellow-500/15 text-yellow-600' },
  accepted: { label: 'Joined', cls: 'bg-primary/15 text-primary' },
  expired: { label: 'Revoked', cls: 'bg-muted text-secondary' },
  declined: { label: 'Declined', cls: 'bg-destructive/10 text-destructive' },
}

/** Admin invite manager: add by number, then see/share/resend/revoke each invite. */
export function InviteMembers({ fundId, fundName, remaining }: { fundId: string; fundName: string; remaining: number }) {
  const invite = useInvite(fundId)
  const resend = useResendInvite(fundId)
  const revoke = useRevokeInvite(fundId)
  const { data: invites, isLoading } = useFundInvites(fundId)
  const pendingCount = (invites ?? []).filter((i) => i.status === 'pending').length

  const [phone, setPhone] = useState('')
  const [list, setList] = useState<string[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const add = () => {
    if (phone.length < 9) return
    setList((l) => (l.includes(phone) || l.length >= remaining ? l : [...l, phone]))
    setPhone('')
  }

  async function send() {
    if (list.length === 0) return
    try {
      const res = await invite.mutateAsync(list.map((d) => `+233${d}`))
      toast.success(`${res.invited} invite${res.invited === 1 ? '' : 's'} sent`)
      setList([])
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send invites')
    }
  }

  const shareMsg = (inv: Invite) => `Join my "${fundName}" Susu on CirclePay: ${inv.joinUrl}`

  async function copyLink(inv: Invite) {
    try {
      await navigator.clipboard.writeText(inv.joinUrl)
      toast.success('Join link copied')
    } catch {
      toast.error('Could not copy')
    }
  }
  async function doResend(inv: Invite) {
    setBusyId(inv.id)
    try {
      await resend.mutateAsync(inv.id)
      toast.success('Reminder sent')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not resend')
    } finally {
      setBusyId(null)
    }
  }
  async function doRevoke(inv: Invite) {
    if (!confirm(`Revoke the invite to ${dispPhone(inv.phone)}?`)) return
    setBusyId(inv.id)
    try {
      await revoke.mutateAsync(inv.id)
      toast.success('Invite revoked')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not revoke')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Add by number */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex items-center h-11 rounded-xl border-2 border-border bg-card px-3 flex-1 min-w-0 focus-within:border-primary">
            <span className="text-sm font-medium text-foreground border-r border-border pr-2 mr-2 whitespace-nowrap">🇬🇭 +233</span>
            <input
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="XX XXX XXXX"
              className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary focus:outline-none"
            />
          </div>
          <button onClick={add} disabled={phone.length < 9 || list.length >= remaining} className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-secondary transition-colors flex items-center gap-1 flex-shrink-0">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {list.length > 0 && (
          <div className="space-y-2">
            {list.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
                <span className="text-sm text-foreground">+233 {fmtRaw(p)}</span>
                <button onClick={() => setList((l) => l.filter((_, idx) => idx !== i))} className="p-1 text-secondary hover:text-destructive transition-colors" aria-label="Remove">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={send} disabled={invite.isPending} className="cp-btn-primary w-full">
              {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><UserPlus className="h-4 w-4" /> Send {list.length} invite{list.length === 1 ? '' : 's'}</>)}
            </button>
          </div>
        )}
        {remaining === 0 && pendingCount > 0 ? (
          <p className="text-xs text-secondary">
            All seats are reserved. Revoke a pending invite below, or wait for a response, to invite someone else.
          </p>
        ) : (
          <p className="text-xs text-secondary">{remaining} seat{remaining === 1 ? '' : 's'} left — invitees get an SMS with a join link.</p>
        )}
      </div>

      {/* Sent invites */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Invites</p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (invites ?? []).length === 0 ? (
          <p className="text-xs text-secondary">No invites yet — add a number above to invite someone.</p>
        ) : (
          <div className="space-y-2">
            {(invites ?? []).map((inv) => {
              const st = STATUS[inv.status]
              const busy = busyId === inv.id
              return (
                <div key={inv.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{dispPhone(inv.phone)}</span>
                    <span className={`rounded-full text-xs font-semibold px-2.5 py-0.5 ${st.cls}`}>{st.label}</span>
                  </div>
                  {inv.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <IconBtn onClick={() => copyLink(inv)} icon={<Copy className="h-3.5 w-3.5" />} label="Copy link" />
                      <a href={`https://wa.me/${inv.phone.replace(/^\+/, '')}?text=${encodeURIComponent(shareMsg(inv))}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                        <MessageCircle className="h-3.5 w-3.5 text-primary" /> WhatsApp
                      </a>
                      <a href={`sms:${inv.phone}?body=${encodeURIComponent(shareMsg(inv))}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                        <Send className="h-3.5 w-3.5 text-primary" /> SMS
                      </a>
                      <IconBtn onClick={() => doResend(inv)} disabled={busy} icon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />} label="Resend" />
                      <IconBtn onClick={() => doRevoke(inv)} disabled={busy} icon={<Trash2 className="h-3.5 w-3.5" />} label="Revoke" danger />
                    </div>
                  )}
                  {inv.status === 'accepted' && (
                    <p className="text-xs text-primary flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Joined the circle</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function IconBtn({ onClick, icon, label, disabled, danger }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-muted'}`}
    >
      {icon} {label}
    </button>
  )
}
