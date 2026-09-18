import { useState } from 'react'
import { AdminPager } from '../../components/admin/AdminPager.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../../components/ui/DataTable.tsx'
import { LiveBookingStatusBadge } from '../../components/ui/StatusBadge.tsx'
import { Tabs } from '../../components/ui/dashboard.tsx'
import { Badge, Card, ErrorState, PageHeader, Skeleton, TextInput } from '../../components/ui/primitives.tsx'
import { formatDateShortInZone, formatTimeInZone } from '../../lib/dates.ts'
import { useAsync } from '../../lib/useAsync.ts'
import {
  listAdminBookings,
  type AdminBookingFilter,
} from '../../services/adminOperations.ts'
import type { DbBookingStatus } from '../../services/interviewerBookings.ts'

const FILTERS: Array<{ id: AdminBookingFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Requested' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function isBookingStatus(value: string): value is DbBookingStatus {
  return [
    'pending_payment',
    'requested',
    'confirmed',
    'rejected',
    'cancelled',
    'expired',
    'rescheduled',
    'in_progress',
    'completed',
    'no_show',
  ].includes(value)
}

export function AdminBookingsPage() {
  const [status, setStatus] = useState<AdminBookingFilter>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const state = useAsync(() => listAdminBookings({ status, search: appliedSearch, page }), [status, appliedSearch, page])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking oversight"
        subtitle="Read-only operational view. Payments, refunds, and status overrides are not available here."
      />
      <Tabs
        items={FILTERS}
        value={status}
        onChange={(id) => {
          setStatus(id as AdminBookingFilter)
          setPage(1)
        }}
      />
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          setAppliedSearch(search)
          setPage(1)
        }}
      >
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search booking ID, name, or service"
        />
        <Button type="submit">Search</Button>
      </form>

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No bookings in this view.</p>
      ) : null}
      {state.status === 'success' && state.data.items.length > 0 ? (
        <>
          <DataTable
            headers={['Booking ID', 'Candidate', 'Interviewer', 'Service', 'Scheduled', 'Status', 'Payment', 'Session']}
          >
            {state.data.items.map((row) => (
              <TableRow key={row.id}>
                <Td>
                  <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>
                </Td>
                <Td>{row.candidateName}</Td>
                <Td>{row.interviewerName}</Td>
                <Td>
                  {row.serviceName}
                  {row.interviewType ? ` · ${row.interviewType}` : ''}
                </Td>
                <Td>
                  {formatDateShortInZone(row.startsAtUtc, row.displayTimezone)}{' '}
                  {formatTimeInZone(row.startsAtUtc, row.displayTimezone)}
                </Td>
                <Td>
                  {isBookingStatus(row.status) ? <LiveBookingStatusBadge status={row.status} /> : row.status}
                </Td>
                <Td>{row.paymentStatus ? <Badge>{row.paymentStatus}</Badge> : '—'}</Td>
                <Td>{row.sessionStatus ?? '—'}</Td>
              </TableRow>
            ))}
          </DataTable>
          <div className="space-y-3 lg:hidden">
            {state.data.items.map((row) => (
              <Card key={row.id} className="p-4">
                <p className="font-mono text-xs text-slate-500">{row.id}</p>
                <p className="mt-2 font-semibold text-navy-950">{row.candidateName}</p>
                <p className="text-sm text-slate-600">with {row.interviewerName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {row.serviceName} · {formatDateShortInZone(row.startsAtUtc, row.displayTimezone)}{' '}
                  {formatTimeInZone(row.startsAtUtc, row.displayTimezone)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isBookingStatus(row.status) ? <LiveBookingStatusBadge status={row.status} /> : null}
                  {row.paymentStatus ? <Badge>{row.paymentStatus}</Badge> : null}
                  {row.sessionStatus ? <Badge tone="blue">{row.sessionStatus}</Badge> : null}
                </div>
              </Card>
            ))}
          </div>
          <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onPage={setPage} />
        </>
      ) : null}
    </div>
  )
}
