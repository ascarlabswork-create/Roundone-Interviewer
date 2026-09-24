import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Skeleton } from '../components/ui/primitives.tsx'
import { formatDateLongInZone, formatDateShortInZone, formatTimeInZone, timezoneLabel } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  endInterviewSession,
  getInterviewSession,
  interviewJoinState,
  startInterviewSession,
  type InterviewSessionRecord,
} from '../services/interviewSessions.ts'
import type { InterviewerBooking } from '../services/interviewerBookings.ts'

const codingProblem = {
  title: 'Design an LRU Cache',
  prompt:
    'Implement an LRU (Least Recently Used) cache with get and put in O(1). Follow-up: how would you shard this across machines?',
  starter: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
  }

  get(key) {
    return -1
  }

  put(key, value) {

  }
}`,
  tests: [
    { name: 'get missing key', result: 'pass' },
    { name: 'evicts least recently used', result: 'fail' },
    { name: 'updates existing key', result: 'idle' },
  ],
}

const designPrompt = {
  title: 'Design a URL shortener',
  question:
    'Design a URL shortening service like bit.ly. Cover API, storage, unique ID generation, redirects, and scale to 100M new URLs per day.',
}

function formatRemaining(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00' }
  const totalSeconds = Math.ceil(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const formatted = days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`
  return { days, hours, minutes, seconds, formatted }
}

