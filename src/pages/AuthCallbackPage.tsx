import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'
import { isInPasswordRecoveryFlow, isAuthRecoveryUrl, redirectToPasswordRecovery } from '../lib/authRecovery.ts'
import { landingPathForAccount } from '../lib/interviewWelcome.ts'
import { INTERVIEWER_SETUP, defaultHomePath, safeNextPath } from '../lib/nextPath.ts'
import { oauthRedirectErrorMessage } from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

/**
 * Handles the Google OAuth redirect. The Supabase client is configured with
 * detectSessionInUrl, so it exchanges the code and fires onAuthStateChange,
 * which the SessionProvider uses to load the authenticated profile.
 */
export function AuthCallbackPage() {
  const { status, profile, account, error } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'), profile?.role === 'admin' ? defaultHomePath('admin') : INTERVIEWER_SETUP)
  const oauthError = oauthRedirectErrorMessage(params)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (isAuthRecoveryUrl()) redirectToPasswordRecovery()
  }, [])

  if (isInPasswordRecoveryFlow()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-navy-950">Opening password reset…</h1>
          <p className="mt-2 text-sm text-slate-600">One moment while we load the reset form.</p>
        </Card>
      </div>
    )
  }

  if (status === 'authenticated' && (account || profile?.role === 'admin')) {
    return <Navigate to={landingPathForAccount(profile?.role, account, nextPath)} replace />
  }

  if (status === 'authenticated' && error && !account && profile?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-navy-950">Sign-in could not be completed</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <div className="mt-6 flex justify-center">
            <Link to={`/interviewer/login?next=${encodeURIComponent(nextPath)}`}>
              <Button>Back to sign in</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const failed = Boolean(oauthError) || (timedOut && status !== 'authenticated')

  if (failed) {
    const heading = 'Sign-in could not be completed'
    const body = oauthError ?? 'We couldn\u2019t confirm your session. Please try signing in again.'

    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-navy-950">{heading}</h1>
          <p className="mt-2 text-sm text-slate-600">{body}</p>
          <div className="mt-6 flex justify-center">
            <Link to={`/interviewer/login?next=${encodeURIComponent(nextPath)}`}>
              <Button>Back to sign in</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold text-navy-950">Completing sign-in\u2026</h1>
        <p className="mt-2 text-sm text-slate-600">Confirming your account.</p>
      </Card>
    </div>
  )
}
