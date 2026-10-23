import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { LegalFooter } from '../legal/LegalFooter.tsx'
import { Logo } from './Logo.tsx'

/** Public chrome for legal pages: readable signed in or out, never gated by auth. */
export function LegalLayout() {
  const { user } = useSession()
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo to={user ? '/interviewer/dashboard' : '/interviewer/login'} />
          <Link
            to={user ? '/interviewer/dashboard' : '/interviewer/login'}
            className="text-sm font-semibold text-slate-700 hover:text-navy-950"
          >
            {user ? 'Dashboard' : 'Sign in'}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <LegalFooter />
    </div>
  )
}
