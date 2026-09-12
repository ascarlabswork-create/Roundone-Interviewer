import { Navigate } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'

/** First screen: login if signed out, dashboard after login. */
export function EntryRedirect() {
  const { status, user } = useSession()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 sm:px-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/interviewer/dashboard" replace />
  }

  return <Navigate to="/interviewer/login" replace />
}
