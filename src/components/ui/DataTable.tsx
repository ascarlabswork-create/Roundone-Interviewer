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
    <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
  return <tr className={cn('bg-white hover:bg-slate-50', className)}>{children}</tr>
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-slate-700', className)}>{children}</td>
}
