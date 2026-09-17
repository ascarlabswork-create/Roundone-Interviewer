import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { NotFoundPage } from '../../pages/NotFoundPage.tsx'

/** Unknown URLs: login if signed out, 404 only after sign-in. */
export function UnknownRoute() {
  const { status, user } = useSession()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 sm:px-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/interviewer/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <NotFoundPage />
}
