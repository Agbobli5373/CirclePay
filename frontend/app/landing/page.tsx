import { Logo } from '@/components/logo'
import { ArrowRight, Heart, Users, TrendingUp, Zap, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between lg:px-6">
          <Logo />
          <div className="hidden md:flex items-center gap-8">
            <a href="#how" className="text-sm text-foreground hover:text-primary transition-colors">
              How it works
            </a>
            <a href="#features" className="text-sm text-foreground hover:text-primary transition-colors">
              Why CirclePay
            </a>
            <div className="flex items-center gap-2">
              <a href="/onboarding" className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
                Sign in
              </a>
              <a href="/onboarding" className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
                Get started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 lg:pt-32 lg:pb-40 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 items-center lg:grid-cols-2">
            {/* Hero Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                    Built for Ghana. Powered by Moolre.
                  </span>
                </div>
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
                  Save together.<br />
                  <span className="text-primary">Support together.</span>
                </h1>
                <p className="text-lg text-secondary leading-relaxed max-w-xl">
                  Join Susu circles, raise emergency funds, and grow wealth with your community—zero fees, zero middlemen. Digital savings for Ghana.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <a 
                  href="/onboarding"
                  className="px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-center"
                >
                  Join Now
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a 
                  href="#features"
                  className="px-8 py-3.5 border border-border text-foreground rounded-full font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  Learn More
                </a>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                <div>
                  <p className="text-2xl font-bold text-primary">50K+</p>
                  <p className="text-xs text-secondary mt-1">Members</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">GHS 2M+</p>
                  <p className="text-xs text-secondary mt-1">Raised</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">Zero</p>
                  <p className="text-xs text-secondary mt-1">Fees</p>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-sm">
                <div className="rounded-3xl overflow-hidden border-8 border-foreground/10 bg-background">
                  <div className="p-6 text-center space-y-4">
                    <div className="h-10 bg-primary/10 rounded-lg" />
                    <div className="space-y-3">
                      <div className="h-20 bg-card rounded-lg border border-border" />
                      <div className="h-20 bg-card rounded-lg border border-border" />
                      <div className="grid grid-cols-3 gap-2 h-16">
                        <div className="bg-card rounded-lg border border-border" />
                        <div className="bg-card rounded-lg border border-border" />
                        <div className="bg-card rounded-lg border border-border" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why CirclePay Section */}
      <section id="features" className="bg-card border-y border-border py-16 px-4 lg:py-24 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Why CirclePay</h2>
            <p className="text-lg text-secondary max-w-2xl mx-auto">The features you need to save, support, and grow together</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Susu Funds</h3>
              <p className="text-secondary leading-relaxed">Save with your group in rotating circles. Automatic payouts, protection against defaulters, and complete transparency.</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Fixed monthly contribution</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Guaranteed payout order</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Trust scoring</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Heart className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Medical Funds</h3>
              <p className="text-secondary leading-relaxed">Raise emergency funds for hospital bills quickly. Direct payout to verified hospitals, shareable links, instant contributors.</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Direct hospital payout</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Verified partners</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Transparent tracking</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">AI Advisor</h3>
              <p className="text-secondary leading-relaxed">Describe what you need in plain language. Our AI recommends the right fund type and settings for your goals.</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Smart recommendations</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Plain language setup</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Personalized guidance</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Zero Fees</h3>
              <p className="text-secondary leading-relaxed">Your money goes to your goals, not middlemen. We never hold your savings. Completely transparent and fair.</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> No transaction fees</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> We never hold your money</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary flex-shrink-0" /> Full transparency</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4 lg:py-24 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Real stories from Ghana</h2>
            <p className="text-lg text-secondary">See how CirclePay is changing community finance</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'CirclePay made saving with my trading group so simple. I got my payout exactly when I needed it.',
                author: 'Ama Asante',
                role: 'Market Trader, Kumasi',
              },
              {
                quote: 'When my son needed emergency surgery, we raised GHS 5,000 in just 2 days using CirclePay. Incredible.',
                author: 'Kwame Boateng',
                role: 'Father, Accra',
              },
              {
                quote: 'As a group admin, I love how transparent everything is. Everyone can track contributions in real-time.',
                author: 'Abena Owusu',
                role: 'Fund Administrator',
              },
            ].map((testimonial, idx) => (
              <div key={idx} className="cp-card p-6 space-y-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-primary text-lg">★</span>
                  ))}
                </div>
                <p className="text-foreground leading-relaxed text-sm">{testimonial.quote}</p>
                <div className="pt-4 border-t border-border">
                  <p className="font-semibold text-foreground text-sm">{testimonial.author}</p>
                  <p className="text-xs text-secondary">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="bg-muted py-16 px-4 lg:py-24 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Three steps to start</h2>
            <p className="text-lg text-secondary">Join or create a fund in minutes</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                number: '1',
                title: 'Sign up',
                desc: 'Create your CirclePay account with just your phone number. Fast and secure.',
              },
              {
                number: '2',
                title: 'Browse or create',
                desc: 'Join an existing fund or start a new Susu circle with your community.',
              },
              {
                number: '3',
                title: 'Save together',
                desc: 'Contribute via MoMo, track progress, and get paid out automatically.',
              },
            ].map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mb-4">
                  {step.number}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-secondary text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="py-16 px-4 lg:py-24 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 items-center lg:grid-cols-2">
            <div className="space-y-6">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground">Built on trust</h2>
              <p className="text-lg text-secondary leading-relaxed">
                CirclePay protects your money with platform-wide trust scoring. Every member has a score based on on-time payments. Defaulters can&apos;t join other funds across the entire network—not just one circle.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-foreground">Trust Scoring</p>
                    <p className="text-sm text-secondary">Every member tracked platform-wide</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-foreground">Defaulter Protection</p>
                    <p className="text-sm text-secondary">Bad actors are locked out across all funds</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-foreground">We Never Hold Money</p>
                    <p className="text-sm text-secondary">Only your group members manage funds</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="cp-card p-6 text-center space-y-3">
                <p className="text-3xl font-bold text-primary">43.7M</p>
                <p className="text-sm text-secondary">Mobile money accounts in Ghana</p>
              </div>
              <div className="cp-card p-6 text-center space-y-3">
                <p className="text-3xl font-bold text-primary">55%</p>
                <p className="text-sm text-secondary">Run on USSD (no internet)</p>
              </div>
              <div className="cp-card p-6 text-center space-y-3">
                <p className="text-3xl font-bold text-primary">GHS 0</p>
                <p className="text-sm text-secondary">Fees ever charged</p>
              </div>
              <div className="cp-card p-6 text-center space-y-3">
                <p className="text-3xl font-bold text-primary">100%</p>
                <p className="text-sm text-secondary">Transparent</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="cp-gradient text-white py-16 px-4 lg:py-20 lg:px-6">
        <div className="mx-auto max-w-4xl text-center space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold">Ready to save together?</h2>
            <p className="text-lg text-primary-foreground/90">Join 50,000+ Ghanaians already using CirclePay</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/onboarding"
              className="px-8 py-3.5 bg-primary-foreground text-primary rounded-full font-semibold hover:bg-primary-foreground/90 transition-colors flex items-center justify-center gap-2"
            >
              Get Started Now
              <ArrowRight className="h-4 w-4" />
            </a>
            <a 
              href="#"
              className="px-8 py-3.5 border-2 border-primary-foreground text-primary-foreground rounded-full font-semibold hover:bg-primary-foreground/10 transition-colors"
            >
              Vote CirclePay ★
            </a>
          </div>
          <p className="text-sm text-primary-foreground/80">Built on Moolre. Part of the Startup Cup.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 px-4 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div>
              <Logo />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-4">Product</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#" className="hover:text-primary transition-colors">Home</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">How it works</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-4">Company</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-4">Legal</p>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center text-sm text-secondary">
            <p>© 2026 CirclePay. All rights reserved. Powered by Moolre.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
