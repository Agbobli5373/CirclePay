import { useEffect } from 'react'

/** Lock body scroll while a modal/overlay is open; restore the previous value on close. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}
