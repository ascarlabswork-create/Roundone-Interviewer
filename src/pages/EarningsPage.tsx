import { useState } from 'react'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { LiveBookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { MetricCard, Tabs } from '../components/ui/dashboard.tsx'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { formatDateShortInZone } from '../lib/dates.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  loadMyEarnings,
  type EarningsPeriod,
} from '../services/interviewerEarnings.ts'

const PERIODS: Array<{ id: EarningsPeriod; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3_months', label: 'Last 3 months' },
]

function formatPaise(paise: number) {
  return formatINR(Math.trunc(paise / 100))
}

export function EarningsPage() {
  const [period, setPeriod] = useState<EarningsPeriod>('all')
  const state = useAsync(() => loadMyEarnings(period), [period])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        subtitle="Completed interview session fees minus the stored platform fee. Payouts are not processed here."
      />

      {state.status === 'loading' ? <Skeleton className="h-40" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}

      {state.status === 'success' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Earnings" value={formatPaise(state.data.totalNetPaise)} hint="Completed interviews" />
            <MetricCard label="Completed Interviews" value={formatCount(state.data.completedCount)} />
            <MetricCard label="This Month" value={formatPaise(state.data.thisMonthNetPaise)} />
            <MetricCard
              label="Awaiting completion"
              value={formatPaise(state.data.unsettledNetPaise)}
              hint={
                state.data.unsettledCount
                  ? `${formatCount(state.data.unsettledCount)} paid booking${state.data.unsettledCount === 1 ? '' : 's'} not completed yet`
                  : 'No paid bookings waiting to complete'
              }
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-navy-950">Earnings History</h2>
            <Tabs
              items={PERIODS}
              value={period}
              onChange={(id) => setPeriod(id as EarningsPeriod)}
            />
          </div>

          {state.data.history.length === 0 ? (
            <EmptyState
              title={period === 'all' ? 'No earnings yet' : 'No earnings in this period'}
              body="Completed interviews will appear here. Pending payment, rejected, expired, and cancelled bookings are not counted."
            />
          ) : (
            <>
              <DataTable
                headers={[
                  'Date',
                  'Candidate',
                  'Service',
                  'Interview Type',
                  'Status',
                  'Session Fee',
                  'Platform Fee',
                  'Net Earnings',
                ]}
              >
                {state.data.history.map((item) => (
                  <TableRow key={item.bookingId}>
                    <Td>{formatDateShortInZone(item.startsAtUtc, state.data.timezone)}</Td>
                    <Td>{item.candidateName}</Td>
                    <Td>{item.serviceName}</Td>
                    <Td>{item.interviewType}</Td>
                    <Td>
                      <LiveBookingStatusBadge status={item.status} />
                    </Td>
                    <Td>{formatPaise(item.sessionFeePaise)}</Td>
                    <Td>{formatPaise(item.platformFeePaise)}</Td>
                    <Td className="font-medium text-navy-950">{formatPaise(item.netPaise)}</Td>
                  </TableRow>
                ))}
              </DataTable>
              <div className="space-y-3 lg:hidden">
                {state.data.history.map((item) => (
                  <Card key={item.bookingId} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-navy-950">{item.candidateName}</p>
                        <p className="text-sm text-slate-600">
                          {item.serviceName} · {item.interviewType}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDateShortInZone(item.startsAtUtc, state.data.timezone)}
                        </p>
                      </div>
                      <LiveBookingStatusBadge status={item.status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {formatPaise(item.sessionFeePaise)} − {formatPaise(item.platformFeePaise)} fee ={' '}
                      <strong>{formatPaise(item.netPaise)}</strong>
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}

          {state.data.months.length > 0 ? (
            <Card className="p-5">
              <h2 className="font-semibold text-navy-950">Monthly Earnings</h2>
              <RevenueChart data={state.data.months.map((month) => ({ label: month.label, amount: month.netPaise }))} />
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {state.data.months.map((month) => (
                  <li key={month.key} className="flex justify-between gap-3">
                    <span>
                      {month.label} · {formatCount(month.completedCount)} interview
                      {month.completedCount === 1 ? '' : 's'}
                    </span>
                    <span className="font-medium text-navy-950">{formatPaise(month.netPaise)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {state.data.services.length > 0 ? (
            <Card className="p-5">
              <h2 className="font-semibold text-navy-950">By Service</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {state.data.services.map((service) => (
                  <li key={service.serviceName} className="flex justify-between gap-3">
                    <span>
                      {service.serviceName} · {formatCount(service.completedCount)}
                    </span>
                    <span className="font-medium text-navy-950">{formatPaise(service.netPaise)}</span>
                  </li>
                ))}
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
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-md bg-navy-800"
            style={{ height: `${Math.max(8, (item.amount / max) * 100)}%` }}
            title={formatPaise(item.amount)}
          />
          <span className="truncate text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
