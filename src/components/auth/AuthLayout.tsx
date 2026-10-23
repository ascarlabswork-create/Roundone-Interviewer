import { Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { LegalFooter } from '../legal/LegalFooter.tsx'
import { Logo } from '../layout/Logo.tsx'
import { ToastStack } from '../layout/PublicLayout.tsx'
import { useToast } from '../../state/toast.tsx'
import { cn } from '../../lib/cn.ts'
import { GoogleOneTap } from './GoogleOneTap.tsx'

/** Guest-only chrome: logo and the auth form. No dashboard or marketing. */
export function AuthLayout() {
  const { status } = useSession()
  const location = useLocation()
  const { toasts, dismissToast } = useToast()
  const isRegister = location.pathname.startsWith('/interviewer/register')

  if (status === 'loading') {
    return (
      <div className="app-canvas flex min-h-svh flex-col items-center justify-center px-4">
        <Logo to="/interviewer/login" />
        <div className={cn('mt-8 w-full space-y-4', isRegister ? 'max-w-2xl' : 'max-w-md')}>
          <Skeleton className="h-10" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-canvas flex min-h-svh flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="hidden max-w-md lg:block">
          <Logo to="/interviewer/login" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">For interviewers</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy-950">
            Run sharper mock interviews, without the clutter.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            jobround.ai is your studio for bookings, live sessions, feedback, and earnings — designed to feel calm
            when the calendar is not.
          </p>
        </div>
        <div className="flex w-full flex-1 flex-col items-center justify-start lg:items-stretch">
          <div className="mb-6 lg:hidden">
            <Logo to="/interviewer/login" />
          </div>
          <div className={cn('w-full', isRegister ? 'max-w-2xl' : 'max-w-md')}>
            <Outlet />
          </div>
        </div>
      </div>
      <LegalFooter className="border-transparent bg-transparent" />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {location.pathname.startsWith('/interviewer/auth/callback') ||
      location.pathname.startsWith('/interviewer/reset-password') ? null : (
        <GoogleOneTap />
      )}
    </div>
  )
}
