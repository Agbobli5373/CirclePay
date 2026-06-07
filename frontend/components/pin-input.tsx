'use client'

import { useRef } from 'react'

interface PinInputProps {
  value: string
  onChange: (v: string) => void
  length?: number
  autoFocus?: boolean
  /** Fires once when all digits are entered. */
  onComplete?: (v: string) => void
  error?: boolean
  ariaLabel?: string
}

/**
 * Masked PIN entry backed by a real numeric input — the device keyboard does the typing; digits are
 * never shown (only dots). Standard, accessible, paste-safe. No custom on-screen keypad.
 */
export function PinInput({ value, onChange, length = 4, autoFocus, onComplete, error, ariaLabel = 'PIN' }: PinInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const completedFor = useRef(-1)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, length)
    onChange(digits)
    if (digits.length === length && completedFor.current !== length) {
      completedFor.current = length
      onComplete?.(digits)
    } else if (digits.length < length) {
      completedFor.current = -1
    }
  }

  return (
    <div className="relative flex justify-center py-2" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={handleChange}
        inputMode="numeric"
        autoComplete="off"
        pattern="\\d*"
        maxLength={length}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="flex justify-center gap-4" aria-hidden="true">
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length
          return (
            <div
              key={i}
              className={`h-5 w-5 rounded-full border-2 transition-colors ${
                error ? 'border-destructive bg-destructive' : filled ? 'border-primary bg-primary' : 'border-border bg-transparent'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
