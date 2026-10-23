import {
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Star,
  UserRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Button } from '../ui/Button.tsx'
import { VerificationBadge } from '../ui/StatusBadge.tsx'
import { cn } from '../../lib/cn.ts'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'
import { initials } from '../../lib/format.ts'
import { LegalFooter } from '../legal/LegalFooter.tsx'
import { Logo } from './Logo.tsx'
import { NotificationBell } from './NotificationBell.tsx'
import { ToastStack } from './PublicLayout.tsx'

const navItems = [
  { to: '/interviewer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/interviewer/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/interviewer/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/interviewer/services', label: 'Services', icon: Briefcase },
  { to: '/interviewer/reviews', label: 'Reviews', icon: Star },
  { to: '/interviewer/earnings', label: 'Earnings', icon: IndianRupee },
  { to: '/interviewer/notifications', label: 'Notifications', icon: Bell },
  { to: '/interviewer/profile', label: 'Profile', icon: UserRound },
  { to: '/interviewer/verification', label: 'Verification', icon: Shield },
  { to: '/interviewer/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { account, signOut } = useSession()
  const displayName = account?.profile?.full_name ?? 'Interviewer'
  const verifications = account?.verifications ?? []
  const overallVerification = verifications.some((item) => item.status === 'rejected')
    ? 'rejected'
    : verifications.length > 0 && verifications.every((item) => item.status === 'verified')
      ? 'verified'
      : 'pending'
  const { toasts, dismissToast } = useToast()

  return (
    <div className="app-canvas min-h-svh lg:flex lg:gap-0">
      <aside
        className={cn(
          'fixed inset-y-3 left-3 z-40 flex w-72 flex-col rounded-3xl border border-navy-950/8 bg-white/80 shadow-[0_24px_60px_-28px_rgb(12_28_46/0.28)] backdrop-blur-xl transition-transform lg:sticky lg:top-3 lg:my-3 lg:ml-3 lg:h-[calc(100svh-1.5rem)] lg:w-64 lg:translate-x-0 xl:w-72',
          open ? 'translate-x-0' : '-translate-x-[120%]',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo to="/interviewer/dashboard" />
          <button type="button" className="rounded-full p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-4" aria-label="Interviewer">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-navy-950/5 hover:text-navy-950',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 mx-3 mt-3 flex h-16 items-center justify-between gap-3 rounded-3xl border border-navy-950/8 bg-white/75 px-4 shadow-[0_18px_40px_-24px_rgb(12_28_46/0.22)] backdrop-blur-xl">
          <button type="button" className="rounded-full p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <p className="hidden text-sm font-medium text-slate-500 sm:block">Your interview studio</p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Link
              to="/interviewer/profile"
              className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-navy-950/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-xs font-semibold text-white">
                {initials(displayName)}
              </span>
              <span className="hidden text-sm font-medium text-navy-950 sm:block">{displayName}</span>
            </Link>
            <Link to="/interviewer/verification" className="hidden sm:inline-flex">
              <VerificationBadge status={overallVerification} />
            </Link>
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <LegalFooter className="border-transparent bg-transparent" />
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
