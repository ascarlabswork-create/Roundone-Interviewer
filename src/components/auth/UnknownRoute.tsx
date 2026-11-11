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
    const login =
      location.pathname.startsWith('/admin') ? `/admin/login?next=${encodeURIComponent(location.pathname)}` : `/interviewer/login?next=${encodeURIComponent(location.pathname)}`
    return <Navigate to={login} replace />
  }

  if (location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin/login?reason=not-admin" replace />
  }

  return <NotFoundPage />
}
