import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { FeedbackAction } from '../components/interview/FeedbackAction.tsx'
import { JoinInterviewControls } from '../components/interview/JoinInterviewControls.tsx'
import { LiveBookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../components/ui/dashboard.tsx'
import { Card, EmptyState, ErrorState, FieldLabel, PageHeader, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { formatDateLongInZone, formatDateShortInZone, formatTimeInZone, timezoneLabel } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  BOOKING_ALREADY_UPDATED,
  bookingsForTab,
  canCancelBooking,
  canRescheduleBooking,
  cancelMyBooking,
  confirmBooking,
  isActionableBookingRequest,
  listMyBookableSlots,
  rejectBooking,
  rescheduleMyBooking,
  type BookableSlotRow,
  type InterviewerBooking,
  type InterviewerBookingTab,
} from '../services/interviewerBookings.ts'
import { loadMyInterviewBoard, type InterviewSessionRecord } from '../services/interviewSessions.ts'
import { useToast } from '../state/toast.tsx'

const tabs: InterviewerBookingTab[] = ['pending', 'upcoming', 'completed', 'cancelled']

function isBookingTab(value: string | null): value is InterviewerBookingTab {
  return value === 'pending' || value === 'upcoming' || value === 'completed' || value === 'cancelled'
}

const emptyCopy: Record<InterviewerBookingTab, { title: string; body: string }> = {
  pending: {
    title: 'No pending booking requests',
    body: 'When a candidate’s payment is captured, their request will appear here for you to accept or reject.',
  },
  upcoming: {
    title: 'No upcoming bookings',
    body: 'Confirmed interviews will show here.',
  },
  completed: {
    title: 'No completed bookings',
    body: 'Finished interviews will show here.',
  },
  cancelled: {
    title: 'No cancelled bookings',
    body: 'Rejected and cancelled bookings will show here.',
  },
}

export function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab: InterviewerBookingTab = isBookingTab(requestedTab) ? requestedTab : 'pending'
  const [detailId, setDetailId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<InterviewerBooking | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<BookableSlotRow[]>([])
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const { pushToast } = useToast()
  const state = useAsync(() => loadMyInterviewBoard(), [])

  const grouped = useMemo(() => {
    const items = state.status === 'success' ? state.data.bookings : []
    return {
      pending: bookingsForTab(items, 'pending'),
      upcoming: bookingsForTab(items, 'upcoming'),
      completed: bookingsForTab(items, 'completed'),
      cancelled: bookingsForTab(items, 'cancelled'),
    }
  }, [state])

  const rows = grouped[tab]
  const detail = state.status === 'success' ? state.data.bookings.find((item) => item.id === detailId) : undefined
  const sessions = state.status === 'success' ? state.data.sessions : new Map<string, InterviewSessionRecord>()
  const feedbackBookingIds = state.status === 'success' ? state.data.feedbackBookingIds : new Set<string>()

  async function runAction(id: string, action: () => Promise<unknown>, successMessage: string) {
    setActingId(id)
    try {
      await action()
      pushToast(successMessage)
      setRejectId(null)
      setRejectReason('')
      state.reload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not update this booking.'
      pushToast(message)
      if (message === BOOKING_ALREADY_UPDATED) state.reload()
    } finally {
      setActingId(null)
    }
  }

  async function onAccept(id: string) {
    await runAction(id, () => confirmBooking(id), 'Booking confirmed')
  }

  async function onCancelConfirm() {
    if (!cancelId) return
    const id = cancelId
    await runAction(id, () => cancelMyBooking(id), 'Booking cancelled')
    setCancelId(null)
  }

  async function loadRescheduleSlots(booking: InterviewerBooking, date: string) {
    setRescheduleLoading(true)
    try {
      const slots = await listMyBookableSlots(booking.serviceId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`)
      setRescheduleSlots(slots)
    } catch {
      setRescheduleSlots([])
    } finally {
      setRescheduleLoading(false)
    }
  }

  async function onReschedulePick(startsAtUtc: string) {
    if (!rescheduleFor) return
    const booking = rescheduleFor
    await runAction(
      booking.id,
      () => rescheduleMyBooking(booking.id, startsAtUtc, booking.displayTimezone),
      'Booking rescheduled',
    )
    setRescheduleFor(null)
  }

  async function onRejectConfirm() {
    if (!rejectId) return
    const id = rejectId
    await runAction(id, () => rejectBooking(id, rejectReason), 'Booking rejected')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" subtitle="Accept requests, join upcoming sessions, and close the loop with feedback." />
      <Tabs
        value={tab}
        onChange={(id) => {
          const next = new URLSearchParams(params)
          if (id === 'pending') next.delete('tab')
          else next.set('tab', id)
          setParams(next, { replace: true })
        }}
        items={tabs.map((item) => ({
          id: item,
          label: item[0].toUpperCase() + item.slice(1),
          count: grouped[item].length,
        }))}
      />

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && rows.length === 0 ? (
        <EmptyState title={emptyCopy[tab].title} body={emptyCopy[tab].body} />
      ) : null}

      {state.status === 'success' && rows.length > 0 ? (
        <>
          <DataTable
            headers={['Candidate', 'Service', 'Interview Type', 'Date', 'Time', 'Duration', 'Timezone', 'Status', '']}
          >
            {rows.map((booking) => (
              <TableRow key={booking.id}>
                <Td>
                  <CandidateSummary candidate={booking.candidate} />
                </Td>
                <Td>{booking.serviceName}</Td>
                <Td>{booking.interviewType}</Td>
                <Td>{formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                <Td>{formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                <Td>{booking.durationMin} minutes</Td>
                <Td>{timezoneLabel(booking.displayTimezone)}</Td>
                <Td>
                  <LiveBookingStatusBadge status={booking.status} />
                </Td>
                <Td>
                  <BookingActions
                    booking={booking}
                    actingId={actingId}
                    onAccept={onAccept}
                    onReject={() => {
                      setRejectId(booking.id)
                      setRejectReason('')
                    }}
                    onCancel={() => setCancelId(booking.id)}
                    onReschedule={() => {
                      const date = booking.startsAtUtc.slice(0, 10)
                      setRescheduleFor(booking)
                      setRescheduleDate(date)
                      void loadRescheduleSlots(booking, date)
                    }}
                    onDetails={() => setDetailId(booking.id)}
                    session={sessions.get(booking.id) ?? null}
                    hasFeedback={feedbackBookingIds.has(booking.id)}
                  />
                </Td>
              </TableRow>
            ))}
          </DataTable>

          <div className="space-y-3 lg:hidden">
            {rows.map((booking) => (
              <Card key={booking.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CandidateSummary candidate={booking.candidate} />
                    <p className="mt-1 text-sm text-slate-600">{booking.serviceName}</p>
                  </div>
                  <LiveBookingStatusBadge status={booking.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
                  {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} · {booking.durationMin} minutes ·{' '}
                  {timezoneLabel(booking.displayTimezone)}
                </p>
                <div className="mt-4">
                  <BookingActions
                    booking={booking}
                    stacked
                    actingId={actingId}
                    onAccept={onAccept}
                    onReject={() => {
                      setRejectId(booking.id)
                      setRejectReason('')
                    }}
                    onCancel={() => setCancelId(booking.id)}
                    onReschedule={() => {
                      const date = booking.startsAtUtc.slice(0, 10)
                      setRescheduleFor(booking)
                      setRescheduleDate(date)
                      void loadRescheduleSlots(booking, date)
                    }}
                    onDetails={() => setDetailId(booking.id)}
                    session={sessions.get(booking.id) ?? null}
                    hasFeedback={feedbackBookingIds.has(booking.id)}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SlideOver title="Booking details" open={Boolean(detail)} onClose={() => setDetailId(null)}>
        {detail ? (
          <BookingDetails
            booking={detail}
            session={sessions.get(detail.id) ?? null}
            hasFeedback={feedbackBookingIds.has(detail.id)}
          />
        ) : null}
      </SlideOver>

      <SlideOver
        title="Reject booking"
        open={Boolean(rejectId)}
        onClose={() => {
          if (actingId) return
          setRejectId(null)
          setRejectReason('')
        }}
      >
        <p className="text-sm text-slate-600">This will reject the request. Refunds are not processed in this step.</p>
        <div className="mt-4">
          <FieldLabel htmlFor="reject-reason">Reason (optional)</FieldLabel>
          <TextArea
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Let the candidate know why you cannot take this session."
          />
        </div>
        <Button className="mt-6" fullWidth onClick={() => void onRejectConfirm()} disabled={Boolean(actingId)}>
          {actingId ? 'Rejecting…' : 'Reject booking'}
        </Button>
      </SlideOver>

      <SlideOver
        title="Cancel booking"
        open={Boolean(cancelId)}
        onClose={() => {
          if (actingId) return
          setCancelId(null)
        }}
      >
        <p className="text-sm text-slate-600">
          This cancels the booking. Refunds and payouts are not processed here.
        </p>
        <Button className="mt-6" fullWidth variant="danger" onClick={() => void onCancelConfirm()} disabled={Boolean(actingId)}>
          {actingId ? 'Cancelling…' : 'Cancel booking'}
        </Button>
      </SlideOver>

      <SlideOver
        title="Reschedule booking"
        open={Boolean(rescheduleFor)}
        onClose={() => {
          if (actingId) return
          setRescheduleFor(null)
        }}
      >
        <p className="text-sm text-slate-600">
          Choose an open slot. The previous booking becomes rescheduled and is no longer actionable.
        </p>
        <div className="mt-4">
          <FieldLabel htmlFor="reschedule-date">Date</FieldLabel>
          <TextInput
            id="reschedule-date"
            type="date"
            value={rescheduleDate}
            onChange={(event) => {
              const next = event.target.value
              setRescheduleDate(next)
              if (rescheduleFor && next) void loadRescheduleSlots(rescheduleFor, next)
            }}
          />
        </div>
        <div className="mt-4 space-y-2">
          {rescheduleLoading ? <p className="text-sm text-slate-500">Loading open slots…</p> : null}
          {!rescheduleLoading && rescheduleSlots.length === 0 ? (
            <p className="text-sm text-slate-500">No open slots on this date.</p>
          ) : null}
          {rescheduleSlots.map((slot) => (
            <Button
              key={slot.startsAtUtc}
              size="sm"
              variant="outline"
              fullWidth
              disabled={Boolean(actingId)}
              onClick={() => void onReschedulePick(slot.startsAtUtc)}
            >
              {rescheduleFor
                ? `${formatTimeInZone(slot.startsAtUtc, rescheduleFor.displayTimezone)} – ${formatTimeInZone(slot.endsAtUtc, rescheduleFor.displayTimezone)}`
                : slot.startsAtUtc}
            </Button>
          ))}
        </div>
      </SlideOver>
    </div>
  )
}

function CandidateSummary({ candidate }: { candidate: InterviewerBooking['candidate'] }) {
  const roleLine = [candidate.targetRole, candidate.candidateLevel].filter(Boolean).join(' · ')
  return (
    <div>
      <p className="font-medium text-navy-950">{candidate.name}</p>
      {roleLine ? <p className="text-xs text-slate-500">{roleLine}</p> : null}
      {candidate.skills.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">{candidate.skills.join(', ')}</p>
      ) : null}
    </div>
  )
}

function BookingDetails({
  booking,
  session,
  hasFeedback,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord | null
  hasFeedback: boolean
}) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="text-slate-500">Status</span>
        <br />
        <LiveBookingStatusBadge status={booking.status} />
      </p>
      <p>
        <span className="text-slate-500">Candidate</span>
        <br />
        <CandidateSummary candidate={booking.candidate} />
      </p>
      <p>
        <span className="text-slate-500">Service</span>
        <br />
        <span className="font-medium text-navy-950">{booking.serviceName}</span>
      </p>
      <p>
        <span className="text-slate-500">Date</span>
        <br />
        <span className="font-medium text-navy-950">
          {formatDateLongInZone(booking.startsAtUtc, booking.displayTimezone)} ({timezoneLabel(booking.displayTimezone)})
        </span>
      </p>
      <p>
        <span className="text-slate-500">Time</span>
        <br />
        <span className="font-medium text-navy-950">
          {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} ({timezoneLabel(booking.displayTimezone)})
        </span>
      </p>
      <p>
        <span className="text-slate-500">Duration</span>
        <br />
        <span className="font-medium text-navy-950">{booking.durationMin} minutes</span>
      </p>
      {booking.status === 'rejected' && booking.rejectionReason ? (
        <p>
          <span className="text-slate-500">Rejection reason</span>
          <br />
          <span className="font-medium text-navy-950">{booking.rejectionReason}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 pt-2">
        <JoinInterviewControls booking={booking} session={session} size="md" />
        <FeedbackAction booking={booking} hasFeedback={hasFeedback} size="md" />
      </div>
    </div>
  )
}

function BookingActions({
  booking,
  stacked,
  actingId,
  session,
  hasFeedback,
  onAccept,
  onReject,
  onCancel,
  onReschedule,
  onDetails,
}: {
  booking: InterviewerBooking
  stacked?: boolean
  actingId: string | null
  session: InterviewSessionRecord | null
  hasFeedback: boolean
  onAccept: (id: string) => void
  onReject: () => void
  onCancel: () => void
  onReschedule: () => void
  onDetails: () => void
}) {
  const wrap = stacked ? 'flex flex-col gap-2' : 'flex flex-wrap justify-end gap-2'
  const busy = actingId === booking.id
  const locked = actingId !== null
  return (
    <div className={wrap}>
      <Button size="sm" variant="ghost" onClick={onDetails} disabled={locked}>
        Details
      </Button>
      {isActionableBookingRequest(booking) ? (
        <>
          <Button size="sm" onClick={() => onAccept(booking.id)} disabled={locked}>
            {busy ? 'Accepting…' : 'Accept'}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={locked}>
            Reject
          </Button>
        </>
      ) : (
        <JoinInterviewControls booking={booking} session={session} showWaiting={false} />
      )}
      {canRescheduleBooking(booking) ? (
        <Button size="sm" variant="ghost" onClick={onReschedule} disabled={locked}>
          Reschedule
        </Button>
      ) : null}
      {canCancelBooking(booking) ? (
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={locked}>
          Cancel
        </Button>
      ) : null}
      <FeedbackAction booking={booking} hasFeedback={hasFeedback} disabled={locked} />
    </div>
  )
}
