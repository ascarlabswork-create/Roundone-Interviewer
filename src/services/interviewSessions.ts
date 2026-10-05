import {
  interviewPhase,
  interviewSchedule,
  serverClockOffset,
  type InterviewSchedule,
} from '../lib/interviewTiming.ts'
import { supabase } from '../lib/supabase.ts'
import { getFeedbackBookingIds } from './interviewerFeedback.ts'
import { getMyBooking, getMyBookings, isBookingId, type InterviewerBooking } from './interviewerBookings.ts'
import { TABLES } from './tables.ts'

export type InterviewSessionRecord = {
  id: string
  bookingId: string
  provider: string
  joinTokenHash: string | null
  startedAt: string | null
  endedAt: string | null
}

export type InterviewJoinState =
  | { kind: 'unavailable' }
  | { kind: 'waiting'; startsAtUtc: string; timezone: string; lobbyOpensAtMs: number; callOpensAtMs: number }
  | { kind: 'lobby'; roomOpen: boolean }
  | { kind: 'ready' }

export type InterviewSessionBundle = {
  booking: InterviewerBooking
  session: InterviewSessionRecord
}

const SESSION_SELECT = 'id, booking_id, provider, join_token_hash, started_at, ended_at'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function fail(error: { message?: string; code?: string } | null) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  throw new Error('Could not load this interview session. Check your connection and try again.')
}

