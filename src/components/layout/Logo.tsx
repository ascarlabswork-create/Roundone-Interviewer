import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'

export function Logo({
  className,
  compact = false,
  inverted = false,
  to = '/interviewer',
}: {
  className?: string
  compact?: boolean
  inverted?: boolean
  to?: string
}) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="jobround.ai home">
      <span
        className={cn(
          'relative grid h-9 w-9 place-items-center overflow-hidden rounded-2xl text-sm font-bold tracking-tight',
          inverted ? 'bg-white text-navy-950' : 'bg-navy-950 text-white',
        )}
      >
        <span className="absolute inset-x-0 top-0 h-1.5 bg-teal-500" aria-hidden />
        J
      </span>
      {compact ? null : (
        <span className="leading-none">
          <span
            className={cn(
              'block text-[1.05rem] font-semibold tracking-tight',
              inverted ? 'text-white' : 'text-navy-950',
            )}
          >
            jobround.ai
          </span>
          <span className={cn('mt-0.5 block text-[10px] font-medium tracking-[0.16em] uppercase', inverted ? 'text-white/70' : 'text-teal-700')}>
            Experts
          </span>
        </span>
      )}
    </Link>
  )
}
