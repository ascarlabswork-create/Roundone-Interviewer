import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Download,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  NotebookPen,
  PhoneOff,
  RefreshCw,
  ShieldAlert,
  UserRound,
  UserX,
  Video,
  VideoOff,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { InterviewChatPanel } from '../components/interview/InterviewChatPanel.tsx'
import { InterviewNotesPanel } from '../components/interview/InterviewNotesPanel.tsx'
import { InterviewRecordingSave } from '../components/interview/InterviewRecordingSave.tsx'
import { interviewStartsAtCopy } from '../components/interview/JoinInterviewControls.tsx'
import { PreInterviewLobby } from '../components/interview/PreInterviewLobby.tsx'
import { useInterviewChat } from '../components/interview/useInterviewChat.ts'
import { useInterviewFullscreen } from '../components/interview/useInterviewFullscreen.ts'
import { useInterviewNotes } from '../components/interview/useInterviewNotes.ts'
import { useInterviewRecording } from '../components/interview/useInterviewRecording.ts'
import { useInterviewTiming } from '../components/interview/useInterviewTiming.ts'
import { useLiveKitCall } from '../components/interview/useLiveKitCall.ts'
import { Logo } from '../components/layout/Logo.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Skeleton } from '../components/ui/primitives.tsx'
import { cn } from '../lib/cn.ts'
import { interviewFileName } from '../lib/saveToComputer.ts'
import { formatDateShortInZone, formatTimeInZone, timezoneLabel } from '../lib/dates.ts'
import { formatCountdown } from '../lib/interviewTiming.ts'
import { useAsync } from '../lib/useAsync.ts'
import { watchBookingStatus } from '../services/bookingRealtime.ts'
import { watchInterviewAdmission } from '../services/interviewAdmission.ts'
import { closeInterviewRoom } from '../services/interviewCall.ts'
import type { CallSnapshot, CallTrack } from '../services/interviewCallController.ts'
import type { InterviewerBooking } from '../services/interviewerBookings.ts'
import { useSession } from '../state/session.tsx'
import {
  beginInterviewCall,
  endInterviewSession,
  getInterviewTiming,
  markInterviewNoShow,
  recordInterviewCallEvent,
  resolveInterviewRoute,
  type InterviewSessionRecord,
  type InterviewTiming,
} from '../services/interviewSessions.ts'

type RoomBundle = { booking: InterviewerBooking; session: InterviewSessionRecord | null }

