import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, ClipboardList, IndianRupee, Video } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthModal } from '../components/auth/AuthModal.tsx'
import { EmailOtpInputs } from '../components/auth/EmailOtpInputs.tsx'
import { GoogleContinueButton } from '../components/auth/GoogleContinueButton.tsx'
import { Button } from '../components/ui/Button.tsx'
import { DetectedTimezoneNote } from '../components/ui/TimezoneSelect.tsx'
import { Card, FieldLabel, PasswordInput, TextInput } from '../components/ui/primitives.tsx'
import { isInPasswordRecoveryFlow, isAuthRecoveryUrl, redirectToPasswordRecovery } from '../lib/authRecovery.ts'
import { landingPathForAccount } from '../lib/interviewWelcome.ts'
import { INTERVIEWER_SETUP, defaultHomePath, safeNextPath } from '../lib/nextPath.ts'
import { detectBrowserTimezone } from '../lib/timezones.ts'
import {
  authErrorMessage,
  isUnconfirmedEmailError,
  maskEmailAddress,
  oauthRedirectErrorMessage,
  parseAuthRateLimitSeconds,
  resendSignupEmail,
  sendEmailSignInCode,
  sendPasswordReset,
  signInInterviewer,
  signUpInterviewer,
  verifyEmailSignInCode,
} from '../services/auth.ts'
import { applySignupProfile } from '../services/interviewerProfile.ts'
import { useSession } from '../state/session.tsx'

type LoginStep = 'email' | 'code' | 'forgot'

