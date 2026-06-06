'use client'

import Link from 'next/link'
import { Heart, BadgeCheck, CheckCircle2 } from 'lucide-react'
import { formatGhs } from '@circlepay/shared'
import type { MyFundraiser } from '@/lib/api'

const VERIFY: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'bg-primary/15 text-primary' },
  pending: { label: 'Pending review', cls: 'bg-yellow-500/15 text-yellow-600' },
  unverified: { label: 'Pending review', cls: 'bg-yellow-500/15 text-yellow-600' },
  rejected: { label: 'Rejected', cls: 'bg-destructive/10 text-destructive' },
}

/** Compact card for a medical fundraiser the user organizes. Links to the in-app detail. */
export function MedicalFundCard({ f }: { f: MyFundraiser }) {
  const completed = f.status === 'completed'
  const v = VERIFY[f.verificationStatus] ?? VERIFY.pending
  return (
    <Link href={`/fundraisers/${f.id}`} className="cp-card cp-card-interactive p-5 block">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base leading-snug truncate">{f.name}</h3>
          <p className="text-xs text-secondary mt-1 truncate">For {f.beneficiary}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2.5 py-1 flex-shrink-0 bg-destructive/10 text-destructive">
          <Heart className="h-3 w-3" /> Medical
        </span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-secondary font-medium">{formatGhs(f.raised)} of {formatGhs(f.goal)}</span>
          <span className="text-xs font-semibold text-primary">{f.progressPercent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${f.progressPercent}%` }} /></div>
      </div>
      {completed ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> Completed · funds released</span>
      ) : (
        <span className={`inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2.5 py-0.5 ${v.cls}`}><BadgeCheck className="h-3 w-3" /> {v.label}</span>
      )}
    </Link>
  )
}
