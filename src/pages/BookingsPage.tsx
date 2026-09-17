import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { JoinInterviewControls } from '../components/interview/JoinInterviewControls.tsx'
import { LiveBookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../components/ui/dashboard.tsx'
import { Card, EmptyState, ErrorState, FieldLabel, PageHeader, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { formatDateLongInZone, formatDateShortInZone, formatTimeInZone, timezoneLabel } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  BOOKING_ALREADY_UPDATED,
  bookingsForTab,
  confirmBooking,
  isActionableBookingRequest,
  rejectBooking,
  type InterviewerBooking,
  type InterviewerBookingTab,
} from '../services/interviewerBookings.ts'
import { loadMyInterviewBoard, type InterviewSessionRecord } from '../services/interviewSessions.ts'
import { useToast } from '../state/toast.tsx'

const tabs: InterviewerBookingTab[] = ['pending', 'upcoming', 'completed', 'cancelled']

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
  const [tab, setTab] = useState<InterviewerBookingTab>('pending')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
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
        onChange={(id) => setTab(id as InterviewerBookingTab)}
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
                    onDetails={() => setDetailId(booking.id)}
                    session={sessions.get(booking.id) ?? null}
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
                    onDetails={() => setDetailId(booking.id)}
                    session={sessions.get(booking.id) ?? null}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SlideOver title="Booking details" open={Boolean(detail)} onClose={() => setDetailId(null)}>
        {detail ? <BookingDetails booking={detail} session={sessions.get(detail.id) ?? null} /> : null}
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
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord | null
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
      <div className="pt-2">
        <JoinInterviewControls booking={booking} session={session} size="md" />
      </div>
    </div>
  )
}

function BookingActions({
  booking,
  stacked,
  actingId,
  session,
  onAccept,
  onReject,
  onDetails,
}: {
  booking: InterviewerBooking
  stacked?: boolean
  actingId: string | null
  session: InterviewSessionRecord | null
  onAccept: (id: string) => void
  onReject: () => void
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
    </div>
  )
}
