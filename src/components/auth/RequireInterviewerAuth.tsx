import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ADMIN_HOME } from '../../lib/nextPath.ts'
import { useAsync } from '../../lib/useAsync.ts'
import { getMyProfile } from '../../services/interviewerProfile.ts'
import { useSession } from '../../state/session.tsx'
import { ErrorState, Skeleton } from '../ui/primitives.tsx'

function GateSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
      <Skeleton className="h-12" />
      <Skeleton className="h-64" />
    </div>
  )
}

export function RequireInterviewerAuth() {
  const { status, user, account, error, refreshAccount } = useSession()
  const location = useLocation()
  const access = useAsync(async () => {
    if (!user) return null
    return getMyProfile()
  }, [user?.id])

  if (status === 'loading') return <GateSkeleton />

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/interviewer/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (access.status === 'loading') return <GateSkeleton />

  if (access.status === 'success' && access.data?.role === 'admin') {
    return <Navigate to={ADMIN_HOME} replace />
  }

  if (error && error.includes('only supports interviewer')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState title="Interviewer account required" body={error} />
      </div>
    )
  }

  if (!account) {
    if (error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <ErrorState
            title="Could not load your interviewer profile"
            body={error}
            onRetry={() => void refreshAccount()}
          />
        </div>
      )
    }
    return <GateSkeleton />
  }

  return <Outlet />
}
