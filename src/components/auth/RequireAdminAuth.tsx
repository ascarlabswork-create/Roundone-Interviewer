import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { INTERVIEWER_HOME } from '../../lib/nextPath.ts'
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

export function RequireAdminAuth() {
  const { status, user } = useSession()
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

  if (access.status === 'error' || !access.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Could not verify admin access"
          body={access.error ?? 'Could not load your profile.'}
          onRetry={access.reload}
        />
      </div>
    )
  }

  if (access.data.role !== 'admin') {
    return <Navigate to={access.data.role === 'interviewer' ? INTERVIEWER_HOME : '/interviewer/login'} replace />
  }

  return <Outlet />
}
