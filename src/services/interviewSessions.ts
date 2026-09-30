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
  | { kind: 'waiting'; startsAtUtc: string; timezone: string }
  | { kind: 'ready' }

export type InterviewSessionBundle = {
  booking: InterviewerBooking
  session: InterviewSessionRecord
}

const SESSION_SELECT = 'id, booking_id, provider, join_token_hash, started_at, ended_at'
const JOIN_CLOCK_SKEW_MS = 60_000

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

export function interviewJoinState(
  booking: InterviewerBooking,
  session: InterviewSessionRecord | null,
  now = new Date(),
): InterviewJoinState {
  if (!session || session.endedAt || !isJoinableStatus(booking.status)) {
    return { kind: 'unavailable' }
  }
  if (booking.status === 'in_progress' || session.startedAt) {
    return { kind: 'ready' }
  }
  const opensAt = Date.parse(booking.startsAtUtc) - JOIN_CLOCK_SKEW_MS
  if (Number.isNaN(opensAt) || now.getTime() < opensAt) {
    return { kind: 'waiting', startsAtUtc: booking.startsAtUtc, timezone: booking.displayTimezone }
  }
  return { kind: 'ready' }
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
 * Records the interviewer joining the call through the shared begin_interview_call
 * RPC (also used by the Candidate app): writes the call_opened / participant_joined
 * session events, marks the session as a LiveKit call and moves a confirmed booking
 * to in_progress.
 */
export async function beginInterviewCall(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('begin_interview_call', { p_session_id: sessionId })
  if (error) throw mapSessionRpcError(error)
}

export type InterviewCallEvent = 'participant_left' | 'call_ended'

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
