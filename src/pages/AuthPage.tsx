import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { GoogleIcon } from '../components/ui/GoogleIcon.tsx'
import { Card, FieldLabel, PageHeader, TextInput } from '../components/ui/primitives.tsx'
import { safeNextPath } from '../lib/nextPath.ts'
import {
  authErrorMessage,
  sendPasswordReset,
  signInInterviewer,
  signInWithGoogle,
  signUpInterviewer,
} from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, user, error: sessionError, refreshAccount } = useSession()
  const [params] = useSearchParams()
  const isRegister = mode === 'register'
  const nextPath = safeNextPath(
    params.get('next'),
    isRegister ? '/interviewer/setup?step=professional' : '/interviewer/dashboard',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
  }

  const busy = submitting || googleSubmitting || status === 'loading'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (isRegister) {
        const result = await signUpInterviewer({ email, password })
        if (result.needsEmailConfirmation) {
          setInfo('Check your email to confirm your account, then sign in to finish setup.')
          return
        }
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

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <PageHeader
        title={isRegister ? 'Create your interviewer account' : 'Interviewer sign in'}
        subtitle={
          isRegister
            ? 'Use your email and password, or continue with Google. Professional details come next.'
            : 'Sign in to manage your professional profile and practice.'
        }
      />

      <Card className="mt-8 p-6 sm:p-8">
        <form className="space-y-4" onSubmit={submit}>
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

          {error || sessionError ? <p className="text-sm text-red-700">{error || sessionError}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

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

        <p className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link className="font-medium text-blue-700" to={`/interviewer/login?next=${encodeURIComponent(nextPath)}`}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              New interviewer?{' '}
              <Link
                className="font-medium text-blue-700"
                to={`/interviewer/register?next=${encodeURIComponent(nextPath)}`}
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </Card>
    </div>
  )
}
