import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { PageHeader } from './primitives.tsx'

/** Shared ink banner for interviewer workspace pages. */
export function ExpertsPageHero({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'experts-rise relative overflow-hidden rounded-2xl border border-navy-950/8 bg-navy-950 px-5 py-6 text-white shadow-[0_24px_60px_-36px_rgba(7,16,31,0.5)] sm:px-7 sm:py-7',
        className,
      )}
    >
      <div
        aria-hidden
        className="experts-orb pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-coral-500/28 blur-2xl"
      />
      <div
        aria-hidden
        className="experts-orb pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-gold-400/15 blur-2xl [animation-delay:1.4s]"
      />
      <PageHeader inverted title={title} subtitle={subtitle} actions={actions} />
    </div>
  )
}
