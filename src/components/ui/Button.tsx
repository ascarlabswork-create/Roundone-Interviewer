import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'inverse'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

const variants = {
  primary:
    'bg-teal-700 text-white shadow-sm hover:bg-teal-600 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
  secondary:
    'bg-navy-950 text-white hover:bg-navy-800 disabled:bg-slate-300 disabled:text-slate-500',
  outline:
    'border border-navy-950/12 bg-white/80 text-navy-950 hover:border-teal-700/40 hover:bg-teal-50 hover:text-teal-700 disabled:text-slate-400',
  ghost: 'text-navy-800 hover:bg-navy-950/5 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300',
  /** For dark surfaces such as the interview room. */
  inverse:
    'border border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20 disabled:text-white/40 focus-visible:ring-offset-navy-950',
}

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
