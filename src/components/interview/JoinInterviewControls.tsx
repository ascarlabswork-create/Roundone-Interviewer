import { Link } from 'react-router-dom'
import { formatDateLongInZone, formatTimeInZone, timezoneLabel } from '../../lib/dates.ts'
import {
  interviewJoinState,
  type InterviewSessionRecord,
} from '../../services/interviewSessions.ts'
import type { InterviewerBooking } from '../../services/interviewerBookings.ts'
import { Button } from '../ui/Button.tsx'

export function interviewStartsAtCopy(booking: InterviewerBooking) {
  return `${formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} on ${formatDateLongInZone(booking.startsAtUtc, booking.displayTimezone)} (${timezoneLabel(booking.displayTimezone)})`
}

export function interviewConfirmedCopy(booking: InterviewerBooking) {
  return `Interview confirmed · Scheduled for ${interviewStartsAtCopy(booking)}`
}

export function JoinInterviewControls({
  booking,
  session,
  size = 'sm',
  showWaiting = true,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord | null | undefined
  size?: 'sm' | 'md'
  showWaiting?: boolean
}) {
  const state = interviewJoinState(booking, session ?? null)
  if (state.kind === 'waiting') {
    if (!showWaiting) return null
    const lobbyOpens = formatTimeInZone(new Date(state.lobbyOpensAtMs).toISOString(), booking.displayTimezone)
    return (
      <p className="text-sm text-slate-600">
        Interview starts at {interviewStartsAtCopy(booking)}. The lobby opens at {lobbyOpens}.
      </p>
    )
  }
  if (state.kind !== 'ready' && state.kind !== 'lobby') return null

  const inProgress = booking.status === 'in_progress' || Boolean(session?.startedAt)
  const label = state.kind === 'lobby' ? 'Open Lobby' : inProgress ? 'Join Interview' : 'Start Interview'

  return (
    <Link to={`/interviewer/interview/${session?.id ?? booking.id}`}>
      <Button size={size}>{label}</Button>
    </Link>
  )
}
