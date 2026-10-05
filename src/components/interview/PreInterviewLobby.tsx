import { CalendarClock, Clock, Lock, PlayCircle, UserRound } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatDateLongInZone, formatTimeInZone, timezoneLabel } from '../../lib/dates.ts'
import { candidateStatusCopy } from '../../lib/interviewLobby.ts'
import {
  formatCountdown,
  interviewRoomAccess,
  interviewRoomStatusCopy,
} from '../../lib/interviewTiming.ts'
import type { InterviewerBooking } from '../../services/interviewerBookings.ts'
import { recordInterviewCallEvent, type InterviewTiming } from '../../services/interviewSessions.ts'
import { Logo } from '../layout/Logo.tsx'
import { Button } from '../ui/Button.tsx'
import { DeviceChecks } from './DeviceChecks.tsx'

function atTime(ms: number, timezone: string) {
  return formatTimeInZone(new Date(ms).toISOString(), timezone)
}

/**
 * Pre-interview lobby: opens 30 minutes before the start for device checks. LiveKit join
 * unlocks 15 minutes before the scheduled start on the server clock. Official start and
 * end do not move.
 */
export function PreInterviewLobby({
  booking,
  sessionId,
  timing,
  serverNow,
  canJoin,
  onStart,
}: {
  booking: InterviewerBooking
  sessionId: string
  timing: InterviewTiming
  serverNow: number
  phase?: 'lobby' | 'live'
  canJoin: boolean
  onStart: () => void
}) {
  const { schedule } = timing
  const timezone = booking.displayTimezone
  const access = interviewRoomAccess(schedule, serverNow, timing.hasJoined)
  const roomOpensCopy = atTime(schedule.callOpensAt, timezone)
  const statusCopy = interviewRoomStatusCopy(access, roomOpensCopy)

  useEffect(() => {
    void recordInterviewCallEvent(sessionId, 'lobby_entered').catch(() => {})
  }, [sessionId])

  const startsAtCopy = atTime(schedule.startsAt, timezone)
  const deadlineCopy = atTime(schedule.joinDeadline, timezone)
  const endsAtCopy = atTime(schedule.endsAt, timezone)

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <Logo inverted to="/interviewer/dashboard" />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">Pre-interview lobby</span>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
        <section aria-label="Device checks">
          <h1 className="text-lg font-semibold">Check your setup</h1>
          <p className="mb-4 mt-1 text-sm text-white/60">
            Nothing is shared with the candidate until you join the interview room. The interview still starts at{' '}
            {startsAtCopy}.
          </p>
          <DeviceChecks latencyMs={timing.roundTripMs} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">{booking.serviceName}</p>
            <h2 className="mt-1 text-xl font-semibold">Interview starts at {startsAtCopy}</h2>
            <p className="mt-1 text-sm text-white/80">{statusCopy}</p>
            <p className="mt-1 text-sm text-white/70">
              {formatDateLongInZone(booking.startsAtUtc, timezone)} · {timezoneLabel(timezone)}
            </p>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-white/50" />
                <dt className="text-white/60">Duration</dt>
                <dd className="ml-auto font-medium">
                  {booking.durationMin} minutes · ends {endsAtCopy}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-white/50" />
                <dt className="text-white/60">Late-join deadline</dt>
                <dd className="ml-auto font-medium">{deadlineCopy}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-xl bg-white/5 p-4 text-center">
              {access === 'not_open' ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-white/50">Room opens in</p>
                  <p className="mt-1 font-mono text-3xl font-semibold" aria-live="off">
                    {formatCountdown(schedule.callOpensAt - serverNow)}
                  </p>
                </>
              ) : access === 'early' ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-emerald-300">Room open</p>
                  <p className="mt-1 font-mono text-3xl font-semibold" aria-live="off">
                    {formatCountdown(schedule.startsAt - serverNow)}
                  </p>
                  <p className="mt-1 text-xs text-white/60">until scheduled start</p>
                </>
              ) : canJoin ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-emerald-300">Interview has started.</p>
                  <p className="mt-1 text-sm text-white/80">
                    {serverNow <= schedule.joinDeadline
                      ? `Join by ${deadlineCopy} · ${formatCountdown(schedule.joinDeadline - serverNow)} left`
                      : `Ends at ${endsAtCopy}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wide text-red-300">No new participants can join.</p>
                  <p className="mt-1 text-sm text-white/80">New entry closed at {deadlineCopy}.</p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm" aria-live="polite">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <UserRound className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium">{booking.candidate.name}</p>
              <p className="text-white/60">{candidateStatusCopy(timing, booking.candidate.name)}</p>
            </div>
          </div>

          {access === 'join_closed' ? (
            <Link to="/interviewer/bookings?tab=upcoming">
              <Button fullWidth variant="outline">
                Back to Bookings
              </Button>
            </Link>
          ) : (
            <Button fullWidth size="lg" disabled={!canJoin} onClick={onStart}>
              {canJoin ? <PlayCircle className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
              {canJoin
                ? timing.hasJoined
                  ? 'Rejoin Interview'
                  : 'Join Interview'
                : `Interview room opens at ${roomOpensCopy}`}
            </Button>
          )}
        </aside>
      </div>
    </div>
  )
}
