import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn.ts'

export function AuthModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <button
        type="button"
        className="experts-fade absolute inset-0 bg-navy-950/55 backdrop-blur-sm"
        aria-label="Close sign in"
        onClick={onClose}
      />
      <div
        className={cn(
          'experts-modal relative z-10 max-h-[92svh] w-full overflow-y-auto rounded-t-3xl border border-white/70 bg-white shadow-[0_32px_80px_-24px_rgba(7,16,31,0.55)] sm:rounded-3xl',
          wide ? 'sm:max-w-xl' : 'sm:max-w-md',
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-navy-950/6 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral-700">jobround.ai experts</p>
            <h2 id="auth-modal-title" className="mt-1 text-xl font-semibold tracking-tight text-navy-950">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-navy-950/5 hover:text-navy-950"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  )
}
