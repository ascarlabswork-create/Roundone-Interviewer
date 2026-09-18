import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { INTERVIEWER_HOME } from '../../lib/nextPath.ts'
import { useSession } from '../../state/session.tsx'
import { ErrorState, Skeleton } from '../ui/primitives.tsx'

export function RequireAdminAuth() {
  const { status, user, profile, error, refreshAccount } = useSession()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/interviewer/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (!profile) {
    if (error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <ErrorState body={error} onRetry={() => void refreshAccount()} />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (profile.role !== 'admin') {
    return <Navigate to={profile.role === 'interviewer' ? INTERVIEWER_HOME : '/interviewer/login'} replace />
  }

  return <Outlet />
}
