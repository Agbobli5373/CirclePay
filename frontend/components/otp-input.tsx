'use client'

import { useRef, useState } from 'react'

interface OtpInputProps {
  value: string
  onChange: (v: string) => void
  /** Fixed code length → segmented cells. Omit for a variable-length single field (e.g. MoMo OTP). */
  length?: number
  autoFocus?: boolean
  /** Fires once when a fixed-length code is fully entered (enables auto-submit). */
  onComplete?: (v: string) => void
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Standard, native code entry. A real <input> drives everything so the device keyboard,
 * SMS autofill (autocomplete="one-time-code"), paste, and accessibility all work — unlike a
 * custom on-screen keypad. Renders as segmented cells when `length` is fixed, or a single field
 * otherwise. See the premium-ui skill: defer to the platform, keep it calm.
 */
export function OtpInput({ value, onChange, length, autoFocus, onComplete, ariaLabel = 'Verification code', disabled }: OtpInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const completedFor = useRef(-1)
  const max = length ?? 8

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, max)
    onChange(digits)
    if (length) {
      if (digits.length === length && completedFor.current !== length) {
        completedFor.current = length
        onComplete?.(digits)
      } else if (digits.length < length) {
        completedFor.current = -1
      }
    }
  }

  const commonProps = {
    ref,
    value,
    onChange: handleChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    inputMode: 'numeric' as const,
    autoComplete: 'one-time-code',
    pattern: '\\d*',
    'aria-label': ariaLabel,
    autoFocus,
    disabled,
  }

  // Variable-length: a single styled native field.
  if (!length) {
    return (
      <input
        {...commonProps}
        placeholder="Enter code"
        className="cp-input text-center text-lg font-semibold tracking-[0.4em] disabled:opacity-60"
      />
    )
  }

  // Fixed-length: one transparent input overlaid on the cells (tap anywhere to focus).
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input {...commonProps} maxLength={length} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      <div className="flex justify-between gap-2" aria-hidden="true">
        {Array.from({ length }).map((_, i) => {
          const isActive = focused && i === Math.min(value.length, length - 1) && value.length < length
          const isCursor = focused && i === value.length
          return (
            <div
              key={i}
              className={`flex aspect-square max-w-[52px] flex-1 items-center justify-center rounded-xl border bg-card text-xl font-semibold tabular-nums text-foreground transition-colors ${
                isActive || isCursor ? 'border-primary ring-4 ring-primary/15' : 'border-border'
              }`}
            >
              {value[i] ?? ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}
