import { supabase } from '../lib/supabase.ts'
import { getCurrentInterviewer } from './interviewer.ts'
import { TABLES } from './tables.ts'

export const DB_BOOKING_STATUSES = [
  'pending_payment',
  'requested',
  'confirmed',
  'rejected',
  'cancelled',
  'expired',
  'rescheduled',
  'in_progress',
  'completed',
  'no_show',
] as const

export type DbBookingStatus = (typeof DB_BOOKING_STATUSES)[number]
export type InterviewerBookingTab = 'pending' | 'upcoming' | 'completed' | 'cancelled'

export type InterviewerBookingCandidate = {
  candidateProfileId: string
  name: string
  targetRole: string | null
  candidateLevel: string | null
  skills: string[]
}

export type BookingCandidateSummary = {
  booking_id: string
  candidate_profile_id: string
  display_name: string
  target_role: string | null
  candidate_level: string | null
  skills: string[]
}

export type InterviewerBooking = {
  id: string
  candidateProfileId: string
  interviewerProfileId: string
  serviceId: string
  status: DbBookingStatus
  startsAtUtc: string
  endsAtUtc: string
  displayTimezone: string
  interviewerTimezone: string
  durationMin: number
  sessionFeePaise: number
  platformFeePaise: number
  totalPaise: number
  currency: string
  mode: string
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  serviceName: string
  interviewType: string
  candidate: InterviewerBookingCandidate
}

export const BOOKING_ALREADY_UPDATED = 'This booking has already been updated.'

const BOOKING_COLUMNS = [
  'id',
  'candidate_profile_id',
  'interviewer_profile_id',
  'service_id',
  'status',
  'starts_at',
  'ends_at',
  'display_timezone',
  'interviewer_timezone',
  'duration_min',
  'session_fee_paise',
  'platform_fee_paise',
  'total_paise',
  'currency',
  'mode',
  'rejection_reason',
  'created_at',
  'updated_at',
].join(', ')

const BOOKING_SELECT_CORE = `${BOOKING_COLUMNS}, interviewer_services ( name, interview_type, duration_min )`

const BOOKING_SELECTS = [BOOKING_SELECT_CORE, BOOKING_COLUMNS] as const

const SUMMARY_SELECT = 'booking_id, candidate_profile_id, display_name, target_role, candidate_level, skills'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return isRecord(first) ? first : null
  }
  return isRecord(value) ? value : null
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function isDbBookingStatus(value: string): value is DbBookingStatus {
  return (DB_BOOKING_STATUSES as readonly string[]).includes(value)
}

function fail(error: { message: string; code?: string; details?: string } | null) {
  if (error) throw mapBookingRpcError(error)
}

function errorText(error: { message: string; code?: string; details?: string }) {
  return `${error.code ?? ''} ${error.message} ${error.details ?? ''}`.toLowerCase()
}

export function mapBookingRpcError(error: { message: string; code?: string; details?: string }) {
  const text = errorText(error)
  if (text.includes('invalid_status') || error.code === 'P0001') {
    return new Error(BOOKING_ALREADY_UPDATED)
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    return new Error('You can only update your own booking requests.')
  }
  if (text.includes('booking_not_found') || error.code === 'P0002') {
    return new Error('Booking not found.')
  }
  return new Error(error.message || 'Could not update this booking.')
}

