import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ArrowRight, Heart, Users, Check, BadgeCheck, ShieldCheck, Smartphone, CalendarDays } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ───────── Nav ───────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden px-3 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground md:inline-flex">
              How it works
            </a>
            <a href="#trust" className="hidden px-3 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground md:inline-flex">
              Trust
            </a>
            <Link href="/onboarding?mode=login" className="hidden px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary sm:inline-flex">
              Sign in
            </Link>
            <Link href="/onboarding?mode=register" className="cp-btn-primary">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ───────── Hero ───────── */}
        <section className="px-6 pt-16 pb-20 lg:px-8 lg:pt-24 lg:pb-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <div className="space-y-7">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                Powered by Moolre
              </span>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Save together.
                <br />
                <span className="text-primary">Support together.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-secondary">
                Run your Susu online and raise emergency funds for hospital bills — on Mobile Money,
                even by USSD. CirclePay never holds your money.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/onboarding?mode=register" className="cp-btn-primary px-7">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#how" className="cp-btn-ghost px-7">
                  See how it works
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" /> No fees
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" /> We never hold your money
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" /> Works on any phone
                </span>
              </div>
            </div>

            {/* On-brand product preview */}
            <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
              {/* Susu commitment chip (flat green), peeking */}
              <div className="absolute -top-5 -right-3 z-10 hidden w-44 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-sm sm:block">
                <p className="text-[11px] font-medium text-primary-foreground/80">You contribute each cycle</p>
                <p className="text-xl font-bold tabular-nums">GHS 200</p>
                <p className="mt-0.5 text-[11px] text-primary-foreground/80">across 2 active circles</p>
              </div>

              {/* Medical fundraiser card */}
              <div className="cp-card space-y-4 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    KO
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">Kofi&apos;s surgery</p>
                    <p className="text-xs text-secondary">Korle Bu Teaching Hospital</p>
                  </div>
                  <span className="inline-flex flex-shrink-0 items-center rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                    Medical
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold tabular-nums text-foreground">GHS 3,200</p>
                    <p className="text-xs text-secondary">of GHS 5,000</p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: '64%' }} />
                  </div>
                  <p className="text-xs text-secondary">64% raised · 38 contributors</p>
                </div>
                <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-secondary">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  Verified payout · Powered by Moolre
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Two pillars ───────── */}
        <section id="features" className="border-y border-border bg-card px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl space-y-16 lg:space-y-24">
            {/* Susu */}
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
              <div className="space-y-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Your Susu, online.</h2>
                <p className="max-w-md text-lg leading-relaxed text-secondary">
                  Run a rotating savings circle with your group — fixed contributions, a guaranteed
                  payout order, and a trust score that protects everyone.
                </p>
                <ul className="space-y-2.5 text-sm text-foreground">
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 flex-shrink-0 text-primary" /> Weekly or monthly contributions</li>
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 flex-shrink-0 text-primary" /> Rotating or random payout order</li>
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 flex-shrink-0 text-primary" /> Defaulters locked out platform-wide</li>
                </ul>
              </div>
              {/* Susu visual: cycle + payout order */}
              <div className="w-full max-w-sm cp-card space-y-4 p-5 lg:ml-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Kumasi Traders</p>
                    <p className="text-xs text-secondary">GHS 200 · monthly</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    Cycle 3 / 10
                  </span>
                </div>
                <div className="space-y-2">
                  <PayoutRow n="1" name="You" status="paid" />
                  <PayoutRow n="2" name="Ama" status="paid" />
                  <PayoutRow n="3" name="Kofi" status="next" />
                </div>
              </div>
            </div>

            {/* Medical (reversed on desktop) */}
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
              {/* Medical visual */}
              <div className="order-2 w-full max-w-sm cp-card space-y-4 p-5 lg:order-1 lg:mr-auto">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                    <Heart className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">Maa Adwoa&apos;s treatment</p>
                    <p className="text-xs text-secondary">37 Military Hospital</p>
                  </div>
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold tabular-nums text-foreground">GHS 8,400</p>
                    <p className="text-xs text-secondary">of GHS 10,000</p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: '84%' }} />
                  </div>
                  <p className="text-xs text-secondary">84% raised · paid directly to the hospital</p>
                </div>
              </div>
              <div className="order-1 space-y-5 lg:order-2">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                  <Heart className="h-5 w-5 text-destructive" />
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Raise for emergencies, fast.</h2>
                <p className="max-w-md text-lg leading-relaxed text-secondary">
                  Start a fundraiser for a hospital bill and share one link. Money goes straight to the
                  verified hospital — CirclePay never touches it.
                </p>
                <ul className="space-y-2.5 text-sm text-foreground">
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 flex-shrink-0 text-primary" /> Direct payout to the hospital</li>
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 flex-shrink-0 text-primary" /> Every payee verified before release</li>
                  <li className="flex items-center gap-2.5"><Check className="h-4 w-4 flex-shrink-0 text-primary" /> Live, transparent tracking</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── How it works ───────── */}
        <section id="how" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl lg:mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Start in minutes.</h2>
              <p className="mt-3 text-lg leading-relaxed text-secondary">No paperwork, no bank visit — just your phone.</p>
            </div>
            <div className="grid gap-10 md:grid-cols-3">
              <Step n="01" title="Create or join">
                Describe what you need in plain language and the Advisor sets it up — or join a circle you&apos;re invited to.
              </Step>
              <Step n="02" title="Contribute on MoMo">
                Pay with MTN, Telecel or AirtelTigo — or dial USSD on any phone, no internet needed.
              </Step>
              <Step n="03" title="Get paid out">
                Susu payouts rotate automatically; medical funds go straight to the verified hospital.
              </Step>
            </div>
          </div>
        </section>

        {/* ───────── Trust ───────── */}
        <section id="trust" className="border-y border-border bg-card px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div className="max-w-md space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Built on trust, not paperwork.</h2>
              <p className="text-lg leading-relaxed text-secondary">
                One trust score follows every member across the whole network. Pay on time and it grows;
                default and you&apos;re locked out of every circle — not just one. And CirclePay never holds
                your money.
              </p>
              <ul className="space-y-4">
                <TrustPoint icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Platform-wide trust score">
                  One score across every circle — defaulters can&apos;t just move to the next group.
                </TrustPoint>
                <TrustPoint icon={<BadgeCheck className="h-5 w-5 text-primary" />} title="Verified payouts">
                  Medical funds release only to an ops-verified hospital account.
                </TrustPoint>
                <TrustPoint icon={<Smartphone className="h-5 w-5 text-primary" />} title="Works on any phone">
                  Built MoMo- and USSD-first, so no smartphone or data is required.
                </TrustPoint>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ClaimCard value="No fees" label="On every contribution and payout" />
              <ClaimCard value="We never hold it" label="Money moves group → payee, same cycle" />
              <ClaimCard value="Any phone" label="Works over USSD — no internet" />
              <ClaimCard value="~40M" label="Mobile-money accounts in Ghana" eyebrow="Ghana market" />
            </div>
          </div>
        </section>

        {/* ───────── Use cases ───────── */}
        <section className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">A few ways people use it.</h2>
              <p className="mt-3 text-lg leading-relaxed text-secondary">Everyday situations CirclePay is built for.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <UseCase icon={<Users className="h-5 w-5 text-primary" />} tag="Group savings">
                A market association in Kumasi runs its monthly Susu online — no notebook, no missed turns,
                a payout order everyone can see.
              </UseCase>
              <UseCase icon={<Heart className="h-5 w-5 text-destructive" />} tag="Emergency">
                A family raises GHS 5,000 for surgery and shares one link on WhatsApp. The money goes
                straight to the hospital.
              </UseCase>
              <UseCase icon={<CalendarDays className="h-5 w-5 text-primary" />} tag="Saving toward a date">
                A church group saves together toward December, contributing every month until the goal is met.
              </UseCase>
            </div>
          </div>
        </section>

        {/* ───────── Final CTA ───────── */}
        <section className="bg-primary px-6 py-20 text-primary-foreground lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl space-y-7 text-center">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Ready to start your circle?</h2>
            <p className="mx-auto max-w-xl text-lg text-primary-foreground/90">
              Create a Susu or a medical fundraiser in minutes — free, on any phone.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/onboarding?mode=register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/onboarding?mode=login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-primary-foreground/40 px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
            <p className="text-sm text-primary-foreground/80">Built for the Moolre Startup Cup 2026 · Powered by Moolre</p>
          </div>
        </section>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-border px-6 py-12 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-xs text-sm text-secondary">
              Community finance for Ghana — Susu savings and emergency fundraising.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a href="#how" className="text-secondary transition-colors hover:text-foreground">How it works</a>
            <a href="#trust" className="text-secondary transition-colors hover:text-foreground">Trust</a>
            <Link href="/onboarding?mode=login" className="text-secondary transition-colors hover:text-foreground">Sign in</Link>
            <Link href="/onboarding?mode=register" className="font-medium text-foreground transition-colors hover:text-primary">Get started</Link>
          </nav>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-border pt-6 text-xs text-secondary">
          © 2026 CirclePay · Powered by Moolre
        </div>
      </footer>
    </div>
  )
}

/* ───────── Small building blocks (Server Components) ───────── */

function PayoutRow({ n, name, status }: { n: string; name: string; status: 'paid' | 'next' }) {
  const isNext = status === 'next'
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        isNext ? 'border-primary/40 bg-primary/5' : 'border-border'
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-secondary">
        {n}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
      {isNext ? (
        <span className="text-xs font-semibold text-primary">Next payout</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <Check className="h-3.5 w-3.5" /> Paid
        </span>
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-5">
      <span className="text-sm font-bold tabular-nums text-primary">{n}</span>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-secondary">{children}</p>
    </div>
  )
}

function TrustPoint({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-secondary">{children}</p>
      </div>
    </li>
  )
}

function ClaimCard({ value, label, eyebrow }: { value: string; label: string; eyebrow?: string }) {
  return (
    <div className="cp-card space-y-1.5 p-5">
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">{eyebrow}</p>
      )}
      <p className="text-xl font-bold tabular-nums text-primary">{value}</p>
      <p className="text-sm leading-snug text-secondary">{label}</p>
    </div>
  )
}

function UseCase({ icon, tag, children }: { icon: React.ReactNode; tag: string; children: React.ReactNode }) {
  return (
    <div className="cp-card space-y-3 p-5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">{tag}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  )
}
