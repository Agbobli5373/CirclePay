'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Users, Heart, Sparkles, CheckCircle2, BadgeCheck, Share2, UserPlus, ArrowRight, ArrowLeft, Plus, X, Copy, Check, MessageCircle, Loader2 } from 'lucide-react'
import { toPesewas, toLocal9 } from '@circlepay/shared'
import { useCreateFund, useInvite, useCreateMedical } from '@/lib/queries'
import { ApiError, type Network } from '@/lib/api'

type FundType = 'Susu' | 'Medical'
type Frequency = 'Weekly' | 'Monthly'
type Payout = 'Rotating order' | 'Random draw' | 'Arrange myself'

function nextMonthValue() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CreateFundPage() {
  const [type, setType] = useState<FundType>('Susu')
  const [name, setName] = useState('')

  // Susu
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('Monthly')
  const [members, setMembers] = useState('')
  const [startMonth, setStartMonth] = useState(nextMonthValue())
  const [payout, setPayout] = useState<Payout>('Rotating order')
  const [requiresDeposit, setRequiresDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')

  // Medical
  const [goal, setGoal] = useState('')
  const [beneficiary, setBeneficiary] = useState('')
  const [hospital, setHospital] = useState('')
  const [story, setStory] = useState('')
  const [deadline, setDeadline] = useState('')
  const [shareable, setShareable] = useState(true)
  const [payoutRoute, setPayoutRoute] = useState<'hospital_momo' | 'hospital_bank' | 'individual_cash'>('hospital_bank')
  const [payeeName, setPayeeName] = useState('')
  const [payeeMomo, setPayeeMomo] = useState('')
  const [payeeNetwork, setPayeeNetwork] = useState<Network>('MTN')
  const [payeeBank, setPayeeBank] = useState('')
  const [firstCap, setFirstCap] = useState('')

  const [submitted, setSubmitted] = useState(false)
  const [createdFundId, setCreatedFundId] = useState<string | null>(null)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const router = useRouter()
  const createFund = useCreateFund()
  const createMedical = useCreateMedical()
  const invite = useInvite(createdFundId ?? '')

  // Invite flow (Susu) — invites store raw 9-digit numbers
  const [showInvite, setShowInvite] = useState(false)
  const [invitePhone, setInvitePhone] = useState('')
  const [invites, setInvites] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

  const susuHref = createdFundId ? `/funds/${createdFundId}` : '/funds'

  async function handleCreate() {
    if (!canSubmit) return
    if (!isSusu) {
      try {
        const res = await createMedical.mutateAsync({
          type: 'Medical',
          name,
          goal: toPesewas(goalNum),
          beneficiary,
          story,
          hospital: hospital || undefined,
          payoutRoute,
          payee: {
            name: payeeName,
            momo: payoutRoute === 'hospital_bank' ? undefined : `+233${payeeMomo}`,
            network: payoutRoute === 'hospital_bank' ? undefined : payeeNetwork,
            bank: payoutRoute === 'hospital_bank' ? payeeBank : undefined,
          },
          deadline: deadline ? new Date(`${deadline}T00:00:00Z`).toISOString() : undefined,
          shareable,
          firstTrancheCap:
            payoutRoute === 'individual_cash' && Number(firstCap) > 0 ? toPesewas(Number(firstCap)) : undefined,
        })
        setCreatedFundId(res.id)
        setCreatedSlug(res.slug)
        setSubmitted(true)
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Could not create fundraiser')
      }
      return
    }
    try {
      const startDate = new Date(`${startMonth}-01T00:00:00Z`).toISOString()
      const res = await createFund.mutateAsync({
        type: 'Susu',
        name,
        contribution: toPesewas(amountNum),
        frequency: frequency === 'Weekly' ? 'weekly' : 'monthly',
        memberCount: membersNum,
        startDate,
        payoutRule: payout === 'Random draw' ? 'random' : payout === 'Arrange myself' ? 'manual' : 'rotating',
        requiresDeposit,
        depositAmount: requiresDeposit ? toPesewas(depositNum) : 0,
      })
      setCreatedFundId(res.id)
      setSubmitted(true)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not create fund')
    }
  }

  async function sendInvites() {
    if (!createdFundId || invites.length === 0) return
    try {
      const res = await invite.mutateAsync(invites.map((d) => `+233${d}`))
      setSent(true)
      toast.success(`${res.invited} invite${res.invited === 1 ? '' : 's'} sent`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send invites')
    }
  }

  const isSusu = type === 'Susu'
  const amountNum = Number(amount)
  const membersNum = Number(members)
  const goalNum = Number(goal)
  const everyLabel = frequency === 'Weekly' ? 'week' : 'month'
  const periodLabel = frequency === 'Weekly' ? 'weeks' : 'months'
  const cyclePot = amountNum > 0 && membersNum > 0 ? amountNum * membersNum : 0
  const depositNum = Number(depositAmount)

  const payeeOk = payoutRoute === 'hospital_bank' ? payeeBank.trim().length > 0 : payeeMomo.replace(/\D/g, '').length >= 9
  const canSubmit = isSusu
    ? Boolean(name && amountNum > 0 && membersNum >= 2 && membersNum <= 50 && (!requiresDeposit || depositNum > 0))
    : Boolean(name && goalNum > 0 && beneficiary && story && payeeName && payeeOk)

  const inviteLink = `circlepay.app/join/${(name || 'fund').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
  const fmtPhone = (d: string) => `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 9)}`
  const addInvite = () => {
    if (invitePhone.length < 9) return
    setInvites((list) => (list.includes(invitePhone) ? list : [...list, invitePhone]))
    setInvitePhone('')
  }
  const copyLink = () => {
    try {
      navigator.clipboard.writeText(`https://${inviteLink}`)
    } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ---------- INVITE SCREEN (Susu) ----------
  if (submitted && isSusu && showInvite) {
    return (
      <AppShell currentPage="funds" title="Create a fund">
        <div className="max-w-md mx-auto pb-6">
          <div className="cp-card p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvite(false)}
                className="p-2 -ml-2 rounded-lg text-secondary hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Invite members</h1>
                <p className="text-sm text-secondary">to {name}</p>
              </div>
            </div>

            {sent ? (
              <div className="text-center space-y-4 py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Invites sent</p>
                  <p className="text-sm text-secondary mt-1">
                    {invites.length} {invites.length === 1 ? 'person' : 'people'} will get an SMS to join {name}.
                  </p>
                </div>
                <Link href={susuHref} className="cp-btn-primary w-full">
                  Go to fund
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => {
                    setSent(false)
                    setInvites([])
                  }}
                  className="cp-btn-ghost w-full"
                >
                  Invite more
                </button>
              </div>
            ) : (
              <>
                {/* Add by phone */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Add by MoMo number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center h-11 rounded-lg border border-border bg-card px-3 flex-1 min-w-0 focus-within:border-primary">
                      <span className="text-sm font-medium text-foreground border-r border-border pr-2 mr-2 whitespace-nowrap">
                        🇬🇭 +233
                      </span>
                      <input
                        inputMode="numeric"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(toLocal9(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addInvite()
                          }
                        }}
                        placeholder="XX XXX XXXX"
                        className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={addInvite}
                      disabled={invitePhone.length < 9}
                      className="h-11 px-4 rounded-lg bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-secondary transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Added list */}
                {invites.length > 0 && (
                  <div className="space-y-2">
                    {invites.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
                        <span className="text-sm text-foreground">+233 {fmtPhone(p)}</span>
                        <button
                          onClick={() => setInvites((list) => list.filter((_, idx) => idx !== i))}
                          className="p-1 text-secondary hover:text-destructive transition-colors"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Share link */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Or share an invite link</label>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3">
                    <span className="text-sm text-secondary truncate">{inviteLink}</span>
                    <button
                      onClick={copyLink}
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent('Join my Susu on CirclePay: https://' + inviteLink)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cp-btn-ghost"
                    >
                      <MessageCircle className="h-4 w-4 text-primary" />
                      WhatsApp
                    </a>
                    <a
                      href={`sms:?body=${encodeURIComponent('Join my Susu on CirclePay: https://' + inviteLink)}`}
                      className="cp-btn-ghost"
                    >
                      <MessageCircle className="h-4 w-4 text-primary" />
                      SMS
                    </a>
                  </div>
                </div>

                <button onClick={sendInvites} disabled={invites.length === 0 || invite.isPending} className="cp-btn-primary w-full">
                  {invite.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Send {invites.length > 0 ? invites.length : ''} invite{invites.length === 1 ? '' : 's'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </AppShell>
    )
  }

  // ---------- SUCCESS SCREEN ----------
  if (submitted) {
    return (
      <AppShell currentPage="funds" title="Create a fund">
        <div className="max-w-md mx-auto pb-6">
          <div className="cp-card p-5 sm:p-6 text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Fund created</h1>
              <p className="text-sm text-secondary mt-1">
                {isSusu
                  ? `${name} is ready. Invite your members to get the circle going.`
                  : `${name} is live. Share it so people can contribute.`}
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-muted/50 border border-border p-4 text-left text-sm space-y-2">
              {isSusu ? (
                <>
                  <SummaryRow label="Type" value="Susu · Rotating savings" />
                  <SummaryRow label="Contribution" value={`GHS ${amountNum.toLocaleString()} / ${everyLabel}`} />
                  <SummaryRow label="Members" value={`${membersNum}`} />
                  <SummaryRow label="Payout each cycle" value={`GHS ${cyclePot.toLocaleString()}`} />
                  <SummaryRow label="Payout rule" value={payout} />
                </>
              ) : (
                <>
                  <SummaryRow label="Type" value="Medical · Fundraiser" />
                  <SummaryRow label="Goal" value={`GHS ${goalNum.toLocaleString()}`} />
                  <SummaryRow label="Beneficiary" value={beneficiary} />
                  {hospital && <SummaryRow label="Hospital" value={hospital} />}
                  <SummaryRow label="Payout" value="Direct to verified hospital" />
                </>
              )}
            </div>

            <div className="space-y-2">
              {isSusu ? (
                <button onClick={() => setShowInvite(true)} className="cp-btn-primary w-full">
                  <UserPlus className="h-4 w-4" />
                  Invite members
                </button>
              ) : (
                <Link href={`/f/${createdSlug ?? ''}`} className="cp-btn-primary w-full">
                  <Share2 className="h-4 w-4" />
                  Share fund
                </Link>
              )}
              <Link
                href={isSusu ? susuHref : `/fundraisers/${createdFundId ?? ''}`}
                className="cp-btn-ghost w-full"
              >
                Go to fund
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/funds" className="block text-sm text-secondary hover:text-foreground pt-1">
                Back to all funds
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // ---------- FORM ----------
  return (
    <AppShell currentPage="funds" title="Create a fund">
      <div className="max-w-xl lg:max-w-5xl mx-auto space-y-6 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Let&apos;s set up your fund</h1>
          <p className="text-sm text-secondary">
            Fill in the details below, or{' '}
            <Link href="/advisor" className="text-primary font-medium hover:underline">
              ask the Advisor
            </Link>{' '}
            to do it for you.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start">
        <div className="space-y-6">
        <div className="cp-card p-5 sm:p-6 space-y-6">
          {/* Type toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">What kind of fund?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('Susu')}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  isSusu ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Susu</p>
                  <p className="text-xs text-secondary">Rotating savings</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('Medical')}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  !isSusu ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Medical</p>
                  <p className="text-xs text-secondary">Raise for a bill</p>
                </div>
              </button>
            </div>
          </div>

          {/* Name */}
          <Field label="Give it a name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSusu ? 'e.g. Kumasi Traders' : "e.g. Kofi's surgery"}
              maxLength={80}
              className="cp-input"
            />
          </Field>

          {isSusu ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contribution amount (GHS)">
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="500"
                    className="cp-input"
                  />
                </Field>

                <Field label="How many members?">
                  <input
                    inputMode="numeric"
                    value={members}
                    onChange={(e) => setMembers(e.target.value.replace(/\D/g, ''))}
                    placeholder="10"
                    className="cp-input"
                  />
                  <p className={`text-xs mt-1.5 ${members && (membersNum < 2 || membersNum > 50) ? 'text-destructive' : 'text-secondary'}`}>
                    {membersNum > 50 ? 'Maximum 50 members.' : members && membersNum < 2 ? 'A Susu needs at least 2 members.' : 'Between 2 and 50 — one payout per member.'}
                  </p>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="How often?">
                  <div className="grid grid-cols-2 gap-2">
                    {(['Weekly', 'Monthly'] as Frequency[]).map((f) => (
                      <Pill key={f} active={frequency === f} onClick={() => setFrequency(f)}>
                        {f}
                      </Pill>
                    ))}
                  </div>
                </Field>

                <Field label="When does it start?">
                  <input
                    type="month"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="cp-input"
                  />
                </Field>
              </div>

              <Field label="Payout rule">
                <div className="grid grid-cols-2 gap-2">
                  {(['Rotating order', 'Random draw', 'Arrange myself'] as Payout[]).map((p) => (
                    <Pill key={p} active={payout === p} onClick={() => setPayout(p)}>
                      {p}
                    </Pill>
                  ))}
                </div>
                {payout === 'Arrange myself' && (
                  <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                    You&apos;ll set who&apos;s paid in which cycle on the fund page once members join — and can reshuffle upcoming turns anytime before they&apos;re paid.
                  </p>
                )}
              </Field>

              <Field label="Security deposit">
                <div className="grid grid-cols-2 gap-2">
                  <Pill active={!requiresDeposit} onClick={() => setRequiresDeposit(false)}>Not required</Pill>
                  <Pill active={requiresDeposit} onClick={() => setRequiresDeposit(true)}>Require a deposit</Pill>
                </div>
                {requiresDeposit && (
                  <div className="mt-2 space-y-1.5">
                    <input
                      inputMode="numeric"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="Deposit per member (GHS), e.g. 200"
                      className="cp-input"
                    />
                    <p className="text-xs text-secondary leading-relaxed">
                      A buffer each member pays on joining. If someone misses a turn, their deposit covers that cycle so the payee is still paid in full.
                    </p>
                  </div>
                )}
              </Field>

              {/* Live summary */}
              {cyclePot > 0 && (
                <div className="rounded-xl bg-primary/5 p-4 text-sm text-foreground leading-relaxed lg:hidden">
                  Each cycle, one member receives{' '}
                  <span className="font-semibold text-primary">GHS {cyclePot.toLocaleString()}</span>.{' '}
                  {membersNum} members × GHS {amountNum.toLocaleString()}/{everyLabel} · the circle runs about{' '}
                  {membersNum} {periodLabel}.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fundraising goal (GHS)">
                  <input
                    inputMode="numeric"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value.replace(/\D/g, ''))}
                    placeholder="5000"
                    className="cp-input"
                  />
                </Field>

                <Field label="By when? (optional)">
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="cp-input"
                  />
                </Field>
              </div>

              <Field label="Who is it for?">
                <input
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="e.g. My mother"
                  className="cp-input"
                />
              </Field>

              <Field label="Hospital (optional)">
                <input
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="e.g. Korle Bu Teaching Hospital"
                  className="cp-input"
                />
                <p className="text-xs text-secondary mt-1.5 flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  We&apos;ll verify this hospital before any payout.
                </p>
              </Field>

              <Field label="Tell the story">
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Why are you raising money? Share what's happening and how it will help."
                  className="cp-textarea"
                />
              </Field>

              {/* Shareable toggle */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Create a public shareable link</p>
                  <p className="text-xs text-secondary">Anyone with the link can contribute.</p>
                </div>
                <Toggle on={shareable} onClick={() => setShareable((v) => !v)} label="Shareable link" />
              </div>

              {/* Payout route — money goes straight to the verified payee, never the organizer */}
              <Field label="Where do funds go?">
                <div className="grid gap-2">
                  <Pill active={payoutRoute === 'hospital_bank'} onClick={() => setPayoutRoute('hospital_bank')}>Hospital bank account</Pill>
                  <Pill active={payoutRoute === 'hospital_momo'} onClick={() => setPayoutRoute('hospital_momo')}>Hospital MoMo</Pill>
                  <Pill active={payoutRoute === 'individual_cash'} onClick={() => setPayoutRoute('individual_cash')}>A person&apos;s MoMo (family or you)</Pill>
                </div>
                <p className="text-xs text-secondary mt-1.5 flex items-start gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  {payoutRoute === 'individual_cash'
                    ? 'Goes to the MoMo number you enter. Funds release in steps — after the first, add a receipt (a bill/receipt link) and have it verified to release more.'
                    : 'Ops verifies the payee before any payout. CirclePay never holds the money.'}
                </p>
              </Field>

              {payoutRoute === 'individual_cash' && (
                <Field label="Cap the first release (optional)">
                  <div className="flex items-center h-11 rounded-lg border border-border bg-card px-3 focus-within:border-primary">
                    <span className="text-sm font-medium text-foreground border-r border-border pr-2 mr-2">GHS</span>
                    <input
                      inputMode="numeric"
                      value={firstCap}
                      onChange={(e) => setFirstCap(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="e.g. 300"
                      className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-secondary mt-1.5">
                    Limits the first payout so funds move in steps. Leave blank to allow releasing the full balance.
                  </p>
                </Field>
              )}

              <Field label="Payee name">
                <input
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder={payoutRoute === 'hospital_bank' ? 'e.g. Korle Bu Teaching Hospital' : payoutRoute === 'individual_cash' ? 'e.g. Ama Mensah (sister)' : 'e.g. Korle Bu MoMo merchant'}
                  className="cp-input"
                />
              </Field>

              {payoutRoute === 'hospital_bank' ? (
                <Field label="Hospital bank account">
                  <input
                    value={payeeBank}
                    onChange={(e) => setPayeeBank(e.target.value)}
                    placeholder="Account number"
                    className="cp-input"
                  />
                </Field>
              ) : (
                <Field label={payoutRoute === 'individual_cash' ? "Person's MoMo number" : 'Hospital MoMo number'}>
                  <div className="flex items-center h-11 rounded-lg border border-border bg-card px-3 focus-within:border-primary">
                    <span className="text-sm font-medium text-foreground border-r border-border pr-2 mr-2 whitespace-nowrap">🇬🇭 +233</span>
                    <input
                      inputMode="numeric"
                      value={payeeMomo}
                      onChange={(e) => setPayeeMomo(toLocal9(e.target.value))}
                      placeholder="XX XXX XXXX"
                      className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {(['MTN', 'Telecel', 'AirtelTigo'] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPayeeNetwork(n)}
                        className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
                          payeeNetwork === n
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-secondary hover:text-foreground hover:border-primary/40'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {/* Live summary */}
              {goalNum > 0 && beneficiary && (
                <div className="rounded-xl bg-primary/5 p-4 text-sm text-foreground leading-relaxed lg:hidden">
                  Raising <span className="font-semibold text-primary">GHS {goalNum.toLocaleString()}</span> for{' '}
                  {beneficiary}
                  {hospital ? ` at ${hospital}` : ''}. Funds go straight to the hospital — CirclePay never holds the money.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Link href="/funds" className="cp-btn-ghost flex-1">
            Cancel
          </Link>
          <button
            type="button"
            disabled={!canSubmit || createFund.isPending || createMedical.isPending}
            onClick={handleCreate}
            className="cp-btn-primary flex-1"
          >
            {createFund.isPending || createMedical.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create fund
              </>
            )}
          </button>
        </div>
        </div>{/* /left column */}

        {/* Live preview — desktop only; fills the space and mirrors what they're building */}
        <aside className="hidden lg:block lg:sticky lg:top-24">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Preview</p>
          {isSusu ? (
            <div className="cp-card p-5 space-y-4">
              <span className="inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 bg-primary/15 text-primary">Susu</span>
              <p className="text-base font-bold text-foreground">{name.trim() || 'Your circle'}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <PreviewStat label="Per cycle" value={amountNum > 0 ? `GHS ${amountNum.toLocaleString()}/${everyLabel}` : '—'} />
                <PreviewStat label="Members" value={membersNum > 0 ? String(membersNum) : '—'} />
                <PreviewStat label="Pot each cycle" value={cyclePot > 0 ? `GHS ${cyclePot.toLocaleString()}` : '—'} accent />
                <PreviewStat label="Payout" value={payout} />
                {requiresDeposit && (
                  <PreviewStat label="Deposit" value={depositNum > 0 ? `GHS ${depositNum.toLocaleString()}` : '—'} />
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed border-t border-border/60 pt-3">
                Invite members after you create — the circle starts automatically once it fills.
              </p>
            </div>
          ) : (
            <div className="cp-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 bg-destructive/10 text-destructive">Medical</span>
                <span className="inline-flex items-center rounded-full text-xs font-medium px-2.5 py-1 bg-muted text-secondary">Pending verification</span>
              </div>
              <div>
                <p className="text-base font-bold text-foreground">{name.trim() || 'Your fundraiser'}</p>
                <p className="text-xs text-secondary mt-0.5">
                  {beneficiary.trim() ? `For ${beneficiary.trim()}` : 'Who is it for?'}
                  {hospital.trim() ? ` · ${hospital.trim()}` : ''}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-secondary">Raised</span>
                  <span className="font-semibold text-primary">0%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <p className="text-xs text-secondary tabular-nums">GHS 0 of GHS {goalNum > 0 ? goalNum.toLocaleString() : '—'}</p>
              </div>
              <p className="text-xs text-secondary leading-relaxed border-t border-border/60 pt-3 flex items-start gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                Funds go straight to the verified payee. CirclePay never holds the money. Powered by Moolre.
              </p>
            </div>
          )}
        </aside>
        </div>{/* /grid */}
      </div>
    </AppShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

function PreviewStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-secondary">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:border-primary/40'
      }`}
    >
      {children}
    </button>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-primary' : 'bg-muted'}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      />
    </button>
  )
}
