import { interviewJoinState, type InterviewSessionRecord } from './interviewSessions.ts'
import type { InterviewerBooking } from './interviewerBookings.ts'
import { isActionableBookingRequest } from './interviewerBookings.ts'
import type { AvailabilityBoard } from './interviewerAvailability.ts'
import { isProfileSetupComplete } from './interviewerProfile.ts'
import type { InterviewerAccount, VerificationStatusItem } from './interviewerProfile.ts'
import type { InterviewerServiceRecord } from './interviewerServices.ts'

export const DASHBOARD_UPCOMING_LIMIT = 5
export const DASHBOARD_COMPLETED_LIMIT = 5
const SOON_WINDOW_MS = 2 * 60 * 60 * 1000

export type DashboardAttentionItem = {
  id: string
  title: string
  detail: string
  href: string
  actionLabel: string
}

export function pendingBookingRequests(bookings: InterviewerBooking[]) {
  return bookings.filter(isActionableBookingRequest)
}

export function upcomingInterviewCount(bookings: InterviewerBooking[]) {
  return bookings.filter((item) => item.status === 'confirmed' || item.status === 'in_progress').length
}

export function upcomingInterviews(bookings: InterviewerBooking[], limit = DASHBOARD_UPCOMING_LIMIT) {
  return bookings
    .filter((item) => item.status === 'confirmed' || item.status === 'in_progress')
    .slice()
    .sort((a, b) => Date.parse(a.startsAtUtc) - Date.parse(b.startsAtUtc))
    .slice(0, limit)
}

export function recentCompletedInterviews(bookings: InterviewerBooking[], limit = DASHBOARD_COMPLETED_LIMIT) {
  return bookings
    .filter((item) => item.status === 'completed')
    .slice()
    .sort((a, b) => Date.parse(b.startsAtUtc) - Date.parse(a.startsAtUtc))
    .slice(0, limit)
}

export function completedInterviewCount(bookings: InterviewerBooking[]) {
  return bookings.filter((item) => item.status === 'completed').length
}

export function interviewSessionStatusLabel(
  booking: InterviewerBooking,
  session: InterviewSessionRecord | null | undefined,
) {
  if (!session) return null
  if (session.endedAt) return 'Ended'
  if (booking.status === 'in_progress' || session.startedAt) return 'In progress'
  return 'Scheduled'
}

export function isAvailabilityConfigured(board: AvailabilityBoard) {
  return board.availability.length > 0 || board.customSlots.length > 0
}

export function activeServiceCount(services: InterviewerServiceRecord[]) {
  return services.filter((item) => item.is_active).length
}

export function verificationSummary(items: VerificationStatusItem[]) {
  if (items.some((item) => item.status === 'rejected')) {
    return { label: 'Rejected', tone: 'red' as const }
  }
  if (items.length > 0 && items.every((item) => item.status === 'verified')) {
    return { label: 'Verified', tone: 'green' as const }
  }
  if (items.some((item) => item.status === 'action_required')) {
    return { label: 'Action required', tone: 'amber' as const }
  }
  return { label: 'Pending', tone: 'slate' as const }
}

function interviewIsSoon(
  booking: InterviewerBooking,
  session: InterviewSessionRecord | null | undefined,
  now: Date,
) {
  if (booking.status !== 'confirmed' && booking.status !== 'in_progress') return false
  if (interviewJoinState(booking, session ?? null, now).kind === 'ready') return true
  const startsAt = Date.parse(booking.startsAtUtc)
  if (Number.isNaN(startsAt)) return false
  const delta = startsAt - now.getTime()
  return delta >= 0 && delta <= SOON_WINDOW_MS
}

export function buildDashboardAttentionItems(input: {
  account: InterviewerAccount
  bookings?: InterviewerBooking[]
  sessions?: Map<string, InterviewSessionRecord>
  feedbackBookingIds?: Set<string>
  services?: InterviewerServiceRecord[]
  availability?: AvailabilityBoard
  now?: Date
}): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = []
  const now = input.now ?? new Date()

  if (input.bookings) {
    const pending = pendingBookingRequests(input.bookings)
    if (pending.length > 0) {
      items.push({
        id: 'pending-requests',
        title: pending.length === 1 ? 'New booking request' : 'New booking requests',
        detail:
          pending.length === 1
            ? `${pending[0].candidate.name} is waiting for confirmation.`
            : `${pending.length} booking requests are waiting for confirmation.`,
        href: '/interviewer/bookings',
        actionLabel: 'View Bookings',
      })
    }

    const soon = upcomingInterviews(input.bookings, 20).filter((booking) =>
      interviewIsSoon(booking, input.sessions?.get(booking.id), now),
    )
    if (soon.length > 0) {
      const first = soon[0]
      const joinReady = interviewJoinState(first, input.sessions?.get(first.id) ?? null, now).kind === 'ready'
      items.push({
        id: 'upcoming-soon',
        title: joinReady ? 'Interview is ready to open' : 'Upcoming interview',
        detail:
          soon.length === 1
            ? `${first.candidate.name} · ${first.serviceName}`
            : `${soon.length} confirmed interviews start within the next 2 hours.`,
        href: joinReady ? `/interviewer/interview/${first.id}` : '/interviewer/bookings?tab=upcoming',
        actionLabel: joinReady ? 'Open Interview' : 'View Bookings',
      })
    }

    if (input.feedbackBookingIds) {
      const waiting = input.bookings.filter(
        (booking) => booking.status === 'completed' && !input.feedbackBookingIds?.has(booking.id),
      )
      if (waiting.length > 0) {
        items.push({
          id: 'feedback-pending',
          title: waiting.length === 1 ? 'Feedback not yet submitted' : 'Feedback not yet submitted',
          detail:
            waiting.length === 1
              ? `${waiting[0].candidate.name} is waiting for interview feedback.`
              : `${waiting.length} completed interviews still need feedback.`,
          href: `/interviewer/feedback/${waiting[0].id}`,
          actionLabel: 'Give Feedback',
        })
      }
    }
  }

  if (!isProfileSetupComplete(input.account)) {
    items.push({
      id: 'profile-incomplete',
      title: 'Profile is missing required information',
      detail: 'Complete your professional details so candidates can book you.',
      href: '/interviewer/profile',
      actionLabel: 'Edit Profile',
    })
  }

  if (input.services && activeServiceCount(input.services) === 0) {
    items.push({
      id: 'no-active-service',
      title: 'No active service',
      detail: 'Add or activate a service before candidates can request interviews.',
      href: '/interviewer/services',
      actionLabel: 'Manage Services',
    })
  }

  if (input.availability && !isAvailabilityConfigured(input.availability)) {
    items.push({
      id: 'availability-missing',
      title: 'Availability is not configured',
      detail: 'Add weekly hours or custom slots so candidates can book you.',
      href: '/interviewer/calendar',
      actionLabel: 'Manage Availability',
    })
  }

  return items
}
