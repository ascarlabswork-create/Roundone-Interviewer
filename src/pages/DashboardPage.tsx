import { useState } from 'react'
import {
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  IndianRupee,
  Star,
  Video,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { FeedbackAction } from '../components/interview/FeedbackAction.tsx'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { LiveBookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { MetricCard } from '../components/ui/dashboard.tsx'
import { Avatar, StarRating } from '../components/ui/identity.tsx'
import { Badge, Card, Skeleton } from '../components/ui/primitives.tsx'
import { completedWhenLabel, formatDateShortInZone, formatTimeInZone } from '../lib/dates.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { loadMyAvailabilityBoard } from '../services/interviewerAvailability.ts'
import {
  BOOKING_ALREADY_UPDATED,
  confirmBooking,
  rejectBooking,
  type InterviewerBooking,
} from '../services/interviewerBookings.ts'
import {
  activeServiceCount,
  buildDashboardAttentionItems,
  completedInterviewCount,
  interviewSessionStatusLabel,
  isAvailabilityConfigured,
  pendingBookingRequests,
  recentCompletedInterviews,
  upcomingInterviewCount,
  upcomingInterviews,
  verificationSummary,
} from '../services/interviewerDashboard.ts'
import { loadMyEarnings } from '../services/interviewerEarnings.ts'
import { isProfileSetupComplete } from '../services/interviewerProfile.ts'
import {
  formatNotificationTime,
  listMyNotifications,
  countMyUnreadNotifications,
  markNotificationRead,
  notificationHref,
} from '../services/interviewerNotifications.ts'
import { getMyServices } from '../services/interviewerServices.ts'
import { loadMyInterviewBoard } from '../services/interviewSessions.ts'
import { loadMyPublicReviewSummary } from '../services/interviewerReviews.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

const UPCOMING_HEADERS = ['Candidate', 'Role', 'Service', 'Type', 'Date', 'Time', 'Duration', 'Session', '']
const COMPLETED_HEADERS = ['Candidate', 'Service', 'Interview date', 'Status', 'Feedback', '']

function formatPaise(paise: number) {
  return formatINR(Math.trunc(paise / 100))
}

function SectionError({ body, onRetry }: { body: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {body}{' '}
      <button type="button" className="font-semibold underline" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

function CandidateBlock({ booking }: { booking: InterviewerBooking }) {
  const roleLine = [booking.candidate.targetRole, booking.candidate.candidateLevel].filter(Boolean).join(' · ')
  return (
    <div>
      <p className="font-medium text-navy-950">{booking.candidate.name}</p>
      {roleLine ? <p className="text-xs text-slate-500">{roleLine}</p> : null}
      {booking.candidate.skills.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">{booking.candidate.skills.join(', ')}</p>
      ) : null}
    </div>
  )
}

function dashboardSectionError(fallback: string) {
  return (caught: unknown): never => {
    if (caught instanceof Error && /sign in/i.test(caught.message)) throw caught
    throw new Error(fallback)
  }
}

export function DashboardPage() {
  const { account } = useSession()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const board = useAsync(() => loadMyInterviewBoard(), [])
  const earnings = useAsync(() => loadMyEarnings('all'), [])
  const services = useAsync(
    () =>
      getMyServices().catch(
        dashboardSectionError('Could not load services. Check your connection and try again.'),
      ),
    [],
  )
  const availability = useAsync(
    () =>
      loadMyAvailabilityBoard().catch(
        dashboardSectionError('Could not load availability. Check your connection and try again.'),
      ),
    [],
  )
  const reviews = useAsync(() => loadMyPublicReviewSummary(), [])
  const notifications = useAsync(async () => {
    const [items, unreadCount] = await Promise.all([listMyNotifications(4), countMyUnreadNotifications()])
    return { items, unreadCount }
  }, [])
  const [actingId, setActingId] = useState<string | null>(null)

  const bookings = board.status === 'success' ? board.data.bookings : []
  const sessions = board.status === 'success' ? board.data.sessions : undefined
  const feedbackBookingIds = board.status === 'success' ? board.data.feedbackBookingIds : undefined
  const upcoming = board.status === 'success' ? upcomingInterviews(bookings) : []
  const pending = board.status === 'success' ? pendingBookingRequests(bookings) : []
  const completed = board.status === 'success' ? recentCompletedInterviews(bookings) : []
  const completedCount = board.status === 'success' ? completedInterviewCount(bookings) : null

  const attention =
    account &&
    buildDashboardAttentionItems({
      account,
      bookings: board.status === 'success' ? bookings : undefined,
      sessions,
      feedbackBookingIds,
      services: services.status === 'success' ? services.data : undefined,
      availability: availability.status === 'success' ? availability.data : undefined,
    })

  async function runBookingAction(id: string, action: () => Promise<unknown>, successMessage: string) {
    setActingId(id)
    try {
      await action()
      pushToast(successMessage)
      board.reload()
      earnings.reload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not update this booking.'
      pushToast(message)
      if (message === BOOKING_ALREADY_UPDATED) board.reload()
    } finally {
      setActingId(null)
    }
  }

  async function onConfirm(id: string) {
    await runBookingAction(id, () => confirmBooking(id), 'Booking confirmed')
  }

  async function onReject(id: string) {
    await runBookingAction(id, () => rejectBooking(id), 'Booking rejected')
  }

  const firstName = account?.profile?.full_name?.split(' ')[0] ?? 'there'
  const verification = account ? verificationSummary(account.verifications) : null
  const profileComplete = account ? isProfileSetupComplete(account) : false

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-950">Welcome back, {firstName}!</h1>
        <p className="mt-1 text-sm text-slate-600">Your interview operations for today.</p>
      </div>

      {attention && attention.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-navy-950">Needs Attention</h2>
          <div className="grid gap-3">
            {attention.map((item) => (
              <Card key={item.id} className="p-4 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-navy-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </div>
                <Link to={item.href} className="mt-3 inline-block sm:mt-0">
                  <Button size="sm">{item.actionLabel}</Button>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Upcoming Interviews"
          value={board.status === 'success' ? String(upcomingInterviewCount(bookings)) : '—'}
          hint={board.status === 'error' ? 'Could not load' : 'Confirmed'}
          icon={<Video className="h-4 w-4" />}
          loading={board.status === 'loading'}
        />
        <MetricCard
          label="Pending Booking Requests"
          value={board.status === 'success' ? String(pending.length) : '—'}
          hint={board.status === 'error' ? 'Could not load' : 'Awaiting confirmation'}
          icon={<ClipboardList className="h-4 w-4" />}
          loading={board.status === 'loading'}
        />
        <MetricCard
          label="Completed Interviews"
          value={
            completedCount !== null
              ? formatCount(completedCount)
              : earnings.status === 'success'
                ? formatCount(earnings.data.completedCount)
                : '—'
          }
          hint={board.status === 'error' && earnings.status === 'error' ? 'Could not load' : undefined}
          icon={<CalendarCheck className="h-4 w-4" />}
          loading={board.status === 'loading' && earnings.status === 'loading'}
        />
        <MetricCard
          label="Total Earnings"
          value={earnings.status === 'success' ? formatPaise(earnings.data.totalNetPaise) : '—'}
          hint={
            earnings.status === 'error'
              ? 'Could not load'
              : earnings.status === 'success'
                ? `This month ${formatPaise(earnings.data.thisMonthNetPaise)}`
                : undefined
          }
          icon={<IndianRupee className="h-4 w-4" />}
          loading={earnings.status === 'loading'}
        />
        <MetricCard
          label="Average Public Rating"
          value={
            reviews.status === 'success'
              ? reviews.data.averageRating
                ? reviews.data.averageRating.toFixed(1)
                : '—'
              : '—'
          }
          hint={
            reviews.status === 'error'
              ? 'Could not load'
              : reviews.status === 'success'
                ? `${formatCount(reviews.data.count)} public review${reviews.data.count === 1 ? '' : 's'}`
                : undefined
          }
          icon={<Star className="h-4 w-4" />}
          loading={reviews.status === 'loading'}
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-950">Pending booking requests</h2>
          <Link to="/interviewer/bookings" className="text-sm font-medium text-blue-700">
            View Bookings
          </Link>
        </div>
        {board.status === 'loading' ? <Skeleton className="h-28" /> : null}
        {board.status === 'error' ? <SectionError body={board.error} onRetry={board.reload} /> : null}
        {board.status === 'success' && pending.length === 0 ? (
          <p className="text-sm text-slate-500">No pending booking requests</p>
        ) : null}
        {board.status === 'success' && pending.length > 0 ? (
          <div className="grid gap-3">
            {pending.map((booking) => (
              <Card key={booking.id} className="p-4 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Avatar src="" name={booking.candidate.name} size="sm" />
                  <div>
                    <CandidateBlock booking={booking} />
                    <p className="mt-1 text-sm text-slate-600">
                      {booking.serviceName} · {booking.interviewType} · {booking.durationMin} min
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)}{' '}
                      {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}
                    </p>
                    <div className="mt-2">
                      <LiveBookingStatusBadge status={booking.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                  <Button size="sm" onClick={() => void onConfirm(booking.id)} disabled={actingId !== null}>
                    {actingId === booking.id ? 'Confirming…' : 'Confirm'}
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
                      View
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-950">Upcoming interviews</h2>
          <Link to="/interviewer/bookings?tab=upcoming" className="text-sm font-medium text-blue-700">
            View all
          </Link>
        </div>
        {board.status === 'loading' ? <Skeleton className="h-40" /> : null}
        {board.status === 'error' ? <SectionError body={board.error} onRetry={board.reload} /> : null}
        {board.status === 'success' && upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming interviews</p>
        ) : null}
        {board.status === 'success' && upcoming.length > 0 ? (
          <>
            <DataTable headers={UPCOMING_HEADERS}>
              {upcoming.map((booking) => {
                const session = sessions?.get(booking.id)
                const sessionLabel = interviewSessionStatusLabel(booking, session)
                return (
                  <TableRow key={booking.id}>
                    <Td>
                      <CandidateBlock booking={booking} />
                    </Td>
                    <Td>{booking.candidate.targetRole ?? '—'}</Td>
                    <Td>{booking.serviceName}</Td>
                    <Td>{booking.interviewType}</Td>
                    <Td>{formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                    <Td>{formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                    <Td>{booking.durationMin} min</Td>
                    <Td>{sessionLabel ?? '—'}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <Link to={`/interviewer/interview/${booking.id}`}>
                          <Button size="sm">Open Interview</Button>
                        </Link>
                      </div>
                    </Td>
                  </TableRow>
                )
              })}
            </DataTable>
            <div className="mt-4 space-y-3 lg:hidden">
              {upcoming.map((booking) => {
                const session = sessions?.get(booking.id)
                const sessionLabel = interviewSessionStatusLabel(booking, session)
                return (
                  <Card key={booking.id} className="p-4">
                    <CandidateBlock booking={booking} />
                    <p className="mt-1 text-sm text-slate-600">
                      {booking.serviceName} · {booking.interviewType} · {booking.durationMin} min
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
                      {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}
                    </p>
                    {sessionLabel ? <p className="mt-1 text-xs text-slate-500">{sessionLabel}</p> : null}
                    <div className="mt-3">
                      <Link to={`/interviewer/interview/${booking.id}`}>
                        <Button size="sm">Open Interview</Button>
                      </Link>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Recent completed interviews</h2>
            <div className="mt-1">
              <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
            </div>
          </div>
          <Link to="/interviewer/bookings?tab=completed" className="text-sm font-medium text-blue-700">
            View all
          </Link>
        </div>
        {board.status === 'loading' ? <Skeleton className="h-28" /> : null}
        {board.status === 'error' ? <SectionError body={board.error} onRetry={board.reload} /> : null}
        {board.status === 'success' && completed.length === 0 ? (
          <p className="text-sm text-slate-500">No completed interviews yet</p>
        ) : null}
        {board.status === 'success' && completed.length > 0 ? (
          <>
            <DataTable headers={COMPLETED_HEADERS}>
              {completed.map((booking) => (
                <TableRow key={booking.id}>
                  <Td>
                    <p className="font-medium text-navy-950">{booking.candidate.name}</p>
                  </Td>
                  <Td>{booking.serviceName}</Td>
                  <Td>{formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)}</Td>
                  <Td>
                    <LiveBookingStatusBadge status={booking.status} />
                  </Td>
                  <Td>
                    {feedbackBookingIds?.has(booking.id) ? 'Submitted' : 'Not submitted'}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <FeedbackAction
                        booking={booking}
                        hasFeedback={Boolean(feedbackBookingIds?.has(booking.id))}
                      />
                    </div>
                  </Td>
                </TableRow>
              ))}
            </DataTable>
            <div className="mt-4 space-y-3 lg:hidden">
              {completed.map((booking) => (
                <Card key={booking.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-navy-950">{booking.candidate.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{booking.serviceName}</p>
                    <p className="mt-1 text-xs text-slate-500">{completedWhenLabel(booking.startsAtUtc)}</p>
                    <div className="mt-2">
                      <LiveBookingStatusBadge status={booking.status} />
                    </div>
                  </div>
                  <FeedbackAction
                    booking={booking}
                    hasFeedback={Boolean(feedbackBookingIds?.has(booking.id))}
                  />
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Earnings</h2>
              <p className="mt-1 text-sm text-slate-600">Completed session fees minus the stored platform fee.</p>
            </div>
            <Link to="/interviewer/earnings">
              <Button size="sm" variant="outline">
                View Earnings
              </Button>
            </Link>
          </div>
          {earnings.status === 'loading' ? <Skeleton className="mt-4 h-24" /> : null}
          {earnings.status === 'error' ? <div className="mt-4"><SectionError body={earnings.error} onRetry={earnings.reload} /></div> : null}
          {earnings.status === 'success' && earnings.data.completedCount === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No earnings yet</p>
          ) : null}
          {earnings.status === 'success' && earnings.data.completedCount > 0 ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Total Earnings</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">{formatPaise(earnings.data.totalNetPaise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">This Month</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">{formatPaise(earnings.data.thisMonthNetPaise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Completed Interviews</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">{formatCount(earnings.data.completedCount)}</dd>
              </div>
            </dl>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Reviews</h2>
              <div className="mt-1">
                <VisibilityLabel visibility="public" topic="Candidate Review" />
              </div>
            </div>
            <Link to="/interviewer/reviews">
              <Button size="sm" variant="outline">
                View Reviews
              </Button>
            </Link>
          </div>
          {reviews.status === 'loading' ? <Skeleton className="mt-4 h-24" /> : null}
          {reviews.status === 'error' ? <div className="mt-4"><SectionError body={reviews.error} onRetry={reviews.reload} /></div> : null}
          {reviews.status === 'success' && reviews.data.count === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No public reviews yet</p>
          ) : null}
          {reviews.status === 'success' && reviews.data.count > 0 ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-2xl font-semibold text-navy-950">{reviews.data.averageRating?.toFixed(1)}</p>
                <div>
                  <StarRating value={reviews.data.averageRating ?? 0} />
                  <p className="text-xs text-slate-500">
                    {formatCount(reviews.data.count)} approved public review{reviews.data.count === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              {reviews.data.recent.map((review) => (
                <div key={review.id} className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy-950">{review.displayName}</p>
                    <StarRating value={review.overallRating} />
                  </div>
                  {review.writtenReview ? (
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">“{review.writtenReview}”</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-navy-950">Setup status</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-slate-500">Profile</p>
            <p className="mt-2 font-semibold text-navy-950">{profileComplete ? 'Completed' : 'Incomplete'}</p>
            <Link to="/interviewer/profile" className="mt-3 inline-block">
              <Button size="sm" variant="outline">
                Edit Profile
              </Button>
            </Link>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">Services</p>
            {services.status === 'loading' ? <Skeleton className="mt-2 h-6 w-32" /> : null}
            {services.status === 'error' ? (
              <SectionError body={services.error} onRetry={services.reload} />
            ) : null}
            {services.status === 'success' ? (
              <p className="mt-2 font-semibold text-navy-950">
                {formatCount(activeServiceCount(services.data))} active service
                {activeServiceCount(services.data) === 1 ? '' : 's'}
              </p>
            ) : null}
            <Link to="/interviewer/services" className="mt-3 inline-block">
              <Button size="sm" variant="outline">
                Manage Services
              </Button>
            </Link>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">Availability</p>
            {availability.status === 'loading' ? <Skeleton className="mt-2 h-6 w-28" /> : null}
            {availability.status === 'error' ? (
              <SectionError body={availability.error} onRetry={availability.reload} />
            ) : null}
            {availability.status === 'success' ? (
              <p className="mt-2 font-semibold text-navy-950">
                {isAvailabilityConfigured(availability.data) ? 'Configured' : 'Not configured'}
              </p>
            ) : null}
            <Link to="/interviewer/calendar" className="mt-3 inline-block">
              <Button size="sm" variant="outline">
                Manage Availability
              </Button>
            </Link>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">Verification</p>
            <div className="mt-2">
              {verification ? <Badge tone={verification.tone}>{verification.label}</Badge> : null}
            </div>
            <Link to="/interviewer/verification" className="mt-3 inline-block">
              <Button size="sm" variant="outline">
                View Verification
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-950">Notifications</h2>
          <div className="flex items-center gap-3">
            {notifications.status === 'success' && notifications.data.unreadCount > 0 ? (
              <span className="text-sm text-slate-500">
                {formatCount(notifications.data.unreadCount)} unread
              </span>
            ) : null}
            <Link to="/interviewer/notifications" className="text-sm font-medium text-navy-950 hover:underline">
              View all
            </Link>
          </div>
        </div>
        {notifications.status === 'loading' ? <Skeleton className="h-24" /> : null}
        {notifications.status === 'error' ? (
          <SectionError body={notifications.error} onRetry={notifications.reload} />
        ) : null}
        {notifications.status === 'success' && notifications.data.items.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications yet</p>
        ) : null}
        {notifications.status === 'success' && notifications.data.items.length > 0 ? (
          <Card className="divide-y divide-slate-100">
            {notifications.data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                onClick={() => {
                  void (async () => {
                    if (!item.readAt) {
                      try {
                        await markNotificationRead(item.id)
                        notifications.reload()
                      } catch (caught) {
                        pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
                        return
                      }
                    }
                    navigate(notificationHref(item))
                  })()
                }}
              >
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-navy-950">{item.title}</span>
                    {item.readAt ? null : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">{item.body}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">{formatNotificationTime(item.createdAt)}</span>
                </span>
              </button>
            ))}
          </Card>
        ) : null}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-navy-950">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/interviewer/services">
            <Button variant="outline">
              <Briefcase className="h-4 w-4" />
              Manage Services
            </Button>
          </Link>
          <Link to="/interviewer/calendar">
            <Button variant="outline">
              <CalendarDays className="h-4 w-4" />
              Manage Availability
            </Button>
          </Link>
          <Link to="/interviewer/bookings">
            <Button variant="outline">
              <ClipboardList className="h-4 w-4" />
              View Bookings
            </Button>
          </Link>
          <Link to="/interviewer/bookings?tab=upcoming">
            <Button variant="outline">
              <Video className="h-4 w-4" />
              View Interviews
            </Button>
          </Link>
          <Link to="/interviewer/earnings">
            <Button variant="outline">
              <IndianRupee className="h-4 w-4" />
              View Earnings
            </Button>
          </Link>
          <Link to="/interviewer/notifications">
            <Button variant="outline">
              <Bell className="h-4 w-4" />
              View Notifications
            </Button>
          </Link>
        </div>
      </section>

    </div>
  )
}
