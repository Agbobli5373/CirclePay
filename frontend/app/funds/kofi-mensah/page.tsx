import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { BadgeCheck, Share2, MessageCircle, Copy, ExternalLink } from 'lucide-react'

const fund = {
  patient: 'Kofi Mensah',
  hospital: 'Korle Bu Teaching Hospital, Accra',
  raised: 3200,
  target: 5000,
  contributors: 32,
  ussd: '*713*4829#',
}

const contributors = [
  { name: 'Akosua Frimpong', amount: 500, when: '2 hours ago' },
  { name: 'Anonymous', amount: 500, when: '5 hours ago' },
  { name: 'Kwame Mensah', amount: 300, when: 'Yesterday' },
  { name: 'Ama Asante', amount: 200, when: 'Yesterday' },
  { name: 'Yaw Amponsah', amount: 150, when: '2 days ago' },
  { name: 'Esi Owusu', amount: 100, when: '2 days ago' },
]

function CircularProgress({ percent }: { percent: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  return (
    <div className="relative w-40 h-40">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E7E3DC" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#1D9E75"
          strokeWidth="9"
          strokeDasharray={`${(percent / 100) * circ} ${circ}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-foreground">{percent}%</p>
        <p className="text-xs text-secondary">funded</p>
      </div>
    </div>
  )
}

export default function MedicalFundPage() {
  const percent = Math.round((fund.raised / fund.target) * 100)

  return (
    <AppShell currentPage="funds" title="Medical Fund">
      <div className="max-w-4xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Hero */}
          <div className="cp-card p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block text-xs font-medium bg-destructive/10 text-destructive rounded-full px-2.5 py-1">
                  Medical
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-2.5 py-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified hospital
                </span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{fund.patient}</h1>
              <p className="text-sm text-secondary mt-1">{fund.hospital}</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <CircularProgress percent={percent} />
              <p className="text-sm text-foreground font-medium">
                GHS {fund.raised.toLocaleString()} raised of GHS {fund.target.toLocaleString()}
              </p>
              <p className="text-xs text-secondary">{fund.contributors} contributors</p>
            </div>

            <Link
              href="/pay"
              className="block w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-center leading-[3rem]"
            >
              Contribute
            </Link>

            <p className="text-xs text-secondary text-center">
              No app? Dial <span className="font-medium text-foreground">{fund.ussd}</span> to contribute.
            </p>
          </div>

          {/* Share + contributors */}
          <div className="space-y-6">
            <div className="cp-card p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Share this fund</h2>
              </div>
              <p className="text-sm text-secondary">The more people see it, the faster Kofi gets care.</p>
              <div className="grid grid-cols-3 gap-2">
                <ShareButton icon={MessageCircle} label="WhatsApp" />
                <ShareButton icon={MessageCircle} label="SMS" />
                <ShareButton icon={Copy} label="Copy link" />
              </div>
            </div>

            <div className="cp-card p-6 space-y-3">
              <h2 className="text-base font-semibold text-foreground">Recent contributors</h2>
              <div className="space-y-1">
                {contributors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                        {c.name === 'Anonymous' ? '?' : c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-secondary">{c.when}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-primary flex-shrink-0">GHS {c.amount}</p>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/f/kofi-mensah"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline px-1"
            >
              <ExternalLink className="h-4 w-4" />
              View public page
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function ShareButton({ icon: Icon, label }: { icon: typeof MessageCircle; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 hover:border-primary/40 hover:bg-muted/40 transition-colors">
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}
