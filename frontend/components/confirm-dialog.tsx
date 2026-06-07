'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for genuinely destructive actions (revoke, decline). */
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * On-brand confirmation modal — replaces native window.confirm(). Calm, centered card
 * (bottom-sheet on mobile), backdrop + Escape to cancel. One primary action; secondary is quieter.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-md"
      >
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {message && <div className="text-sm leading-relaxed text-secondary">{message}</div>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="cp-btn-ghost px-5">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={
              danger
                ? 'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-60'
                : 'cp-btn-primary px-5'
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
