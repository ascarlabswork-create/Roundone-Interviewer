import { useState } from 'react'
import { getEarnings } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { PayoutBadge } from '../components/ui/StatusBadge.tsx'
import { MetricCard } from '../components/ui/dashboard.tsx'
import { Card, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { getCandidateById } from '../data/candidates.ts'
import { formatDateShort } from '../lib/dates.ts'
import { formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

export function EarningsPage() {
  const state = useAsync(() => getEarnings(), [])
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        subtitle="Mock payouts only. No real money moves in this prototype."
        actions={<Button onClick={() => setHistoryOpen(true)}>View Payout History</Button>}
      />

      {state.status === 'loading' ? <Skeleton className="h-40" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}

      {state.status === 'success' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Today" value={formatINR(state.data.summary.today)} />
            <MetricCard label="This Week" value={formatINR(state.data.summary.thisWeek)} />
            <MetricCard label="This Month" value={formatINR(state.data.summary.thisMonth)} />
            <MetricCard label="Total Earnings" value={formatINR(state.data.summary.total)} />
          </div>

          <Card className="p-5">
            <h2 className="font-semibold text-navy-950">Revenue</h2>
            <RevenueChart data={state.data.summary.weekly} />
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-navy-950">Transactions</h2>
            <DataTable headers={['Date', 'Candidate', 'Service', 'Amount', 'Platform Fee', 'Net Earnings', 'Payout Status']}>
              {state.data.transactions.map((item) => (
                <TableRow key={item.id}>
                  <Td>{formatDateShort(item.date)}</Td>
                  <Td>{getCandidateById(item.candidateId)?.name ?? 'Candidate'}</Td>
                  <Td>{item.serviceName}</Td>
                  <Td>{formatINR(item.amount)}</Td>
                  <Td>{formatINR(item.platformFee)}</Td>
                  <Td className="font-medium text-navy-950">{formatINR(item.netEarnings)}</Td>
                  <Td>
                    <PayoutBadge status={item.payoutStatus} />
                  </Td>
                </TableRow>
              ))}
            </DataTable>
            <div className="mt-3 space-y-3 lg:hidden">
              {state.data.transactions.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-navy-950">{getCandidateById(item.candidateId)?.name}</p>
                      <p className="text-sm text-slate-600">{item.serviceName}</p>
                    </div>
                    <PayoutBadge status={item.payoutStatus} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {formatINR(item.amount)} − {formatINR(item.platformFee)} fee ={' '}
                    <strong>{formatINR(item.netEarnings)}</strong>
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {historyOpen ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-navy-950">Payout history</h2>
                <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(false)}>
                  Close
                </Button>
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between">
                  <span>1 Sep 2026 · Bank transfer</span>
                  <span className="font-medium text-emerald-700">₹46,200 completed</span>
                </li>
                <li className="flex justify-between">
                  <span>1 Aug 2026 · UPI</span>
                  <span className="font-medium text-emerald-700">₹41,800 completed</span>
                </li>
                <li className="flex justify-between">
                  <span>Next cycle · pending</span>
                  <span className="font-medium text-amber-700">₹1,710 pending</span>
                </li>
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function RevenueChart({ data }: { data: Array<{ label: string; amount: number }> }) {
  const max = Math.max(...data.map((item) => item.amount), 1)
  return (
    <div className="mt-6 flex h-48 items-end gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-md bg-navy-800"
            style={{ height: `${Math.max(8, (item.amount / max) * 100)}%` }}
            title={formatINR(item.amount)}
          />
          <span className="text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
