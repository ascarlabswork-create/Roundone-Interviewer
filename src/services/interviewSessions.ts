import { supabase } from '../lib/supabase.ts'
import { getFeedbackBookingIds } from './interviewerFeedback.ts'
import { getMyBooking, getMyBookings, type InterviewerBooking } from './interviewerBookings.ts'
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

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
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

export async function startInterviewSession(bookingId: string): Promise<InterviewSessionBundle> {
  const booking = await getMyBooking(bookingId)
  if (booking.status === 'requested') {
    throw new Error('This booking is still a request. Confirm it before joining the interview.')
  }
  const session = await getInterviewSessionByBooking(booking.id)
  const state = interviewJoinState(booking, session)
  if (state.kind === 'waiting') {
    throw new Error('This interview has not started yet.')
  }
  if (state.kind !== 'ready' || !session) {
    throw new Error('You cannot join this interview.')
  }
  return { booking, session }
}

export async function endInterviewSession(bookingId: string): Promise<InterviewSessionBundle> {
  const booking = await getMyBooking(bookingId)
  const session = await getInterviewSessionByBooking(booking.id)
  if (!session) throw new Error('Interview session not found.')
  return { booking, session }
}