export function InterviewRoomPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const initial = useAsync(() => resolveInterviewRoute(id), [id])
  const [fresh, setFresh] = useState<{ routeId: string; bundle: RoomBundle } | null>(null)

  const bundle = fresh?.routeId === id ? fresh.bundle : initial.status === 'success' ? initial.data : null
  const bookingId = bundle?.booking.id ?? null
  const sessionId = bundle?.session?.id ?? null
  const isCanonical = !sessionId || sessionId === id

  useEffect(() => {
    if (sessionId && sessionId !== id) navigate(`/interviewer/interview/${sessionId}`, { replace: true })
  }, [id, sessionId, navigate])

  const refresh = useCallback(async () => {
    if (!bookingId) return
    try {
      const next = await resolveInterviewRoute(sessionId ?? bookingId)
      setFresh({ routeId: id, bundle: next })
    } catch {
      // Keep the last known state; the next realtime event retries.
    }
  }, [bookingId, sessionId, id])

  useEffect(() => {
    if (!bookingId) return
    const watch = watchBookingStatus(bookingId, () => void refresh())
    return () => watch.unsubscribe()
  }, [bookingId, refresh])

  if (!bundle || !isCanonical) {
    if (initial.status === 'error' && !bundle) {
      return (
        <StatusScreen
          tone="error"
          icon={<AlertCircle className="h-6 w-6" />}
          title="Unable to Open Interview"
          body={initial.error ?? 'This booking is no longer available.'}
          actions={
            <>
              <Button onClick={() => void initial.reload()} fullWidth>
                Try Again
              </Button>
              <BackToBookings />
            </>
          }
        />
      )
    }
    return <LoadingScreen />
  }

  const { booking, session } = bundle

  if (booking.status === 'requested') {
    return (
      <StatusScreen
        tone="warning"
        icon={<Clock className="h-6 w-6" />}
        title="Booking Pending Confirmation"
        body={`This booking request from ${booking.candidate.name} has not been confirmed yet. Accept the request to open the interview call.`}
        actions={
          <>
            <Link to={`/interviewer/bookings?tab=pending&booking=${booking.id}`}>
              <Button fullWidth>Review Request</Button>
            </Link>
            <BackToBookings />
          </>
        }
      />
    )
  }

  if (booking.status === 'completed' || session?.endedAt) {
    return (
      <StatusScreen
        tone="success"
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="Interview Completed"
        body={`This interview session with ${booking.candidate.name} has already ended.`}
        actions={
          <>
            <Link to={`/interviewer/feedback/${booking.id}`}>
              <Button fullWidth>View / Give Feedback</Button>
            </Link>
            <BackToBookings tab="completed" />
          </>
        }
      />
    )
  }

  if (booking.status === 'no_show') {
    return <NoShowScreen booking={booking} sessionId={session?.id ?? null} />
  }

  if ((booking.status === 'confirmed' || booking.status === 'in_progress') && session) {
    return <InterviewGate key={session.id} booking={booking} session={session} onChanged={refresh} />
  }

  if (booking.status === 'confirmed' || booking.status === 'in_progress') {
    return (
      <StatusScreen
        tone="error"
        icon={<AlertCircle className="h-6 w-6" />}
        title="Interview Session Not Ready"
        body="The interview session for this booking is still being prepared. Try again in a moment."
        actions={
          <>
            <Button onClick={() => void initial.reload()} fullWidth>
              Try Again
            </Button>
            <BackToBookings />
          </>
        }
      />
    )
  }

  return (
    <StatusScreen
      tone="neutral"
      icon={<AlertCircle className="h-6 w-6" />}
      title="Interview Not Available"
      body={`This booking is marked as ${booking.status} and cannot be opened.`}
      actions={<BackToBookings />}
    />
  )
}

/**
 * Chooses the screen from the server clock: confirmed (before the lobby), pre-interview
 * lobby, live call (LiveKit from 15 minutes before start), or scheduled end.
 */
function InterviewGate({
  booking,
  session,
  onChanged,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord
  onChanged: () => Promise<void>
}) {
  const clock = useInterviewTiming(session.id, booking.status)
  const [inCall, setInCall] = useState(false)
  const { timing, serverNow, phase, canJoin, reload } = clock

  const onStarted = useCallback(async () => {
    await Promise.all([onChanged(), reload()])
  }, [onChanged, reload])
  const onClosed = useCallback(async () => {
    await Promise.all([onChanged(), reload()])
    setInCall(false)
  }, [onChanged, reload])

  if (!timing || serverNow === null || !phase) {
    if (clock.error) {
      return (
        <StatusScreen
          tone="error"
          icon={<AlertCircle className="h-6 w-6" />}
          title="Unable to Open Interview"
          body={clock.error}
          actions={
            <>
              <Button onClick={() => void reload()} fullWidth>
                Try Again
              </Button>
              <BackToBookings />
            </>
          }
        />
      )
    }
    return <LoadingScreen />
  }

  if (inCall && canJoin) {
    return (
      <LiveCallRoom
        booking={booking}
        session={session}
        timing={timing}
        serverNow={serverNow}
        onStarted={onStarted}
        onClosed={onClosed}
      />
    )
  }

  if (phase === 'closed') {
    return (
      <StatusScreen
        tone="neutral"
        icon={<AlertCircle className="h-6 w-6" />}
        title="Interview Not Available"
        body={`This booking is marked as ${timing.status || booking.status} and cannot be opened.`}
        actions={<BackToBookings />}
      />
    )
  }

  if (phase === 'ended') {
    return <ScheduledEndScreen booking={booking} session={session} timing={timing} onChanged={onChanged} />
  }

  if (phase === 'scheduled') {
    const roomOpens = formatTimeInZone(new Date(timing.schedule.callOpensAt).toISOString(), booking.displayTimezone)
    return (
      <StatusScreen
        tone="success"
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="Interview confirmed"
        body={`Scheduled for ${interviewStartsAtCopy(booking)}. Interview room opens at ${roomOpens} (in ${formatCountdown(timing.schedule.callOpensAt - serverNow)}).`}
        actions={<BackToBookings tab="upcoming" />}
      />
    )
  }

  return (
    <PreInterviewLobby
      booking={booking}
      sessionId={session.id}
      timing={timing}
      serverNow={serverNow}
      phase={phase}
      canJoin={canJoin}
      onStart={() => setInCall(true)}
    />
  )
}

