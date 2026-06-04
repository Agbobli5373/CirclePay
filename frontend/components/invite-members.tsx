'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, X, UserPlus, Loader2 } from 'lucide-react'
import { useInvite } from '@/lib/queries'
import { ApiError } from '@/lib/api'

const fmtPhone = (d: string) => `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 9)}`

/** Admin invite panel — add MoMo numbers and send invites (SMS carries the /join/<token> link). */
export function InviteMembers({
  fundId,
  remaining,
  onSent,
}: {
  fundId: string
  remaining: number
  onSent?: () => void
}) {
  const invite = useInvite(fundId)
  const [phone, setPhone] = useState('')
  const [list, setList] = useState<string[]>([])

  const add = () => {
    if (phone.length < 9) return
    setList((l) => (l.includes(phone) ? l : l.length < remaining ? [...l, phone] : l))
    setPhone('')
  }

  async function send() {
    if (list.length === 0) return
    try {
      const res = await invite.mutateAsync(list.map((d) => `+233${d}`))
      toast.success(`${res.invited} invite${res.invited === 1 ? '' : 's'} sent`)
      setList([])
      onSent?.()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send invites')
    }
  }

  return (
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
        <button
          onClick={add}
          disabled={phone.length < 9 || list.length >= remaining}
          className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-secondary transition-colors flex items-center gap-1 flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm text-foreground">+233 {fmtPhone(p)}</span>
              <button
                onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}
                className="p-1 text-secondary hover:text-destructive transition-colors"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={send} disabled={list.length === 0 || invite.isPending} className="cp-btn-primary w-full">
        {invite.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            Send {list.length > 0 ? list.length : ''} invite{list.length === 1 ? '' : 's'}
          </>
        )}
      </button>
      <p className="text-xs text-secondary text-center">{remaining} seat{remaining === 1 ? '' : 's'} left — invitees get an SMS with a join link.</p>
    </div>
  )
}
