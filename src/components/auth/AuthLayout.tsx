import { Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { Logo } from '../layout/Logo.tsx'
import { ToastStack } from '../layout/PublicLayout.tsx'
import { useToast } from '../../state/toast.tsx'
import { cn } from '../../lib/cn.ts'

/** Guest-only chrome: logo and the auth form. No dashboard or marketing. */
export function AuthLayout() {
  const { status } = useSession()
  const location = useLocation()
  const { toasts, dismissToast } = useToast()
  const isRegister = location.pathname.startsWith('/interviewer/register')

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4">
        <Logo to="/interviewer/login" />
        <div className={cn('mt-8 w-full space-y-4', isRegister ? 'max-w-2xl' : 'max-w-md')}>
          <Skeleton className="h-10" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-start overflow-y-auto bg-slate-50 px-4 py-10 sm:justify-center">
      <Logo to="/interviewer/login" />
      <div className={cn('mt-8 w-full', isRegister ? 'max-w-2xl' : 'max-w-md')}>
        <Outlet />
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
