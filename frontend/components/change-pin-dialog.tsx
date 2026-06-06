'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X, ChevronLeft, Loader2, KeyRound } from 'lucide-react'
import { pinSchema } from '@circlepay/shared'
import { PinInput } from './pin-input'
import { useChangePin } from '@/lib/queries'
import { ApiError } from '@/lib/api'

type Step = 'current' | 'new' | 'confirm'

const COPY: Record<Step, { title: string; hint: string }> = {
  current: { title: 'Enter your current PIN', hint: 'Confirm it’s you before changing your PIN.' },
  new: { title: 'Choose a new PIN', hint: 'Pick 4 digits that aren’t easy to guess.' },
  confirm: { title: 'Confirm your new PIN', hint: 'Enter the new PIN once more to be sure.' },
}

export function ChangePinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePin = useChangePin()
  const [step, setStep] = useState<Step>('current')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  function reset() {
    setStep('current')
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
  }

  function close() {
    reset()
    onClose()
  }

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  function onCurrentDone(v: string) {
    setError('')
    setStep('new')
  }

  function onNewDone(v: string) {
    const r = pinSchema.safeParse(v)
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Choose a 4-digit PIN')
      setNext('')
      return
    }
    if (v === current) {
      setError('Your new PIN must be different from your current one')
      setNext('')
      return
    }
    setError('')
    setStep('confirm')
  }

  async function onConfirmDone(v: string) {
    if (v !== next) {
      setError('Those PINs don’t match — try again')
      setConfirm('')
      return
    }
    setError('')
    try {
      await changePin.mutateAsync({ currentPin: current, newPin: next, confirmPin: v })
      toast.success('Your PIN has been changed')
      close()
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        toast.error('Too many attempts — try again later')
        close()
        return
      }
      if (e instanceof ApiError && e.code === 'PIN_INVALID') {
        setError('Your current PIN was incorrect')
        setCurrent('')
        setNext('')
        setConfirm('')
        setStep('current')
        return
      }
      setError(e instanceof ApiError ? e.message : 'Could not change your PIN')
      setNext('')
      setConfirm('')
      setStep('new')
    }
  }

  const order: Step[] = ['current', 'new', 'confirm']
  const idx = order.indexOf(step)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change PIN"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-md"
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          {idx > 0 ? (
            <button
              onClick={() => {
                setError('')
                setStep(order[idx - 1])
              }}
              className="-ml-1.5 rounded-lg p-1.5 text-secondary transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-4 w-4 text-primary" />
            </span>
          )}
          <p className="flex-1 text-sm font-semibold text-foreground">Change PIN</p>
          <button
            onClick={close}
            className="-mr-1.5 rounded-lg p-1.5 text-secondary transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step copy */}
        <div className="mt-5 text-center">
          <h2 className="text-lg font-semibold text-foreground">{COPY[step].title}</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-secondary">{COPY[step].hint}</p>
        </div>

        {/* PIN entry — remounts per step (fresh focus + completion) */}
        <div className="mt-5">
          {step === 'current' && (
            <PinInput key="current" value={current} onChange={setCurrent} onComplete={onCurrentDone} autoFocus error={!!error} ariaLabel="Current PIN" />
          )}
          {step === 'new' && (
            <PinInput key="new" value={next} onChange={setNext} onComplete={onNewDone} autoFocus error={!!error} ariaLabel="New PIN" />
          )}
          {step === 'confirm' && (
            <PinInput key="confirm" value={confirm} onChange={setConfirm} onComplete={onConfirmDone} autoFocus error={!!error} ariaLabel="Confirm new PIN" />
          )}
        </div>

        {/* Status row */}
        <div className="mt-4 flex min-h-5 items-center justify-center text-center text-sm">
          {changePin.isPending ? (
            <span className="inline-flex items-center gap-2 text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Updating…
            </span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <span className="text-secondary">Step {idx + 1} of 3</span>
          )}
        </div>
      </div>
    </div>
  )
}
