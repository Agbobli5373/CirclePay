'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { OtpInput } from '@/components/otp-input'
import { PinInput } from '@/components/pin-input'
import { api, ApiError, type Network as ApiNetwork } from '@/lib/api'

type Mode = 'login' | 'register'
type Step = 'phone' | 'pin' | 'otp' | 'setpin'

const networks = ['MTN', 'Telecel', 'AirtelTigo'] as const
type Network = (typeof networks)[number]

const LAST_PHONE = 'cp:lastPhone'
const LAST_NAME = 'cp:lastName'

export default function OnboardingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('phone')
  const [busy, setBusy] = useState(false)

  const [network, setNetwork] = useState<Network>('MTN')
  const [phone, setPhone] = useState('')
  const [knownName, setKnownName] = useState<string | null>(null)

  // OTP
  const [otp, setOtp] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Register set-PIN
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create')
  const [pinError, setPinError] = useState(false)

  // Login PIN
  const [loginPin, setLoginPin] = useState('')
  const [loginError, setLoginError] = useState('')

  const fullPhone = `+233${phone.replace(/\D/g, '').slice(0, 9)}`
  const phoneValid = phone.replace(/\D/g, '').length >= 9

  // On mount, pick the mode from ?mode and (for login) prefill the remembered number.
  useEffect(() => {
    const m: Mode = new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login'
    setMode(m)
    if (m === 'login') {
      const last = (() => { try { return localStorage.getItem(LAST_PHONE) } catch { return null } })()
      if (last) {
        setPhone(last)
        setKnownName((() => { try { return localStorage.getItem(LAST_NAME) } catch { return null } })())
        setStep('pin')
      }
    }
  }, [])

  function rememberPhone() {
    try { localStorage.setItem(LAST_PHONE, phone.replace(/\D/g, '').slice(0, 9)) } catch {}
  }
  function rememberName(n?: string | null) {
    try { if (n) localStorage.setItem(LAST_NAME, n) } catch {}
  }
  function finishToDashboard(welcome = false) {
    rememberPhone()
    // Best-effort: cache the name for next time's greeting.
    api.auth.me().then((me) => rememberName(me.name)).catch(() => {})
    if (welcome) toast.success('Welcome back!')
    router.replace('/')
  }

  // ---------- actions ----------

  async function sendCode() {
    if (busy || !phoneValid) return
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

  async function verify() {
    if (busy || otp.length < 6) return
    setBusy(true)
    try {
      const { registered } = await api.auth.verifyOtp(fullPhone, otp)
      if (registered) {
        finishToDashboard(true)
      } else {
        // New number (incl. someone who tried "use a code" without an account) → create a PIN.
        setMode('register')
        setStep('setpin')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Invalid or expired code')
      setOtp('')
    } finally {
      setBusy(false)
    }
  }

  async function login(p: string) {
    if (busy) return
    setBusy(true)
    setLoginError('')
    try {
      await api.auth.login(fullPhone, p)
      finishToDashboard(false)
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0
      setLoginError(
        status === 423
          ? 'Too many attempts. Try again in about 15 minutes, or log in with a code.'
          : 'Incorrect PIN. Try again, or log in with a code.',
      )
      setLoginPin('')
      setBusy(false)
    }
  }

  async function submitPin(finalPin: string) {
    setBusy(true)
    try {
      await api.auth.setPin({ pin: finalPin, confirmPin: finalPin, network: network as ApiNetwork, name: name.trim() || undefined })
      rememberPhone()
      rememberName(name.trim() || undefined)
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

  // ---------- effects ----------

  useEffect(() => {
    if (step !== 'otp' || secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [step, secondsLeft])

  // Auto-submit OTP when all 6 digits are in.
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !busy) void verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step])

  // Auto-submit login PIN when complete.
  useEffect(() => {
    if (mode === 'login' && step === 'pin' && loginPin.length === 4 && !busy) void login(loginPin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginPin, step, mode])

  // Register set-PIN: create → confirm → submit, driven by committed values.
  const activePin = pinStage === 'create' ? pin : confirmPin
  const setActivePin = pinStage === 'create' ? setPin : setConfirmPin
  const handleSetPinChange = (v: string) => {
    if (pinError) setPinError(false)
    setActivePin(v)
  }
  useEffect(() => {
    if (step === 'setpin' && pinStage === 'create' && pin.length === 4) {
      const t = setTimeout(() => setPinStage('confirm'), 150)
      return () => clearTimeout(t)
    }
  }, [pin, pinStage, step])
  useEffect(() => {
    if (step !== 'setpin' || pinStage !== 'confirm' || confirmPin.length !== 4) return
    if (confirmPin === pin) void submitPin(confirmPin)
    else {
      setPinError(true)
      setConfirmPin('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, pinStage, step])

  // ---------- helpers ----------

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 9)
    return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ')
  }
  const timer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

  const dots = mode === 'register' || step === 'otp' || step === 'setpin' ? 3 : 2
  const idx = step === 'phone' ? 0 : step === 'pin' || step === 'otp' ? 1 : 2

  function switchMode(next: Mode) {
    setMode(next)
    setLoginError(''); setOtp(''); setPin(''); setConfirmPin(''); setLoginPin(''); setPinStage('create'); setPinError(false)
    setStep('phone')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-6 pb-2 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2" aria-label={`Step ${idx + 1} of ${dots}`}>
            {Array.from({ length: dots }).map((_, i) => (
              <span key={i} className={`h-2.5 rounded-full ${i === idx ? 'w-6 bg-primary' : i < idx ? 'w-2.5 bg-primary' : 'w-2.5 bg-muted'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="cp-card p-5 sm:p-6">

            {/* PHONE */}
            {step === 'phone' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground">
                    {mode === 'login' ? 'Log in to CirclePay' : 'Create your account'}
                  </h1>
                  <p className="text-sm text-secondary">
                    {mode === 'login' ? 'Enter your mobile money number.' : 'We’ll send a one-time code by SMS.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mobile money number</label>
                  <div className="flex items-center h-11 rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground border-r border-border pr-3 mr-3">
                      <span aria-hidden>🇬🇭</span> +233
                    </span>
                    <input
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={formatPhone(phone)}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="XX XXX XXXX"
                      className="flex-1 bg-transparent text-base text-foreground placeholder-secondary focus:outline-none tracking-wide"
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-secondary">Network</p>
                    <div className="flex gap-2">
                      {networks.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNetwork(n)}
                          className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${
                            network === n ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-foreground hover:border-primary/40'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => (mode === 'login' ? (setLoginError(''), setLoginPin(''), setStep('pin')) : sendCode())}
                  disabled={!phoneValid || busy}
                  className="cp-btn-primary w-full"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                </button>

                <p className="text-center text-sm text-secondary">
                  {mode === 'login' ? (
                    <>New to CirclePay? <button type="button" onClick={() => switchMode('register')} className="text-primary font-medium hover:underline">Create an account</button></>
                  ) : (
                    <>Already have an account? <button type="button" onClick={() => switchMode('login')} className="text-primary font-medium hover:underline">Log in</button></>
                  )}
                </p>
              </div>
            )}

            {/* LOGIN PIN */}
            {step === 'pin' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {knownName ? `Welcome back, ${knownName.split(/\s+/)[0]}` : 'Welcome back'}
                  </h1>
                  <p className="text-sm text-secondary">Enter your PIN for +233 {formatPhone(phone)}.</p>
                </div>

                <PinInput value={loginPin} onChange={(v) => { if (loginError) setLoginError(''); setLoginPin(v) }} autoFocus error={!!loginError} ariaLabel="PIN" />

                {loginError && <p className="text-center text-sm text-destructive">{loginError}</p>}

                <button
                  type="button"
                  onClick={() => login(loginPin)}
                  disabled={loginPin.length < 4 || busy}
                  className="cp-btn-primary w-full"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => sendCode()} disabled={busy} className="text-primary font-medium hover:underline disabled:opacity-50">
                    Forgot PIN? Use a code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginError(''); setLoginPin(''); setKnownName(null); setStep('phone') }}
                    className="text-secondary hover:text-foreground"
                  >
                    Use another number
                  </button>
                </div>
              </div>
            )}

            {/* OTP */}
            {step === 'otp' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground">Check your messages</h1>
                  <p className="text-sm text-secondary">We sent a 6-digit code to +233 {formatPhone(phone)}.</p>
                </div>

                <OtpInput value={otp} onChange={setOtp} length={6} autoFocus ariaLabel="One-time code" />

                <div className="flex items-center justify-between text-sm">
                  {secondsLeft > 0 ? (
                    <span className="text-secondary">Resend in {timer}</span>
                  ) : (
                    <button type="button" onClick={() => sendCode()} disabled={busy} className="text-primary font-medium hover:underline disabled:opacity-50">
                      Resend code
                    </button>
                  )}
                  <span className="text-secondary">Try USSD: <span className="font-medium text-foreground">*714#</span></span>
                </div>

                <button
                  type="button"
                  onClick={verify}
                  disabled={otp.length < 6 || busy}
                  className="cp-btn-primary w-full"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & continue'}
                </button>
              </div>
            )}

            {/* REGISTER SET-PIN */}
            {step === 'setpin' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {pinStage === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
                  </h1>
                  <p className="text-sm text-secondary">
                    {pinStage === 'create' ? 'Choose a 4-digit PIN to secure your account.' : 'Enter your PIN again to confirm.'}
                  </p>
                </div>

                {pinStage === 'create' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      What should we call you? <span className="text-secondary font-normal">(optional)</span>
                    </label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Asante" maxLength={80} className="cp-input" />
                  </div>
                )}

                <PinInput value={activePin} onChange={handleSetPinChange} autoFocus error={pinError} ariaLabel={pinStage === 'create' ? 'Create PIN' : 'Confirm PIN'} />

                {pinError && <p className="text-center text-sm text-destructive">PINs don&apos;t match. Try again.</p>}

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
