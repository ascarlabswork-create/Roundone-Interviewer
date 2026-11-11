import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PasswordInput, TextInput } from '../components/ui/primitives.tsx'
import { Logo } from '../components/layout/Logo.tsx'
import { ADMIN_HOME, safeNextPath } from '../lib/nextPath.ts'
import { authErrorMessage, signInInterviewer } from '../services/auth.ts'
import { getMyProfile } from '../services/interviewerProfile.ts'
import { useSession } from '../state/session.tsx'

/**
 * Staff-only sign-in. Does not reuse interviewer AuthPage, so an existing
 * interviewer session never auto-lands on /interviewer/*.
 */
export function AdminLoginPage() {
  const { status, user, profile, signOut, refreshAccount } = useSession()
  const [params] = useSearchParams()
  const denied = params.get('reason') === 'not-admin'
  const nextPath = safeNextPath(params.get('next'), ADMIN_HOME)
  const adminNext = nextPath.startsWith('/admin') ? nextPath : ADMIN_HOME

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-paper px-4">
        <p className="text-sm text-slate-600">Checking session…</p>
      </div>
    )
  }

  if (status === 'authenticated' && user && profile?.role === 'admin') {
    return <Navigate to={adminNext} replace />
  }

  async function onSignOut() {
    setSigningOut(true)
    setError(null)
    try {
      await signOut()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSigningOut(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInInterviewer({ email, password })
      await refreshAccount()
      const nextProfile = await getMyProfile()
      if (nextProfile.role !== 'admin') {
        await signOut()
        setError(
          'This account is not an admin. Use an account with profiles.role = admin, or sign in as an interviewer at /interviewer/login.',
        )
        return
      }
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const interviewerSession = Boolean(status === 'authenticated' && user && profile?.role !== 'admin')

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo to="/admin/login" inverted />
        <Link to="/interviewer/login" className="text-sm font-medium text-slate-300 hover:text-white">
          Interviewer sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Staff console</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Separate from the interviewer app. Approve verification, moderate reviews, and manage bookings for
          interviewers and candidates.
        </p>

        {denied || interviewerSession ? (
          <Card className="mt-6 border-amber-200/30 bg-amber-50 p-5 text-amber-950">
            <p className="font-semibold">Interviewer accounts cannot open admin</p>
            <p className="mt-1 text-sm leading-relaxed">
              You are signed in as an interviewer{profile?.full_name ? ` (${profile.full_name})` : ''}. Sign out first,
              then use a staff account with <code className="rounded bg-white/80 px-1 text-xs">profiles.role = admin</code>
              .
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={signingOut} onClick={() => void onSignOut()}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
              <Link to="/interviewer/dashboard">
                <Button type="button" variant="outline" fullWidth className="sm:w-auto">
                  Stay on interviewer app
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {!interviewerSession ? (
          <Card className="mt-6 p-6 text-navy-950 sm:p-8">
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <FieldLabel htmlFor="adminEmail">Work email</FieldLabel>
                <TextInput
                  id="adminEmail"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="adminPassword">Password</FieldLabel>
                <PasswordInput
                  id="adminPassword"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in to admin'}
              </Button>
            </form>
            <p className="mt-4 text-xs text-slate-500">
              Admin access is granted in Supabase (<code className="text-[11px]">profiles.role = admin</code>), not via
              interviewer registration.
            </p>
          </Card>
        ) : null}

        {error && interviewerSession ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </main>
    </div>
  )
}
