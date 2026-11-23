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
          'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black tracking-tight shadow-sm',
          inverted ? 'bg-white text-navy-950' : 'bg-navy-950 text-coral-500',
        )}
      >
        jr
      </span>
      {compact ? null : (
        <span className={cn('text-lg font-semibold tracking-tight', inverted ? 'text-white' : 'text-navy-950')}>
          jobround.ai
          <span className={cn('ml-1.5 text-[11px] font-medium uppercase tracking-[0.14em]', inverted ? 'text-coral-100' : 'text-coral-700')}>
            experts
          </span>
        </span>
      )}
    </Link>
  )
}
