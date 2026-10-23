import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PasswordInput } from '../components/ui/primitives.tsx'
import { authErrorMessage, updatePassword } from '../services/auth.ts'
import { supabase } from '../lib/supabase.ts'
import { useSession } from '../state/session.tsx'

export function ResetPasswordPage() {
  const { refreshAccount } = useSession()
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) setRecoveryReady(true)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setRecoveryReady(true)
    })
    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await updatePassword(password)
      await refreshAccount()
      setDone(true)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <Navigate to="/interviewer/dashboard" replace />
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-navy-950">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-600">
        {recoveryReady
          ? 'Enter a new password for your interviewer account.'
          : 'Open the reset link from your email on this device. Links expire after a short time.'}
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <PasswordInput
            id="newPassword"
            required
            minLength={6}
            autoComplete="new-password"
            disabled={!recoveryReady || submitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="confirmNewPassword">Confirm password</FieldLabel>
          <PasswordInput
            id="confirmNewPassword"
            required
            minLength={6}
            autoComplete="new-password"
            disabled={!recoveryReady || submitting}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" fullWidth disabled={!recoveryReady || submitting}>
          {submitting ? 'Saving…' : 'Update password'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        <Link to="/interviewer/login" className="font-medium text-teal-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  )
}
