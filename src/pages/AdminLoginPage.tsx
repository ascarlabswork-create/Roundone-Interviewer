import { Link, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/primitives.tsx'
import { ADMIN_HOME } from '../lib/nextPath.ts'
import { AuthPage } from './AuthPage.tsx'

/** Staff sign-in for the operations console (same credentials; `profiles.role = admin`). */
export function AdminLoginPage() {
  const [params] = useSearchParams()
  const denied = params.get('reason') === 'not-admin'

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8 sm:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-navy-950">Admin sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Approve interviewer verification, moderate reviews, and manage bookings. Use the same email as your jobround account — admin access
          is granted in the database, not on the interviewer signup form.
        </p>
      </div>

      {denied ? (
        <Card className="border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">This account is not an admin.</p>
          <p className="mt-1">
            Interviewer accounts cannot open the admin console. Ask your team to set{' '}
            <code className="rounded bg-white/80 px-1 text-xs">profiles.role</code> to{' '}
            <code className="rounded bg-white/80 px-1 text-xs">admin</code> in Supabase for your user, then sign in again.
          </p>
        </Card>
      ) : null}

      <AuthPage mode="login" defaultNextPath={ADMIN_HOME} />

      <p className="text-center text-sm text-slate-500">
        Interviewers:{' '}
        <Link to="/interviewer/login" className="font-medium text-coral-700 hover:underline">
          Sign in to experts
        </Link>
      </p>
    </div>
  )
}
