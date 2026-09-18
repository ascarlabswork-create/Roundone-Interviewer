import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Shield,
  Star,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { initials } from '../../lib/format.ts'
import { useSession } from '../../state/session.tsx'
import { Button } from '../ui/Button.tsx'
import { ToastStack } from './PublicLayout.tsx'
import { useToast } from '../../state/toast.tsx'

const navItems = [
  { to: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { to: '/admin/verifications', label: 'Verifications', icon: Shield },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/admin/services', label: 'Services', icon: Briefcase },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
]

export function AdminShell() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useSession()
  const displayName = profile?.full_name ?? 'Admin'
  const { toasts, dismissToast } = useToast()

  return (
    <div className="min-h-svh bg-slate-100 lg:flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-navy-950 text-white transition-transform lg:static lg:w-64 lg:translate-x-0 xl:w-72',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <div>
            <p className="text-sm font-semibold tracking-tight">RoundOne Admin</p>
            <p className="text-[11px] text-slate-300">Internal operations</p>
          </div>
          <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Admin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive ? 'bg-white text-navy-950' : 'text-slate-200 hover:bg-navy-800 hover:text-white',
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <ClipboardCheck className="h-4 w-4" />
            RoundOne Admin
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
              {initials(displayName)}
            </span>
            <span className="hidden text-sm font-medium text-navy-950 sm:block">{displayName}</span>
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  )
}
