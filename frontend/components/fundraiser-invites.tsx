'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Loader2, Bell, X, Check } from 'lucide-react'
import {
  useFundraiserInvites,
  useInviteContributors,
  useRemindContributor,
  useCancelContributorInvite,
} from '@/lib/queries'
import { ApiError } from '@/lib/api'

function prettyPhone(phone: string): string {
  const m = phone.match(/^\+233(\d{2})(\d{3})(\d{4})$/)
  return m ? `+233 ${m[1]} ${m[2]} ${m[3]}` : phone
}

/** Organizer tool: invite family/friends to contribute (SMS), see who gave, and remind non-givers. */
export function FundraiserInvites({ fundraiserId }: { fundraiserId: string }) {
  const { data: invites } = useFundraiserInvites(fundraiserId)
  const invite = useInviteContributors(fundraiserId)
  const remind = useRemindContributor(fundraiserId)
  const cancel = useCancelContributorInvite(fundraiserId)
  const [phone, setPhone] = useState('')

  async function add() {
    if (phone.length < 9) return
    try {
      await invite.mutateAsync([`+233${phone}`])
      setPhone('')
      toast.success('Invite sent')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send invite')
    }
  }
  async function onRemind(id: string) {
    try {
      await remind.mutateAsync(id)
      toast.success('Reminder sent')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not remind')
    }
  }

  return (
    <div className="cp-card p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Invite family &amp; friends</h2>
        <p className="text-xs text-secondary mt-0.5">
          They get an SMS with the donate link. Remind anyone who hasn&apos;t given yet.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center h-11 rounded-lg border border-border bg-card px-3 flex-1 min-w-0 focus-within:border-primary">
          <span className="text-sm font-medium text-foreground border-r border-border pr-2 mr-2 whitespace-nowrap">🇬🇭 +233</span>
          <input
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="XX XXX XXXX"
            className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary focus:outline-none"
          />
        </div>
        <button
          onClick={add}
          disabled={phone.length < 9 || invite.isPending}
          className="h-11 px-4 rounded-lg bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-secondary transition-colors flex items-center gap-1 flex-shrink-0"
        >
          {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Plus className="h-4 w-4" /> Invite</>)}
        </button>
      </div>

      {invites && invites.length > 0 && (
        <div className="divide-y divide-border/60">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 py-2.5">
              <p className="text-sm text-foreground truncate">{prettyPhone(inv.phone)}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inv.status === 'contributed' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-3.5 w-3.5" /> Gave
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => onRemind(inv.id)}
                      disabled={remind.isPending}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                    >
                      <Bell className="h-3.5 w-3.5" /> Remind
                    </button>
                    <button
                      onClick={() => cancel.mutate(inv.id)}
                      aria-label="Remove invite"
                      className="p-1.5 rounded-lg text-secondary hover:text-destructive hover:bg-muted transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
