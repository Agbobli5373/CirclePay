'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, ArrowRight, Delete, Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { api, ApiError, type Network as ApiNetwork } from '@/lib/api'

type Step = 'phone' | 'otp' | 'pin'

const networks = ['MTN', 'Telecel', 'AirtelTigo'] as const
type Network = (typeof networks)[number]

function NumericKeypad({
  onPress,
  onDelete,
}: {
  onPress: (digit: string) => void
  onDelete: () => void
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onPress(k)}
          className="h-14 rounded-xl bg-card border border-border text-xl font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {k}
        </button>
      ))}
      <div />
      <button
        type="button"
        onClick={() => onPress('0')}
        className="h-14 rounded-xl bg-card border border-border text-xl font-semibold text-foreground hover:bg-muted transition-colors"
      >
        0
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="h-14 rounded-xl text-foreground hover:bg-muted transition-colors flex items-center justify-center"
        aria-label="Delete"
      >
        <Delete className="h-5 w-5" />
      </button>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [busy, setBusy] = useState(false)

  // Step 1 — phone
  const [network, setNetwork] = useState<Network>('MTN')
  const [phone, setPhone] = useState('')

  // Step 2 — OTP
  const [otp, setOtp] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(272) // 4:32

  // Step 3 — PIN
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create')
  const [pinError, setPinError] = useState(false)

  const stepIndex = step === 'phone' ? 0 : step === 'otp' ? 1 : 2
  const fullPhone = `+233${phone.replace(/\D/g, '').slice(0, 9)}`

  async function handleSendCode() {
    if (busy) return
    setBusy(true)
    try {
      const res = await api.auth.requestOtp(fullPhone, network as ApiNetwork)
      setOtp('')
      setSecondsLeft(272)
      setStep('otp')
      if (res.devCode) toast.info(`Dev code: ${res.devCode}`, { duration: 60_000 })
      else toast.success('Code sent by SMS')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send code')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify() {
    if (busy || otp.length < 6) return
    setBusy(true)
    try {
      const { registered } = await api.auth.verifyOtp(fullPhone, otp)
      if (registered) {
        toast.success('Welcome back!')
        router.replace('/')
      } else {
        setStep('pin')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Invalid or expired code')
      setOtp('')
    } finally {
      setBusy(false)
    }
  }

  async function submitPin(finalPin: string) {
    setBusy(true)
    try {
      await api.auth.setPin({ pin: finalPin, confirmPin: finalPin, network: network as ApiNetwork })
      toast.success('Account created')
      router.replace('/')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not set PIN')
      setPin('')
      setConfirmPin('')
      setPinStage('create')
      setBusy(false)
    }
  }

  useEffect(() => {
    if (step !== 'otp' || secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [step, secondsLeft])

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 9)
    const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean)
    return parts.join(' ')
  }

  const timer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

  const handleOtpPress = (digit: string) => {
    setOtp((prev) => (prev.length < 6 ? prev + digit : prev))
  }

  const activePin = pinStage === 'create' ? pin : confirmPin
  const setActivePin = pinStage === 'create' ? setPin : setConfirmPin

  // Append with a functional updater so rapid presses accumulate correctly.
  const handlePinPress = (digit: string) => {
    if (pinError) setPinError(false)
    setActivePin((prev) => (prev.length < 4 ? prev + digit : prev))
  }

  // Stage transitions are driven by the committed PIN values (robust to input speed).
  useEffect(() => {
    if (pinStage === 'create' && pin.length === 4) {
      const t = setTimeout(() => setPinStage('confirm'), 150)
      return () => clearTimeout(t)
    }
  }, [pin, pinStage])

  useEffect(() => {
    if (pinStage !== 'confirm' || confirmPin.length !== 4) return
    if (confirmPin === pin) {
      void submitPin(confirmPin)
    } else {
      setPinError(true)
      setConfirmPin('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, pinStage])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top: logo + 3-dot progress */}
      <div className="px-4 pt-6 pb-2 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2" aria-label={`Step ${stepIndex + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2.5 rounded-full ${
                  i === stepIndex ? 'w-6 bg-primary' : i < stepIndex ? 'w-2.5 bg-primary' : 'w-2.5 bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="cp-card p-6 sm:p-8">
            {/* STEP 1 — PHONE */}
            {step === 'phone' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground">Enter your phone number</h1>
                  <p className="text-sm text-secondary">We&apos;ll send a one-time code by SMS.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mobile money number</label>
                  <div className="flex items-center h-12 rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground border-r border-border pr-3 mr-3">
                      <span aria-hidden>🇬🇭</span> +233
                    </span>
                    <input
                      inputMode="numeric"
                      value={formatPhone(phone)}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="XX XXX XXXX"
                      className="flex-1 bg-transparent text-base text-foreground placeholder-secondary focus:outline-none tracking-wide"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-secondary">Network</p>
                  <div className="flex gap-2">
                    {networks.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNetwork(n)}
                        className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${
                          network === n
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border border-border text-foreground hover:border-primary/40'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-secondary leading-relaxed">
                  We link to your Ghana Card-verified MoMo number.
                </p>

                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={phone.replace(/\D/g, '').length < 9 || busy}
                  className="w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:bg-muted disabled:text-secondary transition-colors flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send code <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            )}

            {/* STEP 2 — OTP */}
            {step === 'otp' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground">Check your messages</h1>
                  <p className="text-sm text-secondary">
                    We sent a 6-digit code to +233 {formatPhone(phone)}.
                  </p>
                </div>

                <div className="flex justify-between gap-2">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const isActive = i === otp.length
                    return (
                      <div
                        key={i}
                        className={`flex-1 aspect-square max-w-[52px] rounded-xl border flex items-center justify-center text-xl font-semibold text-foreground ${
                          isActive ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                        } bg-background`}
                      >
                        {otp[i] ?? ''}
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between text-sm">
                  {secondsLeft > 0 ? (
                    <span className="text-secondary">Resend in {timer}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={busy}
                      className="text-primary font-medium hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  )}
                  <span className="text-secondary">
                    Try USSD: <span className="font-medium text-foreground">*714#</span>
                  </span>
                </div>

                <div className="sm:max-w-[280px] sm:mx-auto">
                  <NumericKeypad
                    onPress={handleOtpPress}
                    onDelete={() => setOtp((p) => p.slice(0, -1))}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={otp.length < 6 || busy}
                  className="w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:bg-muted disabled:text-secondary transition-colors flex items-center justify-center"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & continue'}
                </button>
              </div>
            )}

            {/* STEP 3 — PIN */}
            {step === 'pin' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {pinStage === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
                  </h1>
                  <p className="text-sm text-secondary">
                    {pinStage === 'create'
                      ? 'Choose a 4-digit PIN to secure your account.'
                      : 'Enter your PIN again to confirm.'}
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const filled = i < activePin.length
                    return (
                      <div
                        key={i}
                        className={`h-5 w-5 rounded-full border-2 transition-colors ${
                          pinError
                            ? 'border-destructive bg-destructive'
                            : filled
                            ? 'border-primary bg-primary'
                            : 'border-border bg-transparent'
                        }`}
                      />
                    )
                  })}
                </div>

                {pinError && (
                  <p className="text-center text-sm text-destructive">PINs don&apos;t match. Try again.</p>
                )}

                <div className="sm:max-w-[280px] sm:mx-auto">
                  <NumericKeypad
                    onPress={handlePinPress}
                    onDelete={() => {
                      if (pinError) setPinError(false)
                      setActivePin((prev) => prev.slice(0, -1))
                    }}
                  />
                </div>

                <p className="text-xs text-secondary text-center leading-relaxed bg-primary/5 rounded-lg p-3">
                  CirclePay never holds your savings and will never ask for your PIN by call or SMS.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
