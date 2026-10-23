import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export function MetricCard({
  label,
  value,
  hint,
  icon,
  loading,
}: {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  loading?: boolean
}) {
  return (
    <div className="rounded-3xl border border-navy-950/8 bg-white/85 p-4 shadow-[0_18px_40px_-24px_rgb(12_28_46/0.28)] backdrop-blur-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className="rounded-full bg-teal-50 p-2 text-teal-700">{icon}</span> : null}
      </div>
      {loading ? (
        <>
          <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-slate-200" />
          <div className="mt-1 h-3 w-20 animate-pulse rounded bg-slate-200" />
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-navy-950">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </>
      )}
    </div>
  )
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: string; label: string; count?: number }>
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium',
            value === item.id ? 'bg-teal-700 text-white shadow-sm' : 'bg-white/80 text-slate-600 ring-1 ring-navy-950/10',
          )}
        >
          {item.label}
          {typeof item.count === 'number' ? <span className="ml-1.5 opacity-80">{item.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  steps,
  current,
}: {
  steps: Array<{ id: string; label: string }>
  current: number
}) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((step, index) => {
        const active = index === current
        const done = index < current
        return (
          <li
            key={step.id}
            className={cn(
              'rounded-2xl border px-3 py-2 text-xs font-medium',
              active
                ? 'border-teal-700 bg-teal-700 text-white'
                : done
                  ? 'border-teal-200 bg-teal-50 text-teal-800'
                  : 'border-navy-950/10 bg-white/80 text-slate-500',
            )}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-80">
              {String(index + 1).padStart(2, '0')}
            </span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}

export function SlideOver({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" className="flex-1 bg-navy-950/40" aria-label="Close panel" onClick={onClose} />
      <aside className="h-full w-full max-w-lg overflow-y-auto rounded-l-3xl bg-white p-6 shadow-[0_24px_60px_-20px_rgb(12_28_46/0.4)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-navy-950">{title}</h2>
          <button type="button" className="text-sm font-medium text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
