import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { EmailOtpInputs } from '../components/auth/EmailOtpInputs.tsx'
import { GoogleContinueButton } from '../components/auth/GoogleContinueButton.tsx'
import { Button } from '../components/ui/Button.tsx'
import { DetectedTimezoneNote } from '../components/ui/TimezoneSelect.tsx'
import { Card, FieldLabel, PageHeader, PasswordInput, TextInput } from '../components/ui/primitives.tsx'
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

type LoginStep = 'email' | 'code' | 'password'

export function AuthPage({ mode, defaultNextPath }: { mode: 'login' | 'register'; defaultNextPath?: string }) {
  const { status, user, profile, account, error: sessionError, refreshAccount } = useSession()
  const location = useLocation()
  const [params] = useSearchParams()
  const [passwordRecovery, setPasswordRecovery] = useState(() => isAuthRecoveryUrl())
  const isRegister = mode === 'register'
  const nextPath = safeNextPath(
    params.get('next'),
    defaultNextPath ?? (isRegister ? INTERVIEWER_SETUP : defaultHomePath(profile?.role)),
  )
  const nextQuery = `?next=${encodeURIComponent(nextPath)}`
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

  async function continueWithEmail(event: FormEvent) {
    event.preventDefault()
    await sendCode()
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

  async function forgotPassword() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('Enter your email above first, then choose “Forgot password?”.')
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

  function googleBlock() {
    return (
      <>
        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <GoogleContinueButton
          disabled={busy}
          onError={(message) => {
            setInfo(null)
            setError(message)
          }}
        />
      </>
    )
  }

  function modeLinks() {
    return (
      <p className="mt-6 text-center text-sm text-slate-600">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <Link className="font-medium text-coral-700" to={`/interviewer/login${nextQuery}`}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <Link className="font-medium text-coral-700" to={`/interviewer/register${nextQuery}`}>
              Create Interviewer Account
            </Link>
          </>
        )}
      </p>
    )
  }

  function loginForm() {
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
                setLoginStep('password')
                setError(null)
                setInfo(null)
              }}
            >
              Log in with a password
            </button>
          </p>
          {googleBlock()}
          {modeLinks()}
        </div>
      )
    }

    if (loginStep === 'password') {
      return (
        <div>
          <form className="space-y-4" onSubmit={(event) => void submitPassword(event)}>
            <div>
              <p className="text-sm text-slate-600">
                Signing in as <span className="font-medium text-navy-950">{email}</span>
              </p>
              <button
                type="button"
                className="mt-1 text-xs font-medium text-coral-700 hover:underline"
                onClick={() => {
                  setLoginStep('email')
                  setPassword('')
                  setError(null)
                  setInfo(null)
                }}
              >
                Change email
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <button
                  type="button"
                  onClick={() => void forgotPassword()}
                  disabled={busy || resetWait > 0}
                  className="text-xs font-medium text-coral-700 hover:underline disabled:text-slate-400"
                >
                  {resettingPassword ? 'Sending…' : resetWait > 0 ? `Wait ${resetWait}s` : 'Forgot password?'}
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
            <p className="text-xs text-slate-500">
              Accounts created with Google have no password. Use Continue with Google, or Forgot password to set one.
            </p>
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
          <p className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-semibold text-navy-950 hover:underline"
              onClick={() => void sendCode()}
              disabled={busy || resetWait > 0}
            >
              {resetWait > 0 ? `Send code in ${resetWait}s` : 'Sign in with a code instead'}
            </button>
          </p>
          {googleBlock()}
          {modeLinks()}
        </div>
      )
    }

    return (
      <div>
        <form className="space-y-4" onSubmit={(event) => void continueWithEmail(event)}>
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
          {error || sessionError || redirectError ? (
            <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
          ) : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          <Button type="submit" fullWidth disabled={busy}>
            {emailBusy ? 'Sending code…' : 'Continue'}
          </Button>
        </form>
        {googleBlock()}
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

  return (
    <div className="mx-auto grid max-w-6xl items-stretch gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
      <div className="studio-ink hidden flex-col justify-between rounded-[2rem] p-10 text-white lg:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">jobround.ai</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight">
            Candidates practice. You bring the hiring-side eye.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
            Sign in to run live mocks, keep bookings and notes in one place, and share feedback that actually helps
            someone land the role.
          </p>
        </div>
        <p className="text-sm text-slate-400">Built for working interviewers — not a generic admin panel.</p>
      </div>
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
        <PageHeader
          title={isRegister ? 'Create your interviewer account' : 'Sign in'}
          subtitle={
            isRegister
              ? 'Already on jobround.ai as a candidate? Sign in with that email — we’ll add your interviewer profile. New here? We’ll save your details and you can finish setup next.'
              : 'Enter your email for a 6-digit code, use a password, or continue with Google. Staff: use Admin sign in.'
          }
        />
        {!isRegister ? (
          <p className="mt-3 text-sm text-slate-600">
            Staff operations:{' '}
            <Link to="/admin/login" className="font-medium text-coral-700 hover:underline">
              Admin sign in
            </Link>
          </p>
        ) : null}

        {!isRegister && params.get('accountDeleted') === '1' ? (
          <div
            className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950"
            role="status"
          >
            <p className="font-semibold">Your interviewer account has been deleted</p>
            <p className="mt-1 leading-relaxed text-emerald-900">
              You&apos;re signed out. Your login still works if you use the same email on jobround.ai as a candidate, or
              you can register here again as an interviewer.
            </p>
          </div>
        ) : null}

        <Card className="mt-8 p-6 sm:p-8">{isRegister ? registerForm() : loginForm()}</Card>
      </div>
    </div>
  )
}
