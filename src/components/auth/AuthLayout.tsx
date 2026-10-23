import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { LegalFooter } from '../legal/LegalFooter.tsx'
import { Logo } from '../layout/Logo.tsx'
import { ToastStack } from '../layout/PublicLayout.tsx'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'
import { GoogleOneTap } from './GoogleOneTap.tsx'

/** Guest-only chrome: same jobround paper header as the candidate app. */
export function AuthLayout() {
  const { status } = useSession()
  const location = useLocation()
  const { toasts, dismissToast } = useToast()
  const isRegister = location.pathname.startsWith('/interviewer/register')

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-paper px-4">
        <Logo to="/interviewer/login" />
        <div className={`mt-8 w-full space-y-4 ${isRegister ? 'max-w-2xl' : 'max-w-md'}`}>
          <Skeleton className="h-10" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-navy-950/8 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo to="/interviewer/login" />
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              to="/contact"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-navy-950/5 hover:text-navy-950"
            >
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/interviewer/login" className="text-sm font-semibold text-navy-800 hover:text-coral-700">
              Sign in
            </Link>
            <Link to="/interviewer/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="studio-grid flex-1">
        <Outlet />
      </main>
      <LegalFooter />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {location.pathname.startsWith('/interviewer/auth/callback') ||
      location.pathname.startsWith('/interviewer/reset-password') ? null : (
        <GoogleOneTap />
      )}
    </div>
  )
}
