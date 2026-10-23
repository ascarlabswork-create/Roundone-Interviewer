import { Link, Outlet } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'
import { LegalFooter } from '../legal/LegalFooter.tsx'
import { Button } from '../ui/Button.tsx'
import { Logo } from './Logo.tsx'

export function PublicLayout() {
  const { toasts, dismissToast } = useToast()
  const { signOut } = useSession()

  return (
    <div className="app-canvas flex min-h-svh flex-col">
      <header className="sticky top-3 z-40 mx-3 rounded-3xl border border-navy-950/8 bg-white/75 shadow-[0_18px_40px_-24px_rgb(12_28_46/0.22)] backdrop-blur-xl">
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
      <LegalFooter />
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
          className="pointer-events-auto rounded-2xl bg-navy-950 px-4 py-3 text-left text-sm text-white shadow-[0_18px_40px_-18px_rgb(12_28_46/0.55)]"
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