function NoShowScreen({ booking, sessionId }: { booking: InterviewerBooking; sessionId: string | null }) {
  const [absent, setAbsent] = useState<'candidate' | 'interviewer' | null>(null)
  useEffect(() => {
    if (!sessionId) return
    void closeInterviewRoom(sessionId)
    getInterviewTiming(sessionId)
      .then((timing) => setAbsent(timing.noShowRole))
      .catch(() => setAbsent(null))
  }, [sessionId])
  return (
    <StatusScreen
      tone="warning"
      icon={<UserX className="h-6 w-6" />}
      title={absent === 'interviewer' ? 'Recorded as interviewer no-show' : 'Candidate did not join'}
      body={
        absent === 'interviewer'
          ? 'You did not join before the late-join deadline, so this interview was recorded as a no-show.'
          : `${booking.candidate.name} did not join before the late-join deadline. The interview was recorded as a no-show.`
      }
      actions={<BackToBookings tab="cancelled" />}
    />
  )
}

/** Opened after the scheduled end while the booking is still open: finish it through the normal completion flow. */
function ScheduledEndScreen({
  booking,
  session,
  timing,
  onChanged,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord
  timing: InterviewTiming
  onChanged: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function complete() {
    setBusy(true)
    setError(null)
    try {
      await endInterviewSession(booking.id)
      void closeInterviewRoom(session.id)
      navigate(`/interviewer/feedback/${booking.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete this interview.')
      setBusy(false)
    }
  }

  async function recordNoShow() {
    setBusy(true)
    setError(null)
    try {
      await markInterviewNoShow(session.id)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record the no-show.')
      setBusy(false)
    }
  }

  if (!timing.hasJoined) {
    return (
      <StatusScreen
        tone="neutral"
        icon={<Clock className="h-6 w-6" />}
        title="Scheduled time has ended"
        body="This interview ended at its scheduled time. You did not join the call before the join deadline."
        actions={<BackToBookings />}
      />
    )
  }

  return (
    <StatusScreen
      tone="success"
      icon={<CheckCircle2 className="h-6 w-6" />}
      title="Scheduled time has ended"
      body={
        timing.candidateJoined
          ? 'The call has closed. Complete the interview to write your feedback.'
          : `${booking.candidate.name} never joined the call. Record a no-show, or complete the interview if it took place.`
      }
      actions={
        <>
          <Button onClick={() => void complete()} disabled={busy} fullWidth>
            Complete & give feedback
          </Button>
          {!timing.candidateJoined ? (
            <Button variant="outline" onClick={() => void recordNoShow()} disabled={busy} fullWidth>
              Record candidate no-show
            </Button>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <BackToBookings />
        </>
      }
    />
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <Logo inverted to="/interviewer/dashboard" />
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur sm:p-8">
          <Skeleton className="h-6 bg-white/10" />
          <Skeleton className="h-20 bg-white/10" />
          <Skeleton className="h-10 bg-white/10" />
        </div>
      </div>
    </div>
  )
}

const TONE_CLASSES = {
  error: 'bg-red-500/20 text-red-400',
  warning: 'bg-amber-500/20 text-amber-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  neutral: 'bg-slate-500/20 text-slate-400',
} as const

function StatusScreen({
  tone,
  icon,
  title,
  body,
  actions,
}: {
  tone: keyof typeof TONE_CLASSES
  icon: ReactNode
  title: string
  body: string
  actions: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <Logo inverted to="/interviewer/dashboard" />
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur sm:p-8">
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>
            {icon}
          </div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm text-white/70">{body}</p>
          <div className="mt-6 flex flex-col gap-2">{actions}</div>
        </div>
      </div>
    </div>
  )
}

function BackToBookings({ tab }: { tab?: string }) {
  return (
    <Link to={tab ? `/interviewer/bookings?tab=${tab}` : '/interviewer/bookings'}>
      <Button fullWidth variant="outline">
        Back to Bookings
      </Button>
    </Link>
  )
}

function playKnockChime() {
  try {
    const context = new AudioContext()
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6)
    for (const [frequency, offset] of [
      [880, 0],
      [1320, 0.15],
    ]) {
      const tone = context.createOscillator()
      tone.frequency.value = frequency
      tone.connect(gain)
      tone.start(context.currentTime + offset)
      tone.stop(context.currentTime + offset + 0.3)
    }
    window.setTimeout(() => void context.close().catch(() => {}), 1000)
  } catch {
    // Sound is a nicety; the on-screen prompt is the real notification.
  }
}

function LiveCallRoom({
  booking,
  session,
  timing,
  serverNow,
  onStarted,
  onClosed,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord
  timing: InterviewTiming
  serverNow: number
  onStarted: () => Promise<void>
  onClosed: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { user } = useSession()
  const roomRef = useRef<HTMLDivElement>(null)
  const fullscreen = useInterviewFullscreen(roomRef)
  const chat = useInterviewChat(session.id, user?.id ?? null)
  const notes = useInterviewNotes(session.id)
  const recording = useInterviewRecording(session.id)
  const [panel, setPanel] = useState<'chat' | 'notes' | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const autoActionRef = useRef<'no_show' | 'scheduled_end' | null>(null)
  const promotedRef = useRef(false)

  const handlers = useMemo(
    () => ({
      onJoined: () => {
        setRecordError(null)
        beginInterviewCall(session.id)
          .then(() => onStarted())
          .catch((caught: unknown) => {
            setRecordError(caught instanceof Error ? caught.message : 'Could not record that you joined the call.')
          })
      },
      onLeft: () => {
        void recordInterviewCallEvent(session.id, 'participant_left').catch(() => {})
      },
      onAdmissionRequested: playKnockChime,
    }),
    [session.id, onStarted],
  )
  const { snapshot, controller } = useLiveKitCall(session.id, handlers)

  const started = booking.status === 'in_progress' || Boolean(session.startedAt)
  const canUseMedia = snapshot.phase !== 'left'
  const knocking = snapshot.admission === 'requested'

  useEffect(() => {
    chat.setOpen(panel === 'chat')
  }, [panel, chat.setOpen])

  useEffect(() => {
    if (serverNow < timing.schedule.startsAt || started || promotedRef.current) return
    promotedRef.current = true
    void beginInterviewCall(session.id)
      .then(() => onStarted())
      .catch((caught: unknown) => {
        promotedRef.current = false
        setRecordError(caught instanceof Error ? caught.message : 'Could not record that the interview started.')
      })
  }, [serverNow, timing.schedule.startsAt, started, session.id, onStarted])

  useEffect(() => {
    if (!controller) return
    const watch = watchInterviewAdmission(session.id, (status) => void controller.applyServerAdmission(status))
    return () => watch.unsubscribe()
  }, [controller, session.id])

  useEffect(() => {
    if (!knocking) return
    const previous = document.title
    document.title = `${booking.candidate.name} wants to join · jobround.ai`
    return () => {
      document.title = previous
    }
  }, [knocking, booking.candidate.name])

  const { schedule } = timing
  const remainingSeconds = Math.max(0, Math.ceil((schedule.endsAt - serverNow) / 1000))
  const candidateEverJoined = timing.candidateJoined || snapshot.candidate.presence !== 'waiting'
  const candidateKnocked =
    knocking || snapshot.admission === 'admitted' || timing.admission === 'waiting' || timing.admission === 'admitted'
  const lateJoinOpen = !candidateEverJoined && serverNow <= schedule.joinDeadline
  const candidateMissedDeadline =
    !candidateEverJoined && !candidateKnocked && serverNow > schedule.joinDeadline && serverNow < schedule.endsAt

  function leaveCall() {
    controller?.leave()
    navigate('/interviewer/bookings?tab=upcoming')
  }

  const recordingStopRef = useRef(recording.stop)
  const recordingActiveRef = useRef(recording.active)
  useEffect(() => {
    recordingStopRef.current = recording.stop
    recordingActiveRef.current = recording.active
  }, [recording.stop, recording.active])

  const endInterview = useCallback(async () => {
    setEnding(true)
    setEndError(null)
    controller?.leave()
    try {
      if (recordingActiveRef.current) await recordingStopRef.current().catch(() => {})
      await recordInterviewCallEvent(session.id, 'call_ended').catch(() => {})
      await endInterviewSession(booking.id)
      void closeInterviewRoom(session.id)
      navigate(`/interviewer/feedback/${booking.id}`)
    } catch (caught) {
      setEndError(caught instanceof Error ? caught.message : 'Could not complete this interview.')
      setEnding(false)
    }
  }, [controller, session.id, booking.id, navigate])

  useEffect(() => {
    if (!candidateMissedDeadline || !started || autoActionRef.current) return
    autoActionRef.current = 'no_show'
    controller?.leave()
    markInterviewNoShow(session.id)
      .then(() => closeInterviewRoom(session.id))
      .catch(() => {})
      .finally(() => void onClosed())
  }, [candidateMissedDeadline, started, controller, session.id, onClosed])

  useEffect(() => {
    if (serverNow < schedule.endsAt || autoActionRef.current) return
    autoActionRef.current = 'scheduled_end'
    if (started && candidateEverJoined) {
      void endInterview()
      return
    }
    controller?.leave()
    void recordInterviewCallEvent(session.id, 'call_ended')
      .catch(() => {})
      .then(() => closeInterviewRoom(session.id))
      .finally(() => void onClosed())
  }, [serverNow, schedule.endsAt, started, candidateEverJoined, endInterview, controller, session.id, onClosed])

  const candidateName = snapshot.candidate.name ?? booking.candidate.name
  const deadlineCopy = formatTimeInZone(new Date(schedule.joinDeadline).toISOString(), booking.displayTimezone)
  const panelOpen = panel !== null

  return (
    <div
      ref={roomRef}
      className={cn(
        'flex flex-col bg-navy-950 text-white',
        fullscreen.active ? 'fixed inset-0 z-[80] h-dvh overflow-hidden' : 'min-h-svh',
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          {fullscreen.active ? null : <Logo inverted to="/interviewer/dashboard" />}
          <div className="hidden text-sm sm:block">
            <p className="font-medium">{booking.candidate.name}</p>
            {fullscreen.active ? null : (
              <p className="text-xs text-white/60">
                {booking.serviceName} · {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
                {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} ({timezoneLabel(booking.displayTimezone)})
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recording.active ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              Recording
            </span>
          ) : null}
          <ConnectionBadge phase={snapshot.phase} />
          <span
            className={`rounded-md px-3 py-1 font-mono text-sm ${
              remainingSeconds <= 300 ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-white'
            }`}
            title={`Ends at the scheduled time (${booking.durationMin} minute session)`}
          >
            {formatCountdown(remainingSeconds * 1000)}
          </span>
          {fullscreen.active ? (
            <button type="button" onClick={() => void fullscreen.exit()} className="rounded-full bg-white/10 px-3 py-1 text-xs">
              Exit full screen
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
          <CallAlerts
            snapshot={snapshot}
            onRetry={() => void controller?.retry()}
            onRetryMedia={() => void controller?.retryMedia()}
            onEnableAudio={() => void controller?.startAudio()}
          />
          {recordError ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{recordError}</p>
          ) : null}
          {recording.error ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{recording.error}</p>
          ) : null}
          {recording.canSave ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <InterviewRecordingSave
                compact
                canSave={recording.canSave}
                saving={recording.saving}
                error={null}
                onSave={() =>
                  void recording.save(interviewFileName('recording', booking.candidate.name, booking.startsAtUtc))
                }
              />
            </div>
          ) : null}
          {fullscreen.active ? null : serverNow < schedule.startsAt ? (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
              Interview room is open. You can join early and wait for the candidate.
            </p>
          ) : (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">Interview has started.</p>
          )}
          {fullscreen.active || !lateJoinOpen ? null : (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              {candidateName} can still join until {deadlineCopy} ({formatCountdown(schedule.joinDeadline - serverNow)} left).
              The interview still ends at the scheduled time.
            </p>
          )}
          {fullscreen.active || remainingSeconds > 300 || remainingSeconds <= 0 ? null : (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              The call ends automatically at the scheduled time.
            </p>
          )}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-navy-800">
            <RemoteStage snapshot={snapshot} candidateName={candidateName} />
            <div className="absolute bottom-3 left-3 h-28 w-40 overflow-hidden rounded-lg border border-white/20 bg-navy-900 shadow-lg sm:h-36 sm:w-52">
              {snapshot.localVideoTrack ? (
                <VideoTrackView track={snapshot.localVideoTrack} mirrored fit="cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/60">
                  <VideoOff className="mr-1.5 h-3.5 w-3.5" />
                  Camera off
                </div>
              )}
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px]">You</span>
            </div>
          </div>
          {snapshot.candidate.audioTrack ? <AudioTrackView track={snapshot.candidate.audioTrack} /> : null}
        </div>

        {panelOpen ? (
          <aside className="relative hidden w-80 shrink-0 overflow-hidden border-l border-white/10 bg-white shadow-2xl lg:flex lg:flex-col">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setPanel(null)}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
            {panel === 'chat' ? (
              <InterviewChatPanel
                selfUserId={user?.id ?? null}
                candidateName={candidateName}
                messages={chat.messages}
                sending={chat.sending}
                error={chat.error}
                onSend={chat.send}
              />
            ) : (
              <InterviewNotesPanel
                value={notes.value}
                saveState={notes.saveState}
                error={notes.error}
                exporting={notes.exporting}
                onChange={notes.update}
                onSave={() => void notes.save()}
                onSaveToComputer={() =>
                  void notes.saveToComputer(interviewFileName('notes', booking.candidate.name, booking.startsAtUtc))
                }
              />
            )}
          </aside>
        ) : null}

        {panelOpen ? (
          <div className="absolute inset-0 z-30 flex flex-col bg-black/50 lg:hidden">
            <button type="button" className="h-16 shrink-0" aria-label="Close panel" onClick={() => setPanel(null)} />
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-white">
              <button
                type="button"
                className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setPanel(null)}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
              {panel === 'chat' ? (
                <InterviewChatPanel
                  selfUserId={user?.id ?? null}
                  candidateName={candidateName}
                  messages={chat.messages}
                  sending={chat.sending}
                  error={chat.error}
                  onSend={chat.send}
                />
              ) : (
                <InterviewNotesPanel
                  value={notes.value}
                  saveState={notes.saveState}
                  error={notes.error}
                  exporting={notes.exporting}
                  onChange={notes.update}
                  onSave={() => void notes.save()}
                  onSaveToComputer={() =>
                    void notes.saveToComputer(interviewFileName('notes', booking.candidate.name, booking.startsAtUtc))
                  }
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <Control
          label="Microphone"
          pressed={snapshot.micEnabled}
          danger={!snapshot.micEnabled}
          disabled={!canUseMedia}
          onClick={() => void controller?.toggleMic()}
        >
          {snapshot.micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Control>
        <Control
          label="Camera"
          pressed={snapshot.cameraEnabled}
          danger={!snapshot.cameraEnabled}
          disabled={!canUseMedia}
          onClick={() => void controller?.toggleCamera()}
        >
          {snapshot.cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Control>
        <Control
          label="Chat"
          pressed={panel === 'chat'}
          badge={chat.unread}
          onClick={() => setPanel((current) => (current === 'chat' ? null : 'chat'))}
        >
          <MessageSquare className="h-4 w-4" />
        </Control>
        <Control
          label="Notes"
          pressed={panel === 'notes'}
          onClick={() => setPanel((current) => (current === 'notes' ? null : 'notes'))}
        >
          <NotebookPen className="h-4 w-4" />
        </Control>
        <Control label="Full Screen" pressed={fullscreen.active} onClick={() => fullscreen.toggle()}>
          {fullscreen.active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Control>
        <Control
          label={
            recording.busy
              ? recording.active
                ? 'Stopping…'
                : 'Starting…'
              : recording.active
                ? 'Stop Recording'
                : 'Start Recording'
          }
          pressed={recording.active}
          danger={recording.active}
          disabled={recording.busy || ending}
          onClick={() => void (recording.active ? recording.stop() : recording.start())}
        >
          <span className={`h-3 w-3 rounded-full ${recording.active ? 'bg-white' : 'bg-red-400'}`} />
        </Control>
        {recording.canSave ? (
          <Control
            label={recording.saving ? 'Saving…' : 'Save to computer'}
            disabled={recording.saving || ending}
            onClick={() =>
              void recording.save(interviewFileName('recording', booking.candidate.name, booking.startsAtUtc))
            }
          >
            <Download className="h-4 w-4" />
          </Control>
        ) : null}
        <Button variant="outline" onClick={leaveCall} disabled={ending} className="border-white/20 bg-transparent text-white hover:border-white">
          <LogOut className="h-4 w-4" />
          Leave
        </Button>
        {started ? (
          <Button variant="danger" onClick={() => void endInterview()} disabled={ending}>
            <PhoneOff className="h-4 w-4" />
            {ending ? 'Ending…' : 'End interview'}
          </Button>
        ) : null}
      </div>
      {endError ? <p className="px-4 pb-3 text-center text-sm text-red-300">{endError}</p> : null}
    </div>
  )
}

function ConnectionBadge({ phase }: { phase: CallSnapshot['phase'] }) {
  const map: Record<CallSnapshot['phase'], { label: string; className: string }> = {
    idle: { label: 'Preparing', className: 'bg-white/10 text-white/70' },
    requesting_token: { label: 'Authorizing', className: 'bg-white/10 text-white/70' },
    connecting: { label: 'Connecting', className: 'bg-amber-500/20 text-amber-200' },
    connected: { label: 'Connected', className: 'bg-emerald-500/20 text-emerald-200' },
    reconnecting: { label: 'Reconnecting', className: 'bg-amber-500/20 text-amber-200' },
    disconnected: { label: 'Disconnected', className: 'bg-red-500/20 text-red-200' },
    left: { label: 'Left call', className: 'bg-white/10 text-white/70' },
    error: { label: 'Not connected', className: 'bg-red-500/20 text-red-200' },
  }
  const { label, className } = map[phase]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  )
}

function RemoteStage({
  snapshot,
  candidateName,
}: {
  snapshot: CallSnapshot
  candidateName: string
}) {
  const { candidate, phase } = snapshot
  if (phase === 'idle' || phase === 'requesting_token' || phase === 'connecting') {
    return (
      <StageMessage icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Joining the interview call…" />
    )
  }
  if (candidate.presence === 'joined' && candidate.videoTrack) {
    return (
      <>
        <VideoTrackView track={candidate.videoTrack} fit="contain" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 text-xs">
          {candidateName}
          {candidate.micMuted ? <MicOff className="h-3 w-3 text-red-300" /> : null}
        </span>
      </>
    )
  }
  if (candidate.presence === 'joined') {
    return (
      <StageMessage
        icon={<UserRound className="h-6 w-6" />}
        title={`${candidateName} joined`}
        body={candidate.micMuted ? 'Camera and microphone are off.' : 'Camera is off.'}
      />
    )
  }
  if (candidate.presence === 'left') {
    return (
      <StageMessage
        icon={<UserRound className="h-6 w-6" />}
        title={`${candidateName} left the call`}
        body="Stay in the call; they can rejoin with the same link."
      />
    )
  }
  return (
    <StageMessage
      icon={<Clock className="h-6 w-6" />}
      title={`Waiting for ${candidateName} to join…`}
      body="The candidate can join directly. You do not need to admit them."
    />
  )
}

function StageMessage({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode
  title: string
  body?: string
  children?: ReactNode
}) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80">{icon}</div>
      <p className="text-sm font-medium text-white">{title}</p>
      {body ? <p className="max-w-sm text-xs text-white/60">{body}</p> : null}
      {children}
    </div>
  )
}

function CallAlerts({
  snapshot,
  onRetry,
  onRetryMedia,
  onEnableAudio,
}: {
  snapshot: CallSnapshot
  onRetry: () => void
  onRetryMedia: () => void
  onEnableAudio: () => void
}) {
  const alerts: ReactNode[] = []
  if (snapshot.phase === 'left') {
    alerts.push(
      <Alert key="left" tone="warning" icon={<LogOut className="h-4 w-4" />} message="You left the call.">
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Rejoin
        </Button>
      </Alert>,
    )
  }
  if ((snapshot.phase === 'error' || snapshot.phase === 'disconnected') && snapshot.error) {
    const retryable = snapshot.error.kind === 'connection' || snapshot.error.kind === 'network'
    alerts.push(
      <Alert key="call" tone="error" icon={<WifiOff className="h-4 w-4" />} message={snapshot.error.message}>
        {retryable ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnect
          </Button>
        ) : null}
      </Alert>,
    )
  }
  if (snapshot.mediaError) {
    alerts.push(
      <Alert
        key="media"
        tone={snapshot.mediaError.kind === 'permission_denied' ? 'error' : 'warning'}
        icon={<ShieldAlert className="h-4 w-4" />}
        message={snapshot.mediaError.message}
      >
        <Button size="sm" variant="outline" onClick={onRetryMedia}>
          Try again
        </Button>
      </Alert>,
    )
  }
  if (snapshot.phase === 'connected' && !snapshot.canPlaybackAudio) {
    alerts.push(
      <Alert key="audio" tone="warning" icon={<Volume2 className="h-4 w-4" />} message="Your browser blocked call audio.">
        <Button size="sm" onClick={onEnableAudio}>
          Enable audio
        </Button>
      </Alert>,
    )
  }
  return alerts.length ? <div className="space-y-2">{alerts}</div> : null
}

function Alert({
  tone,
  icon,
  message,
  children,
}: {
  tone: 'error' | 'warning'
  icon: ReactNode
  message: string
  children?: ReactNode
}) {
  const className =
    tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${className}`}>
      {icon}
      <span className="flex-1">{message}</span>
      {children}
    </div>
  )
}

function VideoTrackView({
  track,
  mirrored = false,
  fit = 'cover',
}: {
  track: CallTrack
  mirrored?: boolean
  fit?: 'cover' | 'contain'
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`h-full w-full ${fit === 'contain' ? 'object-contain bg-navy-950' : 'object-cover'} ${mirrored ? '-scale-x-100' : ''}`}
    />
  )
}

function AudioTrackView({ track }: { track: CallTrack }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.autoplay = true
    element.muted = false
    element.volume = 1
    track.attach(element)
    element.muted = false
    element.volume = 1
    return () => {
      track.detach(element)
    }
  }, [track])
  return <audio ref={ref} autoPlay />
}

function Control({
  label,
  children,
  onClick,
  pressed = false,
  danger = false,
  disabled,
  badge,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  pressed?: boolean
  danger?: boolean
  disabled?: boolean
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`relative inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? 'bg-red-500/80 hover:bg-red-500' : pressed ? 'bg-white/20 ring-1 ring-white/40' : 'bg-white/10 hover:bg-white/20'
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
      {badge ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-4">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  )
}
