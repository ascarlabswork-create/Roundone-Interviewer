import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { acceptBooking, getAvailabilitySchedule, listBookings, rejectBooking, rescheduleBooking } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { BookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../components/ui/dashboard.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Card, EmptyState, ErrorState, FieldLabel, PageHeader, Skeleton, TextInput } from '../components/ui/primitives.tsx'
import { getCandidateById } from '../data/candidates.ts'
import { formatDateShort, formatTime, timezoneLabel } from '../lib/dates.ts'
import { isPrivateFeedbackSubmitted } from '../lib/feedback.ts'
import { bookingWindowSource } from '../lib/slots.ts'
import { useAsync } from '../lib/useAsync.ts'
import { useToast } from '../state/toast.tsx'
import type { Booking, BookingStatus } from '../types.ts'

const tabs: BookingStatus[] = ['pending', 'upcoming', 'completed', 'cancelled']

export function BookingsPage() {
  const [tab, setTab] = useState<BookingStatus>('pending')
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [when, setWhen] = useState('')
  const { pushToast } = useToast()
  const state = useAsync(() => listBookings(), [])
  const scheduleState = useAsync(() => getAvailabilitySchedule(), [])

  const grouped = useMemo(() => {
    const items = state.status === 'success' ? state.data : []
    return {
      pending: items.filter((item) => item.status === 'pending'),
      upcoming: items.filter((item) => item.status === 'upcoming'),
      completed: items.filter((item) => item.status === 'completed'),
      cancelled: items.filter((item) => item.status === 'cancelled'),
    }
  }, [state])

  const rows = grouped[tab]
  const detail = state.status === 'success' ? state.data.find((item) => item.id === detailId) : undefined
  const detailSource =
    detail && scheduleState.status === 'success' ? bookingWindowSource(scheduleState.data, detail) : null

  async function onAccept(id: string) {
    await acceptBooking(id)
    pushToast('Booking accepted')
    state.reload()
  }

  async function onReject(id: string) {
    await rejectBooking(id)
    pushToast('Booking declined')
    state.reload()
  }

  async function onReschedule() {
    if (!rescheduleId || !when) return
    await rescheduleBooking(rescheduleId, new Date(when).toISOString())
    pushToast('New time suggested and booking updated')
    setRescheduleId(null)
    state.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" subtitle="Accept requests, join upcoming sessions, and close the loop with feedback." />
      <Tabs
        value={tab}
        onChange={(id) => setTab(id as BookingStatus)}
        items={tabs.map((item) => ({
          id: item,
          label: item[0].toUpperCase() + item.slice(1),
          count: grouped[item].length,
        }))}
      />

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && rows.length === 0 ? (
        <EmptyState title={`No ${tab} bookings`} body="When candidates request time, they will land here." />
      ) : null}

      {state.status === 'success' && rows.length > 0 ? (
        <>
          <DataTable
            headers={['Candidate', 'Target Role', 'Target Company', 'Interview Type', 'Service', 'Date', 'Time', 'Timezone', 'Status', '']}
          >
            {rows.map((booking) => {
              const candidate = getCandidateById(booking.candidateId)
              return (
                <TableRow key={booking.id}>
                  <Td className="font-medium text-navy-950">{candidate?.name}</Td>
                  <Td>{candidate?.targetRole}</Td>
                  <Td>{candidate?.targetCompany}</Td>
                  <Td>{booking.interviewType}</Td>
                  <Td>{booking.serviceName}</Td>
                  <Td>{formatDateShort(booking.start)}</Td>
                  <Td>{formatTime(booking.start)}</Td>
                  <Td>{timezoneLabel(booking.timezone)}</Td>
                  <Td>
                    {booking.status === 'completed' ? (
                      <div className="space-y-2">
                        <BookingStatusBadge status={booking.status} />
                        <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
                        <p className="text-xs font-medium text-slate-600">
                          Candidate Feedback:{' '}
                          {isPrivateFeedbackSubmitted(booking) ? (
                            <span className="text-emerald-700">Submitted ✓</span>
                          ) : (
                            <span className="text-amber-700">Pending</span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <BookingStatusBadge status={booking.status} />
                    )}
                  </Td>
                  <Td>
                    <BookingActions
                      booking={booking}
                      onAccept={onAccept}
                      onReject={onReject}
                      onReschedule={() => setRescheduleId(booking.id)}
                      onDetails={() => setDetailId(booking.id)}
                    />
                  </Td>
                </TableRow>
              )
            })}
          </DataTable>

          <div className="space-y-3 lg:hidden">
            {rows.map((booking) => {
              const candidate = getCandidateById(booking.candidateId)
              return (
                <Card key={booking.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-950">{candidate?.name}</p>
                      <p className="text-sm text-slate-600">
                        {candidate?.targetRole} · {candidate?.targetCompany}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  {booking.status === 'completed' ? (
                    <div className="mt-3 space-y-2">
                      <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
                      <p className="text-sm font-medium text-slate-700">
                        Candidate Feedback:{' '}
                        {isPrivateFeedbackSubmitted(booking) ? (
                          <span className="text-emerald-700">Submitted ✓</span>
                        ) : (
                          <span className="text-amber-700">Pending</span>
                        )}
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-600">
                    {booking.serviceName} · {formatDateShort(booking.start)} · {formatTime(booking.start)} ·{' '}
                    {timezoneLabel(booking.timezone)}
                  </p>
                  <div className="mt-4">
                    <BookingActions
                      booking={booking}
                      stacked
                      onAccept={onAccept}
                      onReject={onReject}
                      onReschedule={() => setRescheduleId(booking.id)}
                      onDetails={() => setDetailId(booking.id)}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      ) : null}

      <SlideOver title="Booking details" open={Boolean(detail)} onClose={() => setDetailId(null)}>
        {detail ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-slate-500">Candidate</span>
              <br />
              <span className="font-medium text-navy-950">{getCandidateById(detail.candidateId)?.name}</span>
            </p>
            <p>
              <span className="text-slate-500">Service</span>
              <br />
              <span className="font-medium text-navy-950">{detail.serviceName}</span>
            </p>
            <p>
              <span className="text-slate-500">Date</span>
              <br />
              <span className="font-medium text-navy-950">{formatDateShort(detail.start)}</span>
            </p>
            <p>
              <span className="text-slate-500">Time</span>
              <br />
              <span className="font-medium text-navy-950">{formatTime(detail.start)}</span>
            </p>
            <p>
              <span className="text-slate-500">Timezone</span>
              <br />
              <span className="font-medium text-navy-950">{timezoneLabel(detail.timezone)}</span>
            </p>
            <p>
              <span className="text-slate-500">Booking status</span>
              <br />
              <BookingStatusBadge status={detail.status} />
            </p>
            {detailSource ? (
              <p className="text-xs text-slate-500">
                {detailSource === 'custom'
                  ? 'This session sits in a custom availability window.'
                  : 'This session sits in your weekly recurring availability.'}
              </p>
            ) : null}
          </div>
        ) : null}
      </SlideOver>

      <SlideOver title="Suggest a new time" open={Boolean(rescheduleId)} onClose={() => setRescheduleId(null)}>
        <FieldLabel htmlFor="when">New date and time</FieldLabel>
        <TextInput id="when" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
        <Button className="mt-6" fullWidth onClick={onReschedule}>
          Save new time
        </Button>
      </SlideOver>
    </div>
  )
}

function BookingActions({
  booking,
  stacked,
  onAccept,
  onReject,
  onReschedule,
  onDetails,
}: {
  booking: Booking
  stacked?: boolean
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onReschedule: () => void
  onDetails: () => void
}) {
  const wrap = stacked ? 'flex flex-col gap-2' : 'flex flex-wrap justify-end gap-2'
  return (
    <div className={wrap}>
      <Button size="sm" variant="ghost" onClick={onDetails}>
        Details
      </Button>
      {booking.status === 'pending' ? (
        <>
          <Button size="sm" onClick={() => onAccept(booking.id)}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject(booking.id)}>
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={onReschedule}>
            Reschedule
          </Button>
        </>
      ) : null}
      {booking.status === 'upcoming' ? (
        <>
          <Link to={`/interviewer/candidates/${booking.candidateId}`}>
            <Button size="sm" variant="outline">
              View
            </Button>
          </Link>
          <Link to={`/interviewer/interview/${booking.id}`}>
            <Button size="sm">Join Interview</Button>
          </Link>
        </>
      ) : null}
      {booking.status === 'completed' ? (
        <Link to={`/interviewer/feedback/${booking.id}`}>
          <Button size="sm" variant={isPrivateFeedbackSubmitted(booking) ? 'outline' : 'primary'}>
            {isPrivateFeedbackSubmitted(booking) ? 'View Submitted Feedback' : 'Give Feedback'}
          </Button>
        </Link>
      ) : null}
      {booking.status === 'cancelled' ? (
        <Link to={`/interviewer/candidates/${booking.candidateId}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      ) : null}
    </div>
  )
}
