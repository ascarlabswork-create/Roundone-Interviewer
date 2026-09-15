import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'
import { safeNextPath } from '../lib/nextPath.ts'
import { oauthRedirectErrorMessage } from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

/**
 * Handles the Google OAuth redirect. The Supabase client is configured with
 * detectSessionInUrl, so it exchanges the code and fires onAuthStateChange,
 * which the SessionProvider uses to load the interviewer profile (and to sign
 * out any candidate/admin account). This page only reacts to that state.
 */
export function AuthCallbackPage() {
  const { status, account, error } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const oauthError = oauthRedirectErrorMessage(params)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(id)
  }, [])

  if (status === 'authenticated' && account) {
    return <Navigate to={nextPath} replace />
  }

  const notInterviewer = Boolean(error && error.includes('only supports interviewer'))
  const failed = Boolean(oauthError) || notInterviewer || (timedOut && status !== 'authenticated')

  if (failed) {
    const heading = notInterviewer ? 'This account can\u2019t use the Interviewer app' : 'Sign-in could not be completed'
    const body = notInterviewer
      ? 'This Google account is registered as a candidate or admin. We\u2019ve signed it out. Use an interviewer account to continue.'
      : oauthError
        ? oauthError
        : 'We couldn\u2019t confirm your session. Please try signing in again.'

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
        <p className="mt-2 text-sm text-slate-600">Confirming your interviewer account with Google.</p>
      </Card>
    </div>
  )
}
