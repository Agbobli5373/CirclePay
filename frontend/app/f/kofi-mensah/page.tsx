import Link from 'next/link'
import { Logo } from '@/components/logo'
import { BadgeCheck, ShieldCheck, MessageCircle, Copy } from 'lucide-react'

const fund = {
  patient: 'Kofi Mensah',
  hospital: 'Korle Bu Teaching Hospital, Accra',
  raised: 3200,
  target: 5000,
  contributors: 32,
}

const contributors = [
  { name: 'Akosua Frimpong', amount: 500, when: '2 hours ago' },
  { name: 'Anonymous', amount: 500, when: '5 hours ago' },
  { name: 'Kwame Mensah', amount: 300, when: 'Yesterday' },
  { name: 'Ama Asante', amount: 200, when: 'Yesterday' },
  { name: 'Yaw Amponsah', amount: 150, when: '2 days ago' },
]

export default function PublicMedicalFundPage() {
  const percent = Math.round((fund.raised / fund.target) * 100)

  return (
    <div className="min-h-screen bg-background">
      {/* Slim top bar */}
      <nav className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Logo />
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Start a fund
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block text-xs font-medium bg-destructive/10 text-destructive rounded-full px-2.5 py-1">
              Medical
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-2.5 py-1">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified hospital
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Help {fund.patient} get surgery</h1>
          <p className="text-secondary">{fund.hospital}</p>

          <div className="cp-card p-6 space-y-4 text-left">
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-foreground">
                GHS {fund.raised.toLocaleString()}
                <span className="text-base font-normal text-secondary"> raised of GHS {fund.target.toLocaleString()}</span>
              </p>
              <span className="text-lg font-semibold text-primary">{percent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div className="bg-primary h-3 rounded-full" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-sm text-secondary">{fund.contributors} contributors</p>
            <Link
              href="/pay"
              className="block w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-center leading-[3rem]"
            >
              Contribute now
            </Link>
            <div className="grid grid-cols-3 gap-2">
              <ShareButton icon={MessageCircle} label="WhatsApp" />
              <ShareButton icon={MessageCircle} label="SMS" />
              <ShareButton icon={Copy} label="Copy link" />
            </div>
          </div>
        </div>

        {/* The story */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">The story</h2>
          <p className="text-foreground leading-relaxed">
            Kofi Mensah, a 54-year-old carpenter from Accra, needs urgent heart surgery at Korle Bu
            Teaching Hospital. His family has covered the initial tests, but the operation itself is
            beyond their means. Every contribution brings Kofi closer to the care he needs — and goes
            straight to the hospital.
          </p>
        </section>

        {/* Contributors */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Contributors</h2>
          <div className="cp-card divide-y divide-border/60">
            {contributors.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-4">
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
        </section>

        {/* Trust footer */}
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-4">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-secondary leading-relaxed">
            Funds go straight to the verified hospital. CirclePay never holds the money. Powered by Moolre.
          </p>
        </div>
      </main>
    </div>
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
