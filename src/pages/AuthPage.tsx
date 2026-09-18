import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { GoogleIcon } from '../components/ui/GoogleIcon.tsx'
import { Card, FieldLabel, TextInput } from '../components/ui/primitives.tsx'
import { SuggestedSelect } from '../components/ui/suggestions.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
import { cn } from '../lib/cn.ts'
import { defaultHomePath, destinationForRole, safeNextPath } from '../lib/nextPath.ts'
import {
  authErrorMessage,
  isUnconfirmedEmailError,
  oauthRedirectErrorMessage,
  resendSignupEmail,
  sendPasswordReset,
  signInInterviewer,
  signInWithGoogle,
  signUpInterviewer,
} from '../services/auth.ts'
import { applySignupProfile } from '../services/interviewerProfile.ts'
import { useSession } from '../state/session.tsx'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, user, profile, account, error: sessionError, refreshAccount } = useSession()
  const [params] = useSearchParams()
  const isRegister = mode === 'register'
  const nextPath = safeNextPath(
    params.get('next'),
    isRegister ? '/interviewer/setup?step=professional' : defaultHomePath(profile?.role),
  )
  const nextQuery = `?next=${encodeURIComponent(nextPath)}`
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [company, setCompany] = useState('')
  const [currentRole, setCurrentRole] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  if (status === 'authenticated' && user && (account || profile?.role === 'admin')) {
    return <Navigate to={destinationForRole(profile?.role, nextPath)} replace />
  }

  if (status === 'authenticated' && user && !sessionError) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-navy-950">Signing you in\u2026</h1>
        <p className="mt-1 text-sm text-slate-600">Loading your account.</p>
      </Card>
    )
  }

  const busy = submitting || googleSubmitting || resending || status === 'loading'
  const showResend = awaitingConfirmation || isUnconfirmedEmailError(error)
  const redirectError = oauthRedirectErrorMessage(params)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (isRegister) {
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
          setInfo('Check your email for a confirmation link. After you confirm, sign in to continue setup.')
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
      } else {
        await signInInterviewer({ email, password })
        await refreshAccount()
      }
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function continueWithGoogle() {
    setError(null)
    setInfo(null)
    setGoogleSubmitting(true)
    try {
      await signInWithGoogle(nextPath)
    } catch (caught) {
      setError(authErrorMessage(caught))
      setGoogleSubmitting(false)
    }
  }

  async function forgotPassword() {
    setError(null)
    setInfo(null)
    try {
      await sendPasswordReset(email)
      setInfo('If an account exists for that email, we sent a password reset link.')
    } catch (caught) {
      setError(authErrorMessage(caught))
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
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setResending(false)
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
        <Link
          to={`/interviewer/login${nextQuery}`}
          className={cn(
            'rounded-md px-3 py-2 text-center text-sm font-semibold',
            !isRegister ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600',
          )}
        >
          Sign in
        </Link>
        <Link
          to={`/interviewer/register${nextQuery}`}
          className={cn(
            'rounded-md px-3 py-2 text-center text-sm font-semibold',
            isRegister ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600',
          )}
        >
          Sign up
        </Link>
      </div>

      <h1 className="text-xl font-semibold text-navy-950">
        {isRegister ? 'Create your interviewer account' : 'Sign in'}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {isRegister
          ? 'We’ll save your professional details to your interviewer profile. Skills, services, and availability come next.'
          : 'Use email and password, or continue with Google.'}
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        {isRegister ? (
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
        ) : null}

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

        {isRegister ? (
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
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            {!isRegister ? (
              <button
                type="button"
                onClick={() => void forgotPassword()}
                disabled={busy}
                className="text-xs font-medium text-blue-700 hover:underline disabled:text-slate-400"
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <TextInput
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {isRegister ? (
          <>
            <div>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <TextInput
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <SuggestedSelect
                id="timezone"
                options={TIMEZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
                value={timezone}
                onChange={setTimezone}
                customPlaceholder="Type a timezone, e.g. Europe/Berlin"
                required
              />
            </div>
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
          </>
        ) : null}

        {error || sessionError || redirectError ? (
          <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
        ) : null}
        {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

        {showResend ? (
          <Button type="button" variant="outline" fullWidth disabled={busy} onClick={() => void resendConfirmation()}>
            {resending ? 'Sending link\u2026' : 'Resend confirmation email'}
          </Button>
        ) : null}

        <Button type="submit" fullWidth disabled={busy}>
          {submitting ? 'Please wait\u2026' : isRegister ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button type="button" variant="outline" fullWidth disabled={busy} onClick={() => void continueWithGoogle()}>
        <GoogleIcon className="h-4 w-4" />
        {googleSubmitting ? 'Redirecting to Google\u2026' : 'Continue with Google'}
      </Button>
    </Card>
  )
}
