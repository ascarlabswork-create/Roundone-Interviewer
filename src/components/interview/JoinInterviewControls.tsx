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
    return <p className="text-sm text-slate-600">Interview starts at {interviewStartsAtCopy(booking)}</p>
  }
  if (state.kind !== 'ready') return null
  return (
    <Link to={`/interviewer/interview/${booking.id}`}>
      <Button size={size}>Join Interview</Button>
    </Link>
  )
}