export function InterviewRoomPage() {
  const { id = '' } = useParams()
  const initial = useAsync(() => getInterviewSession(id), [id])
  const [activeOverride, setActiveOverride] = useState<{
    booking: InterviewerBooking
    session: InterviewSessionRecord | null
  } | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const { reload } = initial
  const bundle = activeOverride ?? (initial.status === 'success' ? initial.data : null)

  // Local second-by-second countdown tick for waiting room
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Lightweight background polling (30s) and focus revalidation while not in active room
  useEffect(() => {
    if (!bundle) return
    const isStarted = Boolean(bundle.session?.startedAt) || bundle.booking.status === 'in_progress'
    if (isStarted || bundle.booking.status === 'completed') return

    const pollTimer = window.setInterval(() => {
      reload()
    }, 30_000)
    const onFocus = () => {
      reload()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(pollTimer)
      window.removeEventListener('focus', onFocus)
    }
  }, [bundle, reload])

  async function handleEnterInterview() {
    if (starting || !bundle) return
    setStarting(true)
    setStartError(null)
    try {
      const result = await startInterviewSession(bundle.booking.id)
      setActiveOverride({ booking: result.booking, session: result.session })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not start this interview. Please try again.'
      // Check if session was already started in another tab
      try {
        const latest = await getInterviewSession(bundle.booking.id)
        if (latest.session?.startedAt || latest.booking.status === 'in_progress') {
          setActiveOverride(latest)
          return
        }
      } catch {
        // ignore fallback failure
      }
      setStartError(message)
    } finally {
      setStarting(false)
    }
  }

  if (!bundle) {
    if (initial.status === 'loading') {
      return (
        <div className="flex min-h-svh flex-col bg-navy-950 text-white">
          <header className="border-b border-white/10 px-4 py-3">
            <Logo inverted to="/interviewer/dashboard" />
          </header>
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur shadow-2xl">
              <Skeleton className="h-6 bg-white/10" />
              <Skeleton className="h-20 bg-white/10" />
              <Skeleton className="h-10 bg-white/10" />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-svh flex-col bg-navy-950 text-white">
        <header className="border-b border-white/10 px-4 py-3">
          <Logo inverted to="/interviewer/dashboard" />
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center backdrop-blur shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-white">Unable to Open Interview</h1>
            <p className="mt-2 text-sm text-white/70">{initial.error ?? 'This booking is no longer available.'}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => void initial.reload()} fullWidth>
                Try Again
              </Button>
              <Link to="/interviewer/bookings">
                <Button fullWidth variant="outline">
                  Back to Bookings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { booking, session } = bundle

  // Status-specific redirects / alerts
  if (booking.status === 'requested') {
    return (
      <div className="flex min-h-svh flex-col bg-navy-950 text-white">
        <header className="border-b border-white/10 px-4 py-3">
          <Logo inverted to="/interviewer/dashboard" />
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center backdrop-blur shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-white">Booking Pending Confirmation</h1>
            <p className="mt-2 text-sm text-white/70">
              This booking request from {booking.candidate.name} has not been confirmed yet. Confirm the request before
              starting the interview.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to={`/interviewer/bookings?tab=pending&booking=${booking.id}`}>
                <Button fullWidth>Review Request</Button>
              </Link>
              <Link to="/interviewer/bookings">
                <Button fullWidth variant="outline">
                  Back to Bookings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (booking.status === 'completed' || session?.endedAt) {
    return (
      <div className="flex min-h-svh flex-col bg-navy-950 text-white">
        <header className="border-b border-white/10 px-4 py-3">
          <Logo inverted to="/interviewer/dashboard" />
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center backdrop-blur shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-white">Interview Completed</h1>
            <p className="mt-2 text-sm text-white/70">
              This interview session with {booking.candidate.name} has already ended.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to={`/interviewer/feedback/${booking.id}`}>
                <Button fullWidth>View / Give Feedback</Button>
              </Link>
              <Link to="/interviewer/bookings?tab=completed">
                <Button fullWidth variant="outline">
                  Back to Bookings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (
    booking.status === 'cancelled' ||
    booking.status === 'rejected' ||
    booking.status === 'expired' ||
    booking.status === 'no_show'
  ) {
    return (
      <div className="flex min-h-svh flex-col bg-navy-950 text-white">
        <header className="border-b border-white/10 px-4 py-3">
          <Logo inverted to="/interviewer/dashboard" />
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center backdrop-blur shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/20 text-slate-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-white">Interview Not Available</h1>
            <p className="mt-2 text-sm text-white/70">
              This booking is marked as <span className="font-semibold text-white">{booking.status}</span> and cannot be
              opened.
            </p>
            <div className="mt-6">
              <Link to="/interviewer/bookings">
                <Button fullWidth variant="outline">
                  Back to Bookings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Active in-progress interview room: open immediately without start RPC
  const isStarted = Boolean(session?.startedAt) || booking.status === 'in_progress'
  if (isStarted && session) {
    return <ActiveInterviewRoom booking={booking} session={session} />
  }

  // Pre-session waiting & ready room
  const joinState = interviewJoinState(booking, session, new Date(nowMs))
  const startsAtMs = Date.parse(booking.startsAtUtc)
  const opensAtMs = startsAtMs - 60_000
  const msToWindow = Math.max(0, opensAtMs - nowMs)
  const msToStart = Math.max(0, startsAtMs - nowMs)
  const isReady = joinState.kind === 'ready' || msToWindow === 0

  return (
    <WaitingRoom
      booking={booking}
      isReady={isReady}
      msToStart={msToStart}
      msToWindow={msToWindow}
      onEnter={handleEnterInterview}
      starting={starting}
      startError={startError}
    />
  )
}

function WaitingRoom({
  booking,
  isReady,
  msToStart,
  msToWindow,
  onEnter,
  starting,
  startError,
}: {
  booking: InterviewerBooking
  isReady: boolean
  msToStart: number
  msToWindow: number
  onEnter: () => void
  starting: boolean
  startError: string | null
}) {
  const countdown = formatRemaining(msToStart)
  const windowRemaining = formatRemaining(msToWindow)
  const roleLine = [booking.candidate.targetRole, booking.candidate.candidateLevel].filter(Boolean).join(' · ')

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo inverted to="/interviewer/dashboard" />
          <span className="hidden text-sm text-white/60 sm:inline">Waiting Room</span>
        </div>
        <Link
          to="/interviewer/bookings?tab=upcoming"
          className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Bookings
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wider text-white/50">Interview Session</span>
            {isReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Ready to Start
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
                <Clock className="h-3.5 w-3.5" />
                Scheduled · Waiting for Window
              </span>
            )}
          </div>

          <div className="mt-4 border-b border-white/10 pb-5">
            <h1 className="text-2xl font-bold text-white">{booking.candidate.name}</h1>
            {roleLine ? <p className="mt-1 text-sm text-white/70">{roleLine}</p> : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {booking.candidate.skills.map((skill) => (
                <span key={skill} className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="py-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">
              {isReady ? 'Session Opens' : 'Interview Starts In'}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 font-mono sm:gap-3">
              {countdown.days > 0 ? (
                <>
                  <div className="flex min-w-[56px] flex-col items-center rounded-xl bg-white/10 px-2.5 py-2 sm:min-w-[64px] sm:px-3 sm:py-2.5">
                    <span className="text-2xl font-bold sm:text-3xl">{countdown.days}</span>
                    <span className="text-[10px] uppercase text-white/60">Days</span>
                  </div>
                  <span className="text-xl font-bold text-white/40">:</span>
                </>
              ) : null}
              <div className="flex min-w-[56px] flex-col items-center rounded-xl bg-white/10 px-2.5 py-2 sm:min-w-[64px] sm:px-3 sm:py-2.5">
                <span className="text-2xl font-bold sm:text-3xl">{String(countdown.hours).padStart(2, '0')}</span>
                <span className="text-[10px] uppercase text-white/60">Hours</span>
              </div>
              <span className="text-xl font-bold text-white/40">:</span>
              <div className="flex min-w-[56px] flex-col items-center rounded-xl bg-white/10 px-2.5 py-2 sm:min-w-[64px] sm:px-3 sm:py-2.5">
                <span className="text-2xl font-bold sm:text-3xl">{String(countdown.minutes).padStart(2, '0')}</span>
                <span className="text-[10px] uppercase text-white/60">Mins</span>
              </div>
              <span className="text-xl font-bold text-white/40">:</span>
              <div className="flex min-w-[56px] flex-col items-center rounded-xl bg-white/10 px-2.5 py-2 sm:min-w-[64px] sm:px-3 sm:py-2.5">
                <span className="text-2xl font-bold sm:text-3xl">{String(countdown.seconds).padStart(2, '0')}</span>
                <span className="text-[10px] uppercase text-white/60">Secs</span>
              </div>
            </div>

            <p className="mt-4 text-xs text-white/60">
              {isReady
                ? 'The interview window is open. Click Enter Interview when you and the candidate are ready.'
                : 'Interview room opens 1 minute before scheduled start time.'}
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-4 text-xs text-white/80">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white/50 shrink-0" />
                <span>{formatDateLongInZone(booking.startsAtUtc, booking.displayTimezone)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-white/50 shrink-0" />
                <span>
                  {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} ({timezoneLabel(booking.displayTimezone)})
                </span>
              </div>
              <div className="sm:col-span-2 text-white/60">
                {booking.serviceName} · {booking.interviewType} · {booking.durationMin} min · Ref {booking.id.slice(0, 8)}
              </div>
            </div>
          </div>

          {startError ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-200">
              {startError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            {isReady ? (
              <Button size="lg" fullWidth onClick={onEnter} disabled={starting}>
                {starting ? 'Entering Interview…' : 'Enter Interview'}
              </Button>
            ) : (
              <Button size="lg" fullWidth disabled className="opacity-50 cursor-not-allowed">
                Enter Interview (Opens in {windowRemaining.formatted})
              </Button>
            )}
            <Link to="/interviewer/dashboard">
              <Button variant="ghost" fullWidth size="sm">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function formatInterviewClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function remainingInterviewSeconds(
  durationMin: number,
  startedAtIso: string,
  nowMs = Date.now(),
  endedAtIso?: string | null,
) {
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null
  const startedAtMs = Date.parse(startedAtIso)
  if (Number.isNaN(startedAtMs)) return null
  const durationSeconds = durationMin * 60
  const endMs = endedAtIso ? Date.parse(endedAtIso) : nowMs
  const referenceMs = Number.isNaN(endMs) ? nowMs : endMs
  return Math.max(0, durationSeconds - Math.floor((referenceMs - startedAtMs) / 1000))
}

function ActiveInterviewRoom({
  booking,
  session,
}: {
  booking: InterviewerBooking
  session: InterviewSessionRecord
}) {
  const navigate = useNavigate()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [notes, setNotes] = useState('Private notes. The candidate cannot see this pane.')
  const [code, setCode] = useState(codingProblem.starter)
  const [ran, setRan] = useState(false)
  const [mobileTab, setMobileTab] = useState<'video' | 'work' | 'notes'>('video')
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)

  const startedAt = session.startedAt
  const endedAt = session.endedAt
  const durationMin = booking.durationMin
  const sessionEnded = Boolean(endedAt) || booking.status === 'completed'
  const remainingSeconds = useMemo(() => {
    if (!startedAt) return null
    return remainingInterviewSeconds(durationMin, startedAt, nowMs, sessionEnded ? endedAt : null)
  }, [durationMin, startedAt, endedAt, sessionEnded, nowMs])
  const durationElapsed = remainingSeconds === 0

  useEffect(() => {
    if (sessionEnded || !startedAt) return
    if (!Number.isFinite(durationMin) || durationMin <= 0) return

    const tick = () => {
      const next = Date.now()
      setNowMs(next)
      const remaining = remainingInterviewSeconds(durationMin, startedAt, next, null)
      if (remaining !== null && remaining <= 0) {
        window.clearInterval(timer)
      }
    }

    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [sessionEnded, startedAt, durationMin])

  const clock = remainingSeconds === null ? '--:--' : formatInterviewClock(remainingSeconds)

  const candidateName = booking.candidate.name
  const isCoding = booking.interviewType.toLowerCase().includes('coding')

  async function endSession() {
    setEnding(true)
    setEndError(null)
    try {
      await endInterviewSession(booking.id)
      navigate(`/interviewer/feedback/${booking.id}`)
    } catch (caught) {
      setEndError(caught instanceof Error ? caught.message : 'Could not complete this interview.')
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo inverted to="/interviewer/dashboard" />
          <div className="hidden text-sm sm:block">
            <p className="font-medium">{candidateName}</p>
            <p className="text-white/70">{booking.serviceName}</p>
            <p className="text-xs text-white/50">
              {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
              {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
              {timezoneLabel(booking.displayTimezone)}
            </p>
            <p className="text-xs text-white/40">
              {booking.candidate.targetRole || 'Candidate'} · Stub workspace · Booking {booking.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md px-3 py-1 font-mono text-sm ${
                durationElapsed ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-white'
              }`}
              title={
                remainingSeconds === null
                  ? 'Interview duration is unavailable'
                  : durationElapsed
                    ? 'Scheduled duration has elapsed'
                    : `${durationMin} minute session`
              }
            >
              {clock}
            </span>
            <Button variant="danger" size="sm" onClick={() => void endSession()} disabled={ending}>
              {ending ? 'Ending…' : 'End Session'}
            </Button>
          </div>
          {durationElapsed ? (
            <p className="text-[11px] text-amber-200/80">Scheduled duration elapsed · End when ready</p>
          ) : null}
          {remainingSeconds === null ? (
            <p className="text-[11px] text-white/50">Duration unavailable</p>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 border-b border-white/10 px-4 py-2 md:hidden">
        {(['video', 'work', 'notes'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMobileTab(item)}
            className={`rounded-md px-3 py-1 text-sm capitalize ${mobileTab === item ? 'bg-white text-navy-950' : 'bg-white/10'}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`space-y-4 ${mobileTab !== 'video' && mobileTab !== 'work' ? 'hidden md:block' : ''}`}>
          <div className={`grid gap-3 ${mobileTab === 'work' ? 'hidden md:grid' : 'grid'} md:grid-cols-3`}>
            <div className="relative min-h-48 rounded-xl bg-navy-800 md:col-span-2">
              <div className="flex h-full items-center justify-center text-sm text-white/80">
                {cameraOff ? 'Camera off' : `${candidateName} · candidate video`}
              </div>
            </div>
            <div className="relative min-h-32 rounded-xl bg-navy-800">
              <div className="flex h-full items-center justify-center text-sm text-white/70">You · interviewer</div>
            </div>
          </div>

          <div className={`${mobileTab === 'video' ? 'hidden md:block' : ''}`}>
            {isCoding ? (
              <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="rounded-xl bg-white p-4 text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">Problem</p>
                  <h2 className="mt-2 font-semibold text-navy-950">{codingProblem.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{codingProblem.prompt}</p>
                  <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Test cases</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {codingProblem.tests.map((test) => (
                      <li key={test.name}>
                        {ran && test.result === 'pass' ? '✓' : ran && test.result === 'fail' ? '✕' : '○'} {test.name}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-4" size="sm" onClick={() => setRan(true)}>
                    Run Code
                  </Button>
                </div>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="min-h-72 rounded-xl bg-[#0f172a] p-4 font-mono text-sm text-slate-100 outline-none"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4 text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">Question</p>
                  <h2 className="mt-2 font-semibold text-navy-950">{designPrompt.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{designPrompt.question}</p>
                  <label className="mt-4 block text-sm font-medium text-navy-950" htmlFor="arch-notes">
                    Architecture notes
                  </label>
                  <textarea
                    id="arch-notes"
                    className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm"
                    placeholder="Clients → API → cache → DB..."
                  />
                </div>
                <div className="min-h-72 rounded-xl border border-dashed border-white/20 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:24px_24px] p-4">
                  <p className="text-sm text-white/70">Whiteboard</p>
                  <div className="mt-8 flex justify-center gap-6 text-xs text-white/80">
                    <span className="rounded-md border border-white/30 px-4 py-3">Client</span>
                    <span className="self-center">→</span>
                    <span className="rounded-md border border-white/30 px-4 py-3">API</span>
                    <span className="self-center">→</span>
                    <span className="rounded-md border border-white/30 px-4 py-3">Store</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className={`rounded-xl bg-white p-4 text-slate-800 ${mobileTab === 'notes' ? 'block' : 'hidden'} lg:block`}>
          <h2 className="font-semibold text-navy-950">Private interviewer notes</h2>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 p-3 text-sm"
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
        <Control label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((value) => !value)}>
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Control>
        <Control label={cameraOff ? 'Start video' : 'Video'} onClick={() => setCameraOff((value) => !value)}>
          {cameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Control>
        <Control label="Screen Share">
          <MonitorUp className="h-4 w-4" />
        </Control>
        <Control label="Chat">
          <MessageSquare className="h-4 w-4" />
        </Control>
        <Control label="More">
          <MoreHorizontal className="h-4 w-4" />
        </Control>
        <Button variant="danger" onClick={() => void endSession()} disabled={ending}>
          <PhoneOff className="h-4 w-4" />
          {ending ? 'Ending…' : 'End Interview'}
        </Button>
      </div>
      {endError ? <p className="px-4 pb-3 text-center text-sm text-red-300">{endError}</p> : null}
    </div>
  )
}

function Control({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
