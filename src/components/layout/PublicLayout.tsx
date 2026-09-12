import { Link, Outlet } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'
import { Logo } from './Logo.tsx'

export function PublicLayout() {
  const { toasts, dismissToast } = useToast()
  const { signOut } = useSession()

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/interviewer/dashboard" />
          <div className="flex items-center gap-3">
            <Link to="/interviewer/dashboard" className="text-sm font-medium text-navy-950">
              Dashboard
            </Link>
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Array<{ id: number; message: string }>
  onDismiss: (id: number) => void
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="pointer-events-auto rounded-lg bg-navy-950 px-4 py-3 text-left text-sm text-white shadow-lg"
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
