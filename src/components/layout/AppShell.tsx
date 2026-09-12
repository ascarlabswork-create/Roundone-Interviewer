import {
  Bell,
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
  Users,
  X,
  Briefcase,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { listNotifications } from '../../api/index.ts'
import { Button } from '../ui/Button.tsx'
import { VerificationBadge } from '../ui/StatusBadge.tsx'
import { cn } from '../../lib/cn.ts'
import { useAsync } from '../../lib/useAsync.ts'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'
import { initials } from '../../lib/format.ts'
import { Logo } from './Logo.tsx'
import { ToastStack } from './PublicLayout.tsx'

const navItems = [
  { to: '/interviewer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/interviewer/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/interviewer/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/interviewer/services', label: 'Services', icon: Briefcase },
  { to: '/interviewer/candidates', label: 'Candidates', icon: Users },
  { to: '/interviewer/reviews', label: 'Reviews', icon: Star },
  { to: '/interviewer/earnings', label: 'Earnings', icon: IndianRupee },
  { to: '/interviewer/profile', label: 'Profile', icon: UserRound },
  { to: '/interviewer/verification', label: 'Verification', icon: Shield },
  { to: '/interviewer/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const [open, setOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const { account, signOut } = useSession()
  const displayName = account?.profile?.full_name ?? 'Interviewer'
  const verifications = account?.verifications ?? []
  const overallVerification = verifications.some((item) => item.status === 'rejected')
    ? 'rejected'
    : verifications.length > 0 && verifications.every((item) => item.status === 'verified')
      ? 'verified'
      : 'pending'
  const { toasts, dismissToast } = useToast()
  const notes = useAsync(() => listNotifications(), [])
  const unread = notes.status === 'success' ? notes.data.filter((item) => !item.read).length : 0

  return (
    <div className="min-h-svh bg-slate-50 lg:flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-transform lg:static lg:w-64 lg:translate-x-0 xl:w-72',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Logo to="/interviewer/dashboard" />
          <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Interviewer">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-navy-950',
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <p className="hidden text-sm font-medium text-slate-500 sm:block">Interviewer practice</p>
          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-50"
                aria-label="Notifications"
                onClick={() => setNotesOpen((value) => !value)}
              >
                <Bell className="h-5 w-5" />
                {unread ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600" /> : null}
              </button>
              {notesOpen && notes.status === 'success' ? (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {notes.data.map((item) => (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => setNotesOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-navy-950">{item.title}</p>
                      <p className="text-xs text-slate-600">{item.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{item.time}</p>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <Link
              to="/interviewer/profile"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
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
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
