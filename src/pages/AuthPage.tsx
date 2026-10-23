import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { GoogleIcon } from '../components/ui/GoogleIcon.tsx'
import { Card, FieldLabel, PageHeader, PasswordInput, TextInput } from '../components/ui/primitives.tsx'
import { TimezoneSelect } from '../components/ui/TimezoneSelect.tsx'
import { INTERVIEWER_SETUP, defaultHomePath, destinationForRole, safeNextPath } from '../lib/nextPath.ts'
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
    isRegister ? INTERVIEWER_SETUP : defaultHomePath(profile?.role),
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
  const [resettingPassword, setResettingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  if (status === 'authenticated' && user && (account || profile?.role === 'admin')) {
    return <Navigate to={destinationForRole(profile?.role, nextPath)} replace />
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

  const busy = submitting || googleSubmitting || resending || resettingPassword || status === 'loading'
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
      } else {
        await signInInterviewer({ email, password })
        await refreshAccount()
      }
    } catch (caught) {
      const message = authErrorMessage(caught)
      setError(message)
      if (!isRegister && isUnconfirmedEmailError(caught)) {
        setAwaitingConfirmation(true)
      }
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
    setResettingPassword(true)
    try {
      await sendPasswordReset(email)
      setInfo('If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.')
    } catch (caught) {
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
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setResending(false)
    }
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
            ? 'We’ll save your professional details to your interviewer profile. Skills, services, and availability come next.'
            : 'Sign in to manage bookings, sessions, and earnings.'
        }
      />

      <Card className="mt-8 p-6 sm:p-8">
      <form className="space-y-4" onSubmit={submit}>
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
                className="text-xs font-medium text-coral-700 hover:underline disabled:text-slate-400"
              >
                {resettingPassword ? 'Sending link…' : 'Forgot password?'}
              </button>
            ) : null}
          </div>
          <PasswordInput
            id="password"
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
              <PasswordInput
                id="confirmPassword"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <TimezoneSelect id="timezone" value={timezone} onChange={setTimezone} required />
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

        {!isRegister ? (
          <p className="text-xs text-slate-500">
            Accounts created with Google have no password. Use Continue with Google, or Forgot password to set one.
          </p>
        ) : null}

        {error || sessionError || redirectError ? (
          <p className="text-sm text-red-700">{error || sessionError || redirectError}</p>
        ) : null}
        {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

        {showResend ? (
          <div className="space-y-3">
            <Button type="button" variant="outline" fullWidth disabled={busy} onClick={() => void resendConfirmation()}>
              {resending ? 'Sending link\u2026' : 'Resend confirmation email'}
            </Button>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-800">No email in a few minutes?</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Check spam for mail from Supabase or jobround.ai.</li>
                <li>Confirm the email address above is correct.</li>
                <li>
                  Open the <strong>Sign in</strong> tab and try <strong>Forgot password?</strong>—if that message arrives, wait and
                  resend confirmation; if neither arrives, mail delivery must be enabled in Supabase (SMTP).
                </li>
                <li>
                  Email{' '}
                  <a href="mailto:support@jobround.ai" className="font-medium text-coral-700 underline">
                    support@jobround.ai
                  </a>{' '}
                  with the address you used if you are still stuck.
                </li>
              </ul>
            </div>
          </div>
        ) : null}

        <Button type="submit" fullWidth disabled={busy}>
          {submitting ? 'Please wait\u2026' : isRegister ? 'Create account' : 'Sign In'}
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
    </Card>
      </div>
    </div>
  )
}
