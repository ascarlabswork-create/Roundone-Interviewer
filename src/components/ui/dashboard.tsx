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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className="text-navy-700">{icon}</span> : null}
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
            value === item.id ? 'bg-navy-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200',
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
              'rounded-lg border px-3 py-2 text-xs font-medium',
              active
                ? 'border-navy-950 bg-navy-950 text-white'
                : done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-500',
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
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
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