function parseSession(value: unknown): InterviewSessionRecord | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const bookingId = readString(value, 'booking_id')
  const provider = readString(value, 'provider')
  if (!id || !bookingId || !provider) return null
  return {
    id,
    bookingId,
    provider,
    joinTokenHash: readString(value, 'join_token_hash'),
    startedAt: readString(value, 'started_at'),
    endedAt: readString(value, 'ended_at'),
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function isJoinableStatus(status: InterviewerBooking['status']) {
  return status === 'confirmed' || status === 'in_progress'
}

/** Which entry point to show for a booking; the server re-checks every call entry against its own clock. */
export function interviewJoinState(
  booking: InterviewerBooking,
  session: InterviewSessionRecord | null,
  now = new Date(),
): InterviewJoinState {
  if (!session || session.endedAt || !isJoinableStatus(booking.status)) {
    return { kind: 'unavailable' }
  }
  const schedule = interviewSchedule(booking.startsAtUtc, booking.durationMin)
  if (!schedule) return { kind: 'unavailable' }
  const phase = interviewPhase(schedule, now.getTime())
  if (phase === 'scheduled') {
    return {
      kind: 'waiting',
      startsAtUtc: booking.startsAtUtc,
      timezone: booking.displayTimezone,
      lobbyOpensAtMs: schedule.lobbyOpensAt,
      callOpensAtMs: schedule.callOpensAt,
    }
  }
  if (phase === 'lobby') {
    return { kind: 'lobby', roomOpen: now.getTime() >= schedule.callOpensAt }
  }
  if (phase === 'live') return { kind: 'ready' }
  return { kind: 'unavailable' }
}

export type InterviewTimingPhase = 'scheduled' | 'lobby' | 'live' | 'ended' | 'closed'
export type NoShowRole = 'candidate' | 'interviewer'

export type InterviewTiming = {
  phase: InterviewTimingPhase
  status: string
  schedule: InterviewSchedule
  /** Add to Date.now() to get the server clock. */
  serverOffsetMs: number
  roundTripMs: number
  canJoin: boolean
  hasJoined: boolean
  sessionEnded: boolean
  candidateJoined: boolean
  candidatePresence: 'in_call' | 'left' | null
  candidateInLobby: boolean
  admission: string | null
  noShowRole: NoShowRole | null
}

const TIMING_PHASES: InterviewTimingPhase[] = ['scheduled', 'lobby', 'live', 'ended', 'closed']

function readTime(row: Record<string, unknown>, key: string) {
  const value = readString(row, key)
  const ms = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(ms) ? null : ms
}

export function parseInterviewTiming(
  value: unknown,
  requestStartedMs: number,
  responseReceivedMs: number,
): InterviewTiming {
  if (!isRecord(value)) throw new Error('Could not load the interview schedule. Try again.')
  const phase = readString(value, 'phase') as InterviewTimingPhase | null
  const lobbyOpensAt = readTime(value, 'lobby_opens_at')
  const startsAt = readTime(value, 'starts_at')
  const joinDeadline = readTime(value, 'join_deadline')
  const endsAt = readTime(value, 'ends_at')
  const serverNow = readString(value, 'server_now')
  if (
    !phase ||
    !TIMING_PHASES.includes(phase) ||
    lobbyOpensAt === null ||
    startsAt === null ||
    joinDeadline === null ||
    endsAt === null ||
    !serverNow
  ) {
    throw new Error('Could not load the interview schedule. Try again.')
  }
  const callOpensAt = readTime(value, 'call_opens_at') ?? startsAt - 15 * 60_000
  const presence = readString(value, 'candidate_presence')
  const noShow = readString(value, 'no_show_role')
  return {
    phase,
    status: readString(value, 'status') ?? '',
    schedule: { lobbyOpensAt, callOpensAt, startsAt, joinDeadline, endsAt },
    serverOffsetMs: serverClockOffset(serverNow, requestStartedMs, responseReceivedMs),
    roundTripMs: Math.max(0, responseReceivedMs - requestStartedMs),
    canJoin: value.can_join === true,
    hasJoined: value.has_joined === true,
    sessionEnded: readString(value, 'session_ended_at') !== null,
    candidateJoined: value.candidate_joined === true,
    candidatePresence: presence === 'in_call' || presence === 'left' ? presence : null,
    candidateInLobby: value.candidate_in_lobby === true,
    admission: readString(value, 'admission'),
    noShowRole: noShow === 'candidate' || noShow === 'interviewer' ? noShow : null,
  }
}

/** Server-clock schedule and participant status for one session (participants only). */
export async function getInterviewTiming(sessionId: string): Promise<InterviewTiming> {
  const startedMs = Date.now()
  const { data, error } = await supabase.rpc('get_interview_timing', { p_session_id: sessionId })
  const receivedMs = Date.now()
  if (error) throw mapSessionRpcError(error)
  return parseInterviewTiming(data, startedMs, receivedMs)
}

/** Records that the candidate missed the late-join deadline; the server verifies the deadline and attendance. */
export async function markInterviewNoShow(sessionId: string): Promise<NoShowRole> {
  const { data, error } = await supabase.rpc('mark_interview_no_show', { p_session_id: sessionId })
  if (error) throw mapSessionRpcError(error)
  const absent = isRecord(data) ? readString(data, 'absent_role') : null
  return absent === 'interviewer' ? 'interviewer' : 'candidate'
}

export async function getInterviewSession(bookingId: string): Promise<{
  booking: InterviewerBooking
  session: InterviewSessionRecord | null
}> {
  const booking = await getMyBooking(bookingId)
  const session = await getInterviewSessionByBooking(booking.id)
  return { booking, session }
}

export async function getInterviewSessionsByBookingIds(
  bookingIds: string[],
): Promise<Map<string, InterviewSessionRecord>> {
  const sessions = new Map<string, InterviewSessionRecord>()
  if (bookingIds.length === 0) return sessions
  const { data, error } = await supabase
    .from(TABLES.interviewSessions)
    .select(SESSION_SELECT)
    .in('booking_id', bookingIds)
  fail(error)
  for (const row of data ?? []) {
    const session = parseSession(row)
    if (session) sessions.set(session.bookingId, session)
  }
  return sessions
}

export async function getInterviewSessionByBooking(
  bookingId: string,
  options?: { retries?: number },
): Promise<InterviewSessionRecord | null> {
  const booking = await getMyBooking(bookingId)
  const retries = options?.retries ?? (isJoinableStatus(booking.status) ? 4 : 0)
  let last: InterviewSessionRecord | null = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data, error } = await supabase
      .from(TABLES.interviewSessions)
      .select(SESSION_SELECT)
      .eq('booking_id', booking.id)
      .maybeSingle()
    fail(error)
    last = parseSession(data)
    if (last || !isJoinableStatus(booking.status)) return last
    if (attempt < retries) await sleep(150 * (attempt + 1))
  }
  return last
}

