import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export function DataTable({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-navy-950/8 bg-white/95 shadow-[0_18px_44px_-30px_rgba(7,16,31,0.35)] lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-navy-950 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <tr className={cn('bg-white hover:bg-paper', className)}>{children}</tr>
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-slate-700', className)}>{children}</td>
}
