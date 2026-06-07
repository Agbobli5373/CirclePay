'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectMenuProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: SelectOption<T>[]
  ariaLabel: string
  align?: 'left' | 'right'
}

/**
 * On-brand dropdown — replaces the native <select> so it matches the app
 * (cp-card menu, hairline, calm hover). Trigger button + popover listbox,
 * outside-click / Escape to close, a check on the active option.
 */
export function SelectMenu<T extends string>({ value, onChange, options, ariaLabel, align = 'right' }: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-none"
      >
        <span className="whitespace-nowrap">{current?.label ?? ''}</span>
        <ChevronDown className={`h-4 w-4 text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-30 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-md ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  active ? 'font-medium text-foreground' : 'text-secondary'
                }`}
              >
                {o.label}
                {active && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