export function AuthPage({ mode, defaultNextPath }: { mode: 'login' | 'register'; defaultNextPath?: string }) {
  const { status, user, profile, account, error: sessionError, refreshAccount } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [passwordRecovery, setPasswordRecovery] = useState(() => isAuthRecoveryUrl())
  const openParam = params.get('open')
  const accountDeleted = params.get('accountDeleted') === '1'
  const modalOpen =
    openParam === 'signin' ||
    openParam === 'login' ||
    openParam === 'register' ||
    openParam === 'signup' ||
    accountDeleted
  const isRegister =
    openParam === 'register' || openParam === 'signup' || (mode === 'register' && modalOpen)
  const nextPath = safeNextPath(
    params.get('next'),
    defaultNextPath ?? (isRegister ? INTERVIEWER_SETUP : defaultHomePath(profile?.role)),
  )
  const [loginStep, setLoginStep] = useState<LoginStep>('email')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [company, setCompany] = useState('')
  const [currentRole, setCurrentRole] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetWait, setResetWait] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const timezone = useMemo(() => detectBrowserTimezone(), [])

  function openAuth(kind: 'signin' | 'register') {
    const next = new URLSearchParams(params)
    next.set('open', kind === 'signin' ? 'signin' : 'register')
    setLoginStep('email')
    setError(null)
    setInfo(null)
    navigate(kind === 'signin' ? `/interviewer/login?${next}` : `/interviewer/register?${next}`)
  }

  function closeAuth() {
    const next = new URLSearchParams(params)
    next.delete('open')
    next.delete('accountDeleted')
    const query = next.toString()
    navigate(query ? `/interviewer/login?${query}` : '/interviewer/login', { replace: true })
    setLoginStep('email')
    setError(null)
    setInfo(null)
  }

  useEffect(() => {
    if (!isInPasswordRecoveryFlow()) return
    setPasswordRecovery(true)
    if (!location.pathname.endsWith('/interviewer/reset-password')) {
      redirectToPasswordRecovery()
    }
  }, [location.pathname, location.search, location.hash])

  if (isInPasswordRecoveryFlow() || passwordRecovery) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card className="p-6 sm:p-8 text-center">
          <h1 className="text-xl font-semibold text-navy-950">Opening password reset…</h1>
          <p className="mt-2 text-sm text-slate-600">One moment while we load the reset form.</p>
        </Card>
      </div>
    )
  }

  if (status === 'authenticated' && user && (account || profile?.role === 'admin')) {
    return <Navigate to={landingPathForAccount(profile?.role, account, nextPath)} replace />
  }

  if (status === 'authenticated' && user && !sessionError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-navy-950">Signing you in…</h1>
          <p className="mt-1 text-sm text-slate-600">Loading your account.</p>
        </Card>
      </div>
    )
  }

  const busy = submitting || emailBusy || resending || resettingPassword || status === 'loading'
  const showResend = awaitingConfirmation || isUnconfirmedEmailError(error)
  const redirectError = oauthRedirectErrorMessage(params)

  function startResetWait(seconds: number) {
    setResetWait(seconds)
    const started = Date.now()
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.ceil((Date.now() - started) / 1000))
      setResetWait(remaining)
      if (remaining <= 0) window.clearInterval(timer)
    }, 1000)
  }

  async function sendCode(targetEmail = email) {
    setError(null)
    setInfo(null)
    if (!targetEmail.trim()) {
      setError('Enter your email first.')
      return false
    }
    setEmailBusy(true)
    try {
      await sendEmailSignInCode(targetEmail)
      setOtpCode('')
      setLoginStep('code')
      setInfo('We sent a 6-digit code to your email. Check inbox and spam.')
      startResetWait(60)
      return true
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : ''
      const wait = parseAuthRateLimitSeconds(raw)
      if (wait) startResetWait(wait)
      setError(authErrorMessage(caught))
      return false
    } finally {
      setEmailBusy(false)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await verifyEmailSignInCode(email, otpCode)
      await refreshAccount()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await signInInterviewer({ email, password })
      await refreshAccount()
    } catch (caught) {
      const message = authErrorMessage(caught)
      setError(message)
      if (isUnconfirmedEmailError(caught)) setAwaitingConfirmation(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitRegister(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.')
      }
      const years = Number(experienceYears)
      if (!Number.isFinite(years) || years < 0) {
        throw new Error('Enter years of experience as a number.')
      }
      const result = await signUpInterviewer({
        firstName,
        lastName,
        email,
        password,
        phone,
        timezone,
        currentRole,
        company,
        experienceYears: years,
      })
      if (result.needsEmailConfirmation) {
        setAwaitingConfirmation(true)
        setInfo(
          `We sent a confirmation link to ${email.trim()}. Open it to finish creating your interviewer account at experts.jobround.ai, then continue setup. Check spam if you do not see it within a few minutes.`,
        )
        return
      }
      await applySignupProfile({
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        timezone,
        currentRole,
        company,
        experienceYears: years,
        phone,
        headline: currentRole.trim(),
      })
      await refreshAccount()
    } catch (caught) {
      const message = authErrorMessage(caught)
      setError(message)
      if (isUnconfirmedEmailError(caught)) setAwaitingConfirmation(true)
    } finally {
      setSubmitting(false)
    }
  }

  function openForgotPassword() {
    setError(null)
    setInfo(null)
    setLoginStep('forgot')
  }

  async function forgotPassword(event?: FormEvent) {
    event?.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('Enter your email to receive a reset link.')
      return
    }
    setResettingPassword(true)
    try {
      await sendPasswordReset(email)
      setInfo('If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.')
      startResetWait(60)
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : ''
      const wait = parseAuthRateLimitSeconds(raw)
      if (wait) startResetWait(wait)
      setError(authErrorMessage(caught))
    } finally {
      setResettingPassword(false)
    }
  }

  async function resendConfirmation() {
    setError(null)
    setInfo(null)
    setResending(true)
    try {
      await resendSignupEmail(email)
      setAwaitingConfirmation(true)
      setInfo('We sent a new confirmation link. Check your inbox and spam folder.')
      startResetWait(60)
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : ''
      const wait = parseAuthRateLimitSeconds(raw)
      if (wait) startResetWait(wait)
      setError(authErrorMessage(caught))
    } finally {
      setResending(false)
    }
  }

  function googleBlock(placement: 'above' | 'below' = 'below') {
    const divider = (
      <div className={placement === 'above' ? 'mb-4 mt-1 flex items-center gap-3' : 'my-4 flex items-center gap-3'} aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    )
    return (
      <>
        {placement === 'below' ? divider : null}
        <GoogleContinueButton
          disabled={busy}
          nextPath={nextPath}
          onError={(message) => {
            setInfo(null)
            setError(message)
          }}
        />
        {placement === 'above' ? divider : null}
      </>
    )
  }

  function modeLinks() {
    return (
      <p className="mt-6 text-center text-sm text-slate-600">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <button type="button" className="font-medium text-coral-700 hover:underline" onClick={() => openAuth('signin')}>
              Sign in
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="font-medium text-coral-700 hover:underline"
              onClick={() => openAuth('register')}
            >
              Create Interviewer Account
            </button>
          </>
        )}
      </p>
    )
  }

  function loginForm() {
    if (loginStep === 'forgot') {
      return (
        <div>
          <form className="space-y-4" onSubmit={(event) => void forgotPassword(event)}>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">Reset your password</h2>
              <p className="mt-2 text-sm text-slate-600">
                Enter your email and we&apos;ll send a link to choose a new password.
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
              <TextInput
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error || sessionError || redirectError ? (
              <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
            ) : null}
            {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
            <Button type="submit" fullWidth disabled={busy || resetWait > 0}>
              {resettingPassword ? 'Sending…' : resetWait > 0 ? `Wait ${resetWait}s` : 'Send reset link'}
            </Button>
          </form>
          <p className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-semibold text-navy-950 hover:underline"
              onClick={() => {
                setLoginStep('email')
                setError(null)
                setInfo(null)
              }}
            >
              Back to sign in
            </button>
          </p>
          {modeLinks()}
        </div>
      )
    }

    if (loginStep === 'code') {
      return (
        <div>
          <form className="space-y-4" onSubmit={(event) => void verifyCode(event)}>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">
                Enter the code we sent to {maskEmailAddress(email)}
              </h2>
              <p className="mt-2 text-sm text-slate-600">Use the 6-digit code from your email. It expires after a few minutes.</p>
            </div>
            <EmailOtpInputs
              idPrefix="interviewer-otp"
              value={otpCode}
              disabled={busy}
              onChange={(next) => {
                setOtpCode(next)
                setError(null)
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={busy || resetWait > 0}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-navy-950 hover:bg-slate-50 disabled:text-slate-400"
              >
                {resetWait > 0 ? `Resend in ${resetWait}s` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginStep('email')
                  setOtpCode('')
                  setError(null)
                  setInfo(null)
                }}
                className="text-sm font-medium text-coral-700 hover:underline"
              >
                Use a different email
              </button>
            </div>
            {error || sessionError || redirectError ? (
              <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
            ) : null}
            {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
            <Button type="submit" fullWidth disabled={busy || otpCode.length !== 6}>
              {submitting ? 'Checking…' : 'Next'}
            </Button>
          </form>
          <p className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-semibold text-navy-950 hover:underline"
              onClick={() => {
                setLoginStep('email')
                setOtpCode('')
                setError(null)
                setInfo(null)
              }}
            >
              Sign in with a password
            </button>
          </p>
          {googleBlock()}
          {modeLinks()}
        </div>
      )
    }

    return (
      <div>
        {googleBlock('above')}
        <form className="space-y-3" onSubmit={(event) => void submitPassword(event)}>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                className="text-xs font-medium text-coral-700 hover:underline"
                onClick={openForgotPassword}
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput
              id="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error || sessionError || redirectError ? (
            <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
          ) : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          {showResend ? (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={busy || resetWait > 0}
              className="text-sm font-medium text-coral-700 hover:underline disabled:text-slate-400"
            >
              {resetWait > 0 ? `Resend available in ${resetWait}s` : 'Resend confirmation email'}
            </button>
          ) : null}
          <Button type="submit" fullWidth disabled={busy}>
            {submitting ? 'Please wait…' : 'Sign In'}
          </Button>
        </form>
        <p className="mt-3 text-center">
          <button
            type="button"
            className="text-sm font-medium text-navy-950 hover:underline"
            onClick={() => void sendCode()}
            disabled={busy || resetWait > 0}
          >
            {resetWait > 0 ? `Send code in ${resetWait}s` : 'Sign in with a code'}
          </button>
        </p>
        {modeLinks()}
      </div>
    )
  }

  function registerForm() {
    return (
      <div>
        <form className="space-y-4" onSubmit={(event) => void submitRegister(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="firstName">First name</FieldLabel>
              <TextInput
                id="firstName"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="lastName">Last name</FieldLabel>
              <TextInput
                id="lastName"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone (optional)</FieldLabel>
            <TextInput
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <DetectedTimezoneNote timezone={timezone} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="company">Current company</FieldLabel>
              <TextInput
                id="company"
                required
                autoComplete="organization"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="currentRole">Current role</FieldLabel>
              <TextInput
                id="currentRole"
                required
                autoComplete="organization-title"
                value={currentRole}
                onChange={(event) => setCurrentRole(event.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="experienceYears">Years of experience</FieldLabel>
            <TextInput
              id="experienceYears"
              type="number"
              required
              min={0}
              max={60}
              step={1}
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
            />
          </div>
          {error || sessionError || redirectError ? (
            <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
          ) : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          {showResend ? (
            <Button type="button" variant="outline" fullWidth disabled={busy} onClick={() => void resendConfirmation()}>
              {resending ? 'Sending link…' : 'Resend confirmation email'}
            </Button>
          ) : null}
          <Button type="submit" fullWidth disabled={busy}>
            {submitting ? 'Please wait…' : 'Create account'}
          </Button>
        </form>
        {googleBlock()}
        {modeLinks()}
      </div>
    )
  }

  const featureCards = [
    {
      title: 'Live interviews',
      body: 'Join sessions, keep notes, and stay on schedule without juggling tools.',
      icon: Video,
      delay: '40ms',
    },
    {
      title: 'Bookings & calendar',
      body: 'Accept requests, set availability, and manage services in one workspace.',
      icon: CalendarDays,
      delay: '120ms',
    },
    {
      title: 'Feedback loop',
      body: 'Share structured feedback candidates can actually use to improve.',
      icon: ClipboardList,
      delay: '200ms',
    },
    {
      title: 'Earnings clarity',
      body: 'Track completed sessions and fees without a separate admin console.',
      icon: IndianRupee,
      delay: '280ms',
    },
  ] as const

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <section className="studio-ink experts-fade relative overflow-hidden rounded-[1.75rem] border border-navy-950/8 px-6 py-10 text-navy-950 shadow-[0_18px_44px_-30px_rgba(7,16,31,0.28)] sm:px-10 sm:py-14">
          <div
            aria-hidden
            className="experts-orb pointer-events-none absolute -right-10 -top-8 h-48 w-48 rounded-full bg-coral-500/18 blur-2xl"
          />
          <div
            aria-hidden
            className="experts-orb pointer-events-none absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-gold-400/18 blur-2xl [animation-delay:1.2s]"
          />
          <p className="text-4xl font-semibold tracking-tight sm:text-5xl">jobround.ai</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral-700">Interviewer workspace</p>
          <h1 className="mt-8 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Candidates practice. You bring the hiring-side eye.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            A professional workspace for live mocks, bookings, availability, and feedback — built for working
            interviewers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => openAuth('signin')}>
              Sign in
            </Button>
            <Button size="lg" variant="outline" onClick={() => openAuth('register')}>
              Join as interviewer
            </Button>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Staff operations:{' '}
            <Link to="/admin/login" className="font-medium text-coral-700 hover:underline">
              Admin sign in
            </Link>
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => (
            <div key={card.title} className="experts-card" style={{ animationDelay: card.delay }}>
              <Card className="h-full border-white/80 bg-white/95 p-5 shadow-[0_18px_44px_-30px_rgba(7,16,31,0.35)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-50 text-coral-700">
                  <card.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-navy-950">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
              </Card>
            </div>
          ))}
        </section>
      </div>

      <AuthModal
        open={modalOpen}
        wide={isRegister}
        title={isRegister ? 'Create your interviewer account' : 'Welcome back'}
        subtitle={
          isRegister
            ? 'Already a candidate on jobround.ai? Use that email — we’ll add your interviewer profile.'
            : 'Use email code, password, or Google. The form stays private until you open it.'
        }
        onClose={closeAuth}
      >
        {accountDeleted ? (
          <div
            className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            role="status"
          >
            <p className="font-semibold">Your interviewer account has been deleted</p>
            <p className="mt-1 text-emerald-900">
              You can create a new interviewer account with the same email anytime. A candidate
              account on this email is unchanged.
            </p>
          </div>
        ) : null}
        {isRegister ? registerForm() : loginForm()}
      </AuthModal>
    </>
  )
}
