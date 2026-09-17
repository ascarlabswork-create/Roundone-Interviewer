import { useState } from 'react'
import { CalendarCheck, IndianRupee, Star, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAvailabilitySummary, listInterviewerReviews } from '../api/index.ts'
import { FeedbackAction } from '../components/interview/FeedbackAction.tsx'
import { JoinInterviewControls } from '../components/interview/JoinInterviewControls.tsx'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { LiveBookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { MetricCard } from '../components/ui/dashboard.tsx'
import { Avatar, StarRating } from '../components/ui/identity.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { currentInterviewer } from '../data/interviewer.ts'
import { completedWhenLabel, formatDateShortInZone, formatTimeInZone } from '../lib/dates.ts'
import { nextAvailableLabel, weeklyAvailableHours } from '../lib/slots.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  BOOKING_ALREADY_UPDATED,
  confirmBooking,
  rejectBooking,
} from '../services/interviewerBookings.ts'
import { loadMyInterviewBoard } from '../services/interviewSessions.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

export function DashboardPage() {
  const { account } = useSession()
  const { pushToast } = useToast()
  const liveBookings = useAsync(() => loadMyInterviewBoard(), [])
  const reviews = useAsync(() => listInterviewerReviews(currentInterviewer.id), [])
  const availability = useAsync(() => getAvailabilitySummary(), [])
  const [actingId, setActingId] = useState<string | null>(null)

  const upcoming =
    liveBookings.status === 'success'
      ? liveBookings.data.bookings.filter((item) => item.status === 'confirmed' || item.status === 'in_progress')
      : []
  const pending =
    liveBookings.status === 'success'
      ? liveBookings.data.bookings.filter((item) => item.status === 'requested')
      : []
  const sessions = liveBookings.status === 'success' ? liveBookings.data.sessions : undefined
  const feedbackQueue =
    liveBookings.status === 'success'
      ? liveBookings.data.bookings.filter(
          (item) => item.status === 'completed' && !liveBookings.data.feedbackBookingIds.has(item.id),
        )
      : []
  const recent = reviews.status === 'success' ? reviews.data.slice(0, 3) : []

  async function runBookingAction(id: string, action: () => Promise<unknown>, successMessage: string) {
    setActingId(id)
    try {
      await action()
      pushToast(successMessage)
      liveBookings.reload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not update this booking.'
      pushToast(message)
      if (message === BOOKING_ALREADY_UPDATED) liveBookings.reload()
    } finally {
      setActingId(null)
    }
  }

  async function onAccept(id: string) {
    await runBookingAction(id, () => confirmBooking(id), 'Booking confirmed')
  }

  async function onReject(id: string) {
    await runBookingAction(id, () => rejectBooking(id), 'Booking rejected')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-950">
          Welcome back, {account?.profile?.full_name?.split(' ')[0] ?? 'there'}!
        </h1>
        <p className="mt-1 text-sm text-slate-600">Here’s what needs attention in your interview practice today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Upcoming Interviews" value={String(upcoming.length)} hint="Confirmed" icon={<Video className="h-4 w-4" />} />
        <MetricCard
          label="Completed Interviews"
          value={formatCount(currentInterviewer.completedInterviews)}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <MetricCard label="Rating" value={`${currentInterviewer.rating}`} hint={`${formatCount(currentInterviewer.reviewCount)} reviews`} icon={<Star className="h-4 w-4" />} />
        <MetricCard label="This Month's Earnings" value={formatINR(48500)} icon={<IndianRupee className="h-4 w-4" />} />
      </div>

      <Card className="p-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950">Availability</h2>
          <p className="mt-2 text-sm text-slate-600">
            Next available:{' '}
            <span className="font-medium text-navy-950">
              {availability.status === 'success' ? nextAvailableLabel(availability.data.slots) : '…'}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Weekly availability:{' '}
            <span className="font-medium text-navy-950">
              {availability.status === 'success'
                ? `${weeklyAvailableHours(availability.data.schedule.recurring)} hours`
                : '…'}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Bookings: <span className="font-medium text-navy-950">{upcoming.length} upcoming</span>
          </p>
        </div>
        <Link to="/interviewer/calendar" className="mt-4 inline-block sm:mt-0">
          <Button>Manage Availability</Button>
        </Link>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-950">Upcoming interviews</h2>
          <Link to="/interviewer/bookings" className="text-sm font-medium text-blue-700">
            View all
          </Link>
        </div>
        {liveBookings.status === 'loading' ? <Skeleton className="h-40" /> : null}
        {liveBookings.status === 'error' ? <ErrorState body={liveBookings.error} onRetry={liveBookings.reload} /> : null}
        {liveBookings.status === 'success' && upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed interviews yet.</p>
        ) : null}
        {liveBookings.status === 'success' && upcoming.length > 0 ? (
          <>
            <DataTable headers={['Candidate', 'Interview Type', 'Service', 'Date', 'Time', 'Status', '']}>
              {upcoming.map((booking) => (
                <TableRow key={booking.id}>
                  <Td>
                    <p className="font-medium text-navy-950">{booking.candidate.name}</p>
                    {booking.candidate.targetRole || booking.candidate.candidateLevel ? (
                      <p className="text-xs text-slate-500">
                        {[booking.candidate.targetRole, booking.candidate.candidateLevel].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {booking.candidate.skills.length > 0 ? (
                      <p className="text-xs text-slate-500">{booking.candidate.skills.join(', ')}</p>
                    ) : null}
                  </Td>
                  <Td>{booking.interviewType}</Td>
                  <Td>{booking.serviceName}</Td>
                  <Td>{formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                  <Td>{formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                  <Td>
                    <LiveBookingStatusBadge status={booking.status} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <JoinInterviewControls
                        booking={booking}
                        session={sessions?.get(booking.id)}
                        showWaiting={false}
                      />
                      <Link to="/interviewer/bookings">
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>
                    </div>
                  </Td>
                </TableRow>
              ))}
            </DataTable>
            <div className="mt-4 space-y-3 lg:hidden">
              {upcoming.map((booking) => (
                <Card key={booking.id} className="p-4">
                  <p className="font-semibold text-navy-950">{booking.candidate.name}</p>
                  {booking.candidate.targetRole || booking.candidate.candidateLevel ? (
                    <p className="text-xs text-slate-500">
                      {[booking.candidate.targetRole, booking.candidate.candidateLevel].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  {booking.candidate.skills.length > 0 ? (
                    <p className="text-xs text-slate-500">{booking.candidate.skills.join(', ')}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-600">
                    {booking.serviceName} · {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
                    {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <JoinInterviewControls
                      booking={booking}
                      session={sessions?.get(booking.id)}
                      showWaiting={false}
                    />
                    <Link to="/interviewer/bookings" className="flex-1">
                      <Button size="sm" variant="outline" fullWidth>
                        View
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Feedback Pending</h2>
            <div className="mt-1">
              <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
            </div>
          </div>
        </div>
        {liveBookings.status === 'loading' ? <Skeleton className="h-24" /> : null}
        {liveBookings.status === 'error' ? <ErrorState body={liveBookings.error} onRetry={liveBookings.reload} /> : null}
        {liveBookings.status === 'success' && feedbackQueue.length === 0 ? (
          <p className="text-sm text-slate-500">No private candidate feedback waiting.</p>
        ) : null}
        <div className="grid gap-3">
          {feedbackQueue.map((booking) => (
            <Card key={booking.id} className="p-4 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-navy-950">{booking.candidate.name}</p>
                <p className="mt-1 text-sm text-slate-600">{booking.serviceName}</p>
                <p className="mt-1 text-xs text-slate-500">{completedWhenLabel(booking.startsAtUtc)}</p>
                <p className="mt-2 text-sm font-medium text-amber-800">Candidate Feedback: Pending</p>
              </div>
              <div className="mt-3 sm:mt-0">
                <FeedbackAction booking={booking} hasFeedback={false} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-950">Booking requests</h2>
          <p className="text-sm text-slate-500">{pending.length} pending</p>
        </div>
        {liveBookings.status === 'loading' ? <Skeleton className="h-24" /> : null}
        {liveBookings.status === 'error' ? <ErrorState body={liveBookings.error} onRetry={liveBookings.reload} /> : null}
        {liveBookings.status === 'success' && pending.length === 0 ? (
          <p className="text-sm text-slate-500">No pending requests.</p>
        ) : null}
        <div className="grid gap-3">
          {pending.map((booking) => (
            <Card key={booking.id} className="p-4 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar src="" name={booking.candidate.name} size="sm" />
                <div>
                  <p className="font-medium text-navy-950">{booking.candidate.name}</p>
                  {booking.candidate.targetRole || booking.candidate.candidateLevel ? (
                    <p className="text-xs text-slate-500">
                      {[booking.candidate.targetRole, booking.candidate.candidateLevel].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  {booking.candidate.skills.length > 0 ? (
                    <p className="text-xs text-slate-500">{booking.candidate.skills.join(', ')}</p>
                  ) : null}
                  <p className="text-sm text-slate-600">
                    {booking.serviceName} · {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)}{' '}
                    {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                <Button size="sm" onClick={() => void onAccept(booking.id)} disabled={actingId !== null}>
                  {actingId === booking.id ? 'Accepting…' : 'Accept'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onReject(booking.id)}
                  disabled={actingId !== null}
                >
                  Reject
                </Button>
                <Link to="/interviewer/bookings">
                  <Button size="sm" variant="ghost">
                    Details
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Recent reviews</h2>
            <div className="mt-1">
              <VisibilityLabel visibility="public" topic="Candidate Review" />
            </div>
          </div>
          <Link to="/interviewer/reviews" className="text-sm font-medium text-blue-700">
            All reviews
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {recent.map((review) => (
            <Card key={review.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-navy-950">{review.publicDisplayName}</p>
                <StarRating value={review.rating} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">“{review.text}”</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
