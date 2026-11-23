import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { LegalFooter } from '../legal/LegalFooter.tsx'
import { Logo } from '../layout/Logo.tsx'
import { ToastStack } from '../layout/PublicLayout.tsx'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'

/** Guest chrome for interviewer landing — forms open in a modal from Sign in / Join. */
export function AuthLayout() {
  const { status } = useSession()
  const location = useLocation()
  const [params] = useSearchParams()
  const { toasts, dismissToast } = useToast()
  const next = params.get('next')
  const nextSuffix = next ? `&next=${encodeURIComponent(next)}` : ''
  const signInTo = `/interviewer/login?open=signin${nextSuffix}`
  const registerTo = `/interviewer/register?open=register${nextSuffix}`
  const onAuthRoute =
    location.pathname.startsWith('/interviewer/login') ||
    location.pathname.startsWith('/interviewer/register') ||
    location.pathname === '/' ||
    location.pathname === '/interviewer'

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-paper px-4">
        <Logo to="/interviewer/login" />
        <div className="mt-8 w-full max-w-md space-y-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-navy-950/8 bg-paper/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo to="/interviewer/login" />
          <div className="flex items-center gap-2 sm:gap-3">
            {onAuthRoute ? (
              <>
                <Link
                  to={signInTo}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-800 transition hover:bg-navy-950/5 hover:text-navy-950"
                >
                  Sign in
                </Link>
                <Link to={registerTo}>
                  <Button size="sm">Join as interviewer</Button>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/interviewer/login"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-800 transition hover:bg-navy-950/5 hover:text-navy-950"
                >
                  Sign in
                </Link>
                <Link to="/interviewer/register">
                  <Button size="sm">Join as interviewer</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="studio-grid relative flex-1 overflow-hidden">
        <div
          aria-hidden
          className="experts-orb pointer-events-none absolute -left-20 top-16 h-56 w-56 rounded-full bg-coral-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="experts-orb pointer-events-none absolute -right-16 bottom-24 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl [animation-delay:1.5s]"
        />
        <Outlet />
      </main>
      <LegalFooter />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
