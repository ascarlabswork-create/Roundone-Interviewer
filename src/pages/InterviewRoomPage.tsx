import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Video,
  VideoOff,
  Volume2,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveKitCall } from '../components/interview/useLiveKitCall.ts'
import { Logo } from '../components/layout/Logo.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Skeleton } from '../components/ui/primitives.tsx'
import { formatDateShortInZone, formatTimeInZone, timezoneLabel } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { watchBookingStatus } from '../services/bookingRealtime.ts'
import type { CallSnapshot, CallTrack } from '../services/interviewCallController.ts'
import type { InterviewerBooking } from '../services/interviewerBookings.ts'
import {
  beginInterviewCall,
  endInterviewSession,
  recordInterviewCallEvent,
  resolveInterviewRoute,
  type InterviewSessionRecord,
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

  if ((booking.status === 'confirmed' || booking.status === 'in_progress') && session) {
    return <LiveCallRoom key={session.id} booking={booking} session={session} onStarted={refresh} />
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

function formatInterviewClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function remainingInterviewSeconds(durationMin: number, startedAtIso: string, nowMs = Date.now()) {
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null
  const startedAtMs = Date.parse(startedAtIso)
  if (Number.isNaN(startedAtMs)) return null
  return Math.max(0, durationMin * 60 - Math.floor((nowMs - startedAtMs) / 1000))
}

function LiveCallRoom({
  booking,
  session,
  onStarted,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord
  onStarted: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [recordError, setRecordError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

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
    }),
    [session.id, onStarted],
  )
  const { snapshot, controller } = useLiveKitCall(session.id, handlers)

  const started = booking.status === 'in_progress' || Boolean(session.startedAt)
  const connected = snapshot.phase === 'connected' || snapshot.phase === 'reconnecting'

  useEffect(() => {
    if (!session.startedAt) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session.startedAt])

  const remainingSeconds = useMemo(
    () => (session.startedAt ? remainingInterviewSeconds(booking.durationMin, session.startedAt, nowMs) : null),
    [booking.durationMin, session.startedAt, nowMs],
  )

  function leaveCall() {
    controller?.leave()
    navigate('/interviewer/bookings?tab=upcoming')
  }

  async function endInterview() {
    setEnding(true)
    setEndError(null)
    controller?.leave()
    try {
      await recordInterviewCallEvent(session.id, 'call_ended').catch(() => {})
      await endInterviewSession(booking.id)
      navigate(`/interviewer/feedback/${booking.id}`)
    } catch (caught) {
      setEndError(caught instanceof Error ? caught.message : 'Could not complete this interview.')
      setEnding(false)
    }
  }

  const candidateName = snapshot.candidate.name ?? booking.candidate.name

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo inverted to="/interviewer/dashboard" />
          <div className="hidden text-sm sm:block">
            <p className="font-medium">{booking.candidate.name}</p>
            <p className="text-xs text-white/60">
              {booking.serviceName} · {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
              {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} ({timezoneLabel(booking.displayTimezone)})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge phase={snapshot.phase} />
          {remainingSeconds !== null ? (
            <span
              className={`rounded-md px-3 py-1 font-mono text-sm ${
                remainingSeconds === 0 ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-white'
              }`}
              title={remainingSeconds === 0 ? 'Scheduled duration has elapsed' : `${booking.durationMin} minute session`}
            >
              {formatInterviewClock(remainingSeconds)}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col gap-3">
          <CallAlerts
            snapshot={snapshot}
            onRetry={() => void controller?.retry()}
            onRetryMedia={() => void controller?.retryMedia()}
            onEnableAudio={() => void controller?.startAudio()}
          />
          {recordError ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {recordError}
            </p>
          ) : null}
          <div className="relative min-h-72 flex-1 overflow-hidden rounded-xl bg-navy-800">
            <RemoteStage snapshot={snapshot} candidateName={candidateName} />
            <div className="absolute bottom-3 right-3 h-28 w-40 overflow-hidden rounded-lg border border-white/20 bg-navy-900 shadow-lg sm:h-36 sm:w-52">
              {snapshot.localVideoTrack ? (
                <VideoTrackView track={snapshot.localVideoTrack} mirrored />
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

        <aside className="rounded-xl bg-white p-4 text-slate-800">
          <h2 className="font-semibold text-navy-950">Private interviewer notes</h2>
          <p className="mt-1 text-xs text-slate-500">The candidate cannot see this pane.</p>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="Observations, follow-up questions…"
          />
          <h3 className="mt-4 text-sm font-semibold text-navy-950">Evaluation checklist</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {['Clarify constraints', 'Talk through approach', 'Handle follow-ups', 'Summarize trade-offs', 'Leave 5 minutes for feedback'].map(
              (item) => (
                <li key={item}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                    {item}
                  </label>
                </li>
              ),
            )}
          </ul>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <Control
          label={snapshot.micEnabled ? 'Mute' : 'Unmute'}
          active={snapshot.micEnabled}
          disabled={!connected}
          onClick={() => void controller?.toggleMic()}
        >
          {snapshot.micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Control>
        <Control
          label={snapshot.cameraEnabled ? 'Stop video' : 'Start video'}
          active={snapshot.cameraEnabled}
          disabled={!connected}
          onClick={() => void controller?.toggleCamera()}
        >
          {snapshot.cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Control>
        <Button variant="outline" onClick={leaveCall} disabled={ending}>
          <LogOut className="h-4 w-4" />
          Leave call
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

function RemoteStage({ snapshot, candidateName }: { snapshot: CallSnapshot; candidateName: string }) {
  const { candidate, phase } = snapshot
  if (phase === 'idle' || phase === 'requesting_token' || phase === 'connecting') {
    return (
      <StageMessage icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Joining the interview call…" />
    )
  }
  if (candidate.presence === 'joined' && candidate.videoTrack) {
    return (
      <>
        <VideoTrackView track={candidate.videoTrack} />
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
      body="You will see and hear the candidate as soon as they connect."
    />
  )
}

function StageMessage({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80">{icon}</div>
      <p className="text-sm font-medium text-white">{title}</p>
      {body ? <p className="max-w-sm text-xs text-white/60">{body}</p> : null}
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

function VideoTrackView({ track, mirrored = false }: { track: CallTrack; mirrored?: boolean }) {
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
      className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
    />
  )
}

function AudioTrackView({ track }: { track: CallTrack }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track])
  return <audio ref={ref} autoPlay className="hidden" />
}

function Control({
  label,
  children,
  onClick,
  active,
  disabled,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  active: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!active}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-500'
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
