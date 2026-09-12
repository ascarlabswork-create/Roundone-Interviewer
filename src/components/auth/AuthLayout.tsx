import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { Logo } from '../layout/Logo.tsx'
import { ToastStack } from '../layout/PublicLayout.tsx'
import { useToast } from '../../state/toast.tsx'

/** Guest-only chrome: logo and the auth form. No dashboard or marketing. */
export function AuthLayout() {
  const { status, user } = useSession()
  const location = useLocation()
  const { toasts, dismissToast } = useToast()
  const isCallback = location.pathname.startsWith('/interviewer/auth/callback')

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4">
        <Logo to="/interviewer/login" />
        <div className="mt-8 w-full max-w-md space-y-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  if (user && !isCallback) {
    return <Navigate to="/interviewer/dashboard" replace />
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Logo to="/interviewer/login" />
      <div className="mt-8 w-full max-w-md">
        <Outlet />
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
