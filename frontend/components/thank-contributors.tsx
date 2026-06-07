'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Heart, Loader2, X } from 'lucide-react'
import { useThankContributors } from '@/lib/queries'
import { ApiError } from '@/lib/api'

/** Organizer tool: send a warm thank-you SMS to everyone who has contributed (optional note). */
export function ThankContributors({ fundraiserId, disabled }: { fundraiserId: string; disabled?: boolean }) {
  const thank = useThankContributors(fundraiserId)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  async function send() {
    try {
      const r = await thank.mutateAsync(note.trim() || undefined)
      toast.success(r.sent > 0 ? `Thanked ${r.sent} contributor${r.sent === 1 ? '' : 's'}` : 'Everyone has already been thanked')
      setOpen(false)
      setNote('')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send thanks')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
      >
        <Heart className="h-3.5 w-3.5 text-destructive" /> Thank all
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Thank contributors"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-md"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                <Heart className="h-4 w-4 text-destructive" />
              </span>
              <p className="flex-1 text-sm font-semibold text-foreground">Thank your contributors</p>
              <button onClick={() => setOpen(false)} className="-mr-1.5 rounded-lg p-1.5 text-secondary hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-secondary">
              We&apos;ll send a warm SMS to everyone who has given. Add a short personal note if you like.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 160))}
              placeholder="Optional note — e.g. The surgery was a success. God bless you!"
              className="cp-textarea min-h-20"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary tabular-nums">{note.length}/160</span>
              <button onClick={send} disabled={thank.isPending} className="cp-btn-primary">
                {thank.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send thanks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