export async function loadMyInterviewBoard(): Promise<{
  bookings: InterviewerBooking[]
  sessions: Map<string, InterviewSessionRecord>
  feedbackBookingIds: Set<string>
}> {
  const bookings = await getMyBookings()
  const bookingIds = bookings.map((item) => item.id)
  const [sessions, feedbackBookingIds] = await Promise.all([
    getInterviewSessionsByBookingIds(bookingIds),
    getFeedbackBookingIds(bookingIds),
  ])
  return { bookings, sessions, feedbackBookingIds }
}

function mapSessionRpcError(error: { message: string; code?: string; details?: string }) {
  const text = `${error.code ?? ''} ${error.message} ${error.details ?? ''}`.toLowerCase()
  if (text.includes('booking_not_confirmed')) {
    return new Error('This interview is not confirmed yet.')
  }
  if (text.includes('session_expired')) {
    return new Error('This interview session has ended.')
  }
  if (text.includes('interview_not_started')) {
    return new Error('The interview room opens 15 minutes before the scheduled start.')
  }
  if (text.includes('join_window_closed') || text.includes('join_deadline_passed')) {
    return new Error('Interview join window has closed.')
  }
  if (text.includes('join_window_open')) {
    return new Error('The candidate can still join until the late-join deadline.')
  }
  if (text.includes('participant_joined')) {
    return new Error('The candidate joined this interview, so it cannot be marked as a no-show.')
  }
  if (text.includes('lobby_not_open')) {
    return new Error('The pre-interview lobby is not open.')
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    return new Error('You can only update your own interview sessions.')
  }
  if (text.includes('booking_not_found') || text.includes('session_not_found') || error.code === 'P0002') {
    return new Error('Interview session not found.')
  }
  if (text.includes('invalid_status') || error.code === 'P0001') {
    return new Error('This interview cannot be updated from its current status.')
  }
  return new Error('Could not update this interview session. Try again.')
}

/**
 * Accepts either an interview session id (canonical call route) or a booking id
 * (older links) and returns the booking with its session.
 */
export async function resolveInterviewRoute(id: string): Promise<{
  booking: InterviewerBooking
  session: InterviewSessionRecord | null
}> {
  if (!isBookingId(id)) throw new Error('This booking is no longer available.')
  const { data, error } = await supabase
    .from(TABLES.interviewSessions)
    .select(SESSION_SELECT)
    .eq('id', id)
    .maybeSingle()
  fail(error)
  const session = parseSession(data)
  if (session) {
    const booking = await getMyBooking(session.bookingId)
    return { booking, session }
  }
  return getInterviewSession(id)
}

/**
 * Records the interviewer joining the LiveKit room through the shared begin_interview_call
 * RPC. Presence is stored immediately; call_opened / started_at / in_progress are applied
 * only at the scheduled start.
 */
export async function beginInterviewCall(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('begin_interview_call', { p_session_id: sessionId })
  if (error) throw mapSessionRpcError(error)
}

export type InterviewCallEvent = 'participant_left' | 'call_ended' | 'lobby_entered'

export async function recordInterviewCallEvent(sessionId: string, event: InterviewCallEvent): Promise<void> {
  const { error } = await supabase.rpc('record_interview_call_event', { p_session_id: sessionId, p_event: event })
  if (error) throw mapSessionRpcError(error)
}

export async function endInterviewSession(bookingId: string): Promise<InterviewSessionBundle> {
  const { error } = await supabase.rpc('complete_interview_session', { p_booking_id: bookingId })
  if (error) throw mapSessionRpcError(error)
  const booking = await getMyBooking(bookingId)
  const session = await getInterviewSessionByBooking(booking.id)
  if (!session) throw new Error('Interview session not found.')
  return { booking, session }
}
