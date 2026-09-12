import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PageHeader, TextInput } from '../components/ui/primitives.tsx'
import { safeNextPath } from '../lib/nextPath.ts'
import { signInInterviewer } from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

export function LoginPage() {
  const { status, user, error: sessionError, refreshAccount } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInInterviewer({ email, password })
      await refreshAccount()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <PageHeader title="Interviewer sign in" subtitle="Sign in to manage your professional profile and practice." />
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
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <TextInput
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error || sessionError ? <p className="text-sm text-red-700">{error || sessionError}</p> : null}
          <Button type="submit" fullWidth disabled={submitting || status === 'loading'}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          New interviewer?{' '}
          <Link className="font-medium text-blue-700" to={`/interviewer/register?next=${encodeURIComponent(nextPath)}`}>
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  )
}
