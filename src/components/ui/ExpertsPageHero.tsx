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
        'experts-rise relative overflow-hidden rounded-2xl border border-navy-950/8 bg-gradient-to-br from-white via-coral-50/70 to-paper-deep/80 px-5 py-6 text-navy-950 shadow-[0_18px_44px_-30px_rgba(7,16,31,0.28)] sm:px-7 sm:py-7',
        className,
      )}
    >
      <div
        aria-hidden
        className="experts-orb pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-coral-500/18 blur-2xl"
      />
      <div
        aria-hidden
        className="experts-orb pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-gold-400/18 blur-2xl [animation-delay:1.4s]"
      />
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
    </div>
  )
}