async function myInterviewerProfileId() {
  const account = await getCurrentInterviewer()
  return account.interviewer.id
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function emptyCandidate(candidateProfileId: string): InterviewerBookingCandidate {
  return {
    candidateProfileId,
    name: 'Candidate',
    targetRole: null,
    candidateLevel: null,
    skills: [],
  }
}

function parseSummary(value: unknown): BookingCandidateSummary | null {
  const row = asRecord(value)
  if (!row) return null
  const bookingId = readString(row, 'booking_id')
  const candidateProfileId = readString(row, 'candidate_profile_id')
  const displayName = readString(row, 'display_name')
  if (!bookingId || !candidateProfileId || !displayName) return null
  return {
    booking_id: bookingId,
    candidate_profile_id: candidateProfileId,
    display_name: displayName,
    target_role: readString(row, 'target_role'),
    candidate_level: readString(row, 'candidate_level'),
    skills: readStringArray(row.skills),
  }
}

function candidateFromSummary(
  candidateProfileId: string,
  summary: BookingCandidateSummary | undefined,
): InterviewerBookingCandidate {
  if (!summary) return emptyCandidate(candidateProfileId)
  return {
    candidateProfileId: summary.candidate_profile_id,
    name: summary.display_name.trim() || 'Candidate',
    targetRole: summary.target_role,
    candidateLevel: summary.candidate_level,
    skills: summary.skills,
  }
}

function parseBooking(value: unknown): InterviewerBooking | null {
  const row = asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const candidateProfileId = readString(row, 'candidate_profile_id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const serviceId = readString(row, 'service_id')
  const status = readString(row, 'status')
  const startsAtUtc = readString(row, 'starts_at')
  const endsAtUtc = readString(row, 'ends_at')
  const displayTimezone = readString(row, 'display_timezone')
  const interviewerTimezone = readString(row, 'interviewer_timezone')
  const durationMin = readNumber(row, 'duration_min')
  const sessionFeePaise = readNumber(row, 'session_fee_paise')
  const platformFeePaise = readNumber(row, 'platform_fee_paise')
  const totalPaise = readNumber(row, 'total_paise')
  const currency = readString(row, 'currency')
  const mode = readString(row, 'mode')
  const createdAt = readString(row, 'created_at')
  const updatedAt = readString(row, 'updated_at')
  if (
    !id ||
    !candidateProfileId ||
    !interviewerProfileId ||
    !serviceId ||
    !status ||
    !isDbBookingStatus(status) ||
    !startsAtUtc ||
    !endsAtUtc ||
    !displayTimezone ||
    !interviewerTimezone ||
    durationMin === null ||
    sessionFeePaise === null ||
    platformFeePaise === null ||
    totalPaise === null ||
    !currency ||
    !mode ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  const service = asRecord(row.interviewer_services)
  return {
    id,
    candidateProfileId,
    interviewerProfileId,
    serviceId,
    status,
    startsAtUtc,
    endsAtUtc,
    displayTimezone,
    interviewerTimezone,
    durationMin,
    sessionFeePaise,
    platformFeePaise,
    totalPaise,
    currency,
    mode,
    rejectionReason: readString(row, 'rejection_reason'),
    createdAt,
    updatedAt,
    serviceName: (service && readString(service, 'name')) || 'Interview',
    interviewType: (service && readString(service, 'interview_type')) || 'Interview',
    candidate: emptyCandidate(candidateProfileId),
  }
}

async function getSummariesByBookingId(bookingIds: string[]) {
  const summaries = new Map<string, BookingCandidateSummary>()
  if (bookingIds.length === 0) return summaries
  const { data, error } = await supabase
    .from(TABLES.bookingCandidateSummary)
    .select(SUMMARY_SELECT)
    .in('booking_id', bookingIds)
  fail(error)
  for (const row of data ?? []) {
    const summary = parseSummary(row)
    if (summary) summaries.set(summary.booking_id, summary)
  }
  return summaries
}

function mergeSummaries(bookings: InterviewerBooking[], summaries: Map<string, BookingCandidateSummary>) {
  return bookings.map((booking) => ({
    ...booking,
    candidate: candidateFromSummary(booking.candidateProfileId, summaries.get(booking.id)),
  }))
}

export function tabForBooking(status: DbBookingStatus): InterviewerBookingTab | null {
  if (status === 'requested') return 'pending'
  if (status === 'confirmed' || status === 'in_progress') return 'upcoming'
  if (status === 'completed') return 'completed'
  if (
    status === 'cancelled' ||
    status === 'rejected' ||
    status === 'expired' ||
    status === 'rescheduled' ||
    status === 'no_show'
  ) {
    return 'cancelled'
  }
  return null
}

export function bookingsForTab(bookings: InterviewerBooking[], tab: InterviewerBookingTab) {
  return bookings.filter((item) => tabForBooking(item.status) === tab)
}

export function isActionableBookingRequest(booking: InterviewerBooking) {
  return booking.status === 'requested'
}

async function selectMyBookings(interviewerProfileId: string, select: string) {
  return supabase
    .from(TABLES.bookings)
    .select(select)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('starts_at', { ascending: true })
}

async function selectMyBooking(bookingId: string, interviewerProfileId: string, select: string) {
  return supabase
    .from(TABLES.bookings)
    .select(select)
    .eq('id', bookingId)
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
}

export async function getMyBookings(): Promise<InterviewerBooking[]> {
  const interviewerProfileId = await myInterviewerProfileId()
  let lastError: { message: string; code?: string; details?: string } | null = null
  for (const select of BOOKING_SELECTS) {
    const result = await selectMyBookings(interviewerProfileId, select)
    if (!result.error) {
      const bookings = (result.data ?? [])
        .map(parseBooking)
        .filter((item): item is InterviewerBooking => item !== null)
      const summaries = await getSummariesByBookingId(bookings.map((item) => item.id))
      return mergeSummaries(bookings, summaries)
    }
    lastError = result.error
  }
  fail(lastError)
  return []
}

export async function getMyBooking(bookingId: string): Promise<InterviewerBooking> {
  if (!isUuid(bookingId)) throw new Error('Booking not found.')
  const interviewerProfileId = await myInterviewerProfileId()
  let lastError: { message: string; code?: string; details?: string } | null = null
  for (const select of BOOKING_SELECTS) {
    const result = await selectMyBooking(bookingId, interviewerProfileId, select)
    if (!result.error) {
      const booking = parseBooking(result.data)
      if (!booking) throw new Error('Booking not found.')
      const summaries = await getSummariesByBookingId([booking.id])
      const merged = mergeSummaries([booking], summaries)[0]
      if (!merged) throw new Error('Booking not found.')
      return merged
    }
    lastError = result.error
  }
  fail(lastError)
  throw new Error('Booking not found.')
}

export async function getPendingBookingRequests(): Promise<InterviewerBooking[]> {
  const bookings = await getMyBookings()
  return bookings.filter((item) => item.status === 'requested')
}

export async function getUpcomingBookings(): Promise<InterviewerBooking[]> {
  const bookings = await getMyBookings()
  return bookings.filter((item) => item.status === 'confirmed' || item.status === 'in_progress')
}

export async function getCompletedBookings(): Promise<InterviewerBooking[]> {
  const bookings = await getMyBookings()
  return bookings.filter((item) => item.status === 'completed')
}

export async function getCancelledBookings(): Promise<InterviewerBooking[]> {
  const bookings = await getMyBookings()
  return bookings.filter((item) => tabForBooking(item.status) === 'cancelled')
}

export async function confirmBooking(bookingId: string): Promise<InterviewerBooking> {
  if (!isUuid(bookingId)) throw new Error('Booking not found.')
  const current = await getMyBooking(bookingId)
  if (current.status !== 'requested') {
    throw new Error(BOOKING_ALREADY_UPDATED)
  }
  const { error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId })
  fail(error)
  return getMyBooking(bookingId)
}

export async function rejectBooking(bookingId: string, reason?: string): Promise<InterviewerBooking> {
  if (!isUuid(bookingId)) throw new Error('Booking not found.')
  const current = await getMyBooking(bookingId)
  if (current.status !== 'requested') {
    throw new Error(BOOKING_ALREADY_UPDATED)
  }
  const trimmed = reason?.trim() || null
  const { error } = await supabase.rpc('reject_booking', {
    p_booking_id: bookingId,
    p_reason: trimmed,
  })
  fail(error)
  return getMyBooking(bookingId)
}
