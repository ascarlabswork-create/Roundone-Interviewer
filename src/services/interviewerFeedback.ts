import { supabase } from '../lib/supabase.ts'
import type { DbBookingStatus } from './interviewerBookings.ts'
import { TABLES } from './tables.ts'

export const READINESS_LEVELS = ['ready', 'almost_ready', 'needs_more_practice'] as const
export type ReadinessLevel = (typeof READINESS_LEVELS)[number]

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  ready: 'Ready',
  almost_ready: 'Almost Ready',
  needs_more_practice: 'Needs More Practice',
}

export const FEEDBACK_ALREADY_SUBMITTED = 'Feedback has already been submitted for this interview.'
export const FEEDBACK_NOT_COMPLETED = 'Feedback can only be submitted after the interview is completed.'
export const FEEDBACK_UNAUTHORIZED = 'You can only submit feedback for your own interviews.'
export const FEEDBACK_INVALID_SCORE = 'Scores must be between 1 and 5.'
export const FEEDBACK_MISSING_FIELDS = 'Please complete all required fields.'
export const FEEDBACK_GENERIC_ERROR = 'Could not submit feedback. Please try again.'
export const FEEDBACK_NETWORK_ERROR = 'Could not connect. Check your internet connection and try again.'

export type InterviewerFeedbackRecord = {
  id: string
  bookingId: string
  interviewerProfileId: string
  candidateProfileId: string
  technicalSkills: number
  problemSolving: number
  communication: number
  systemDesign: number | null
  coding: number | null
  behavioral: number | null
  overall: number
  strengths: string[]
  improvements: string[]
  summary: string
  readiness: ReadinessLevel
  /** Interviewer-only. Never present on interviewer_feedback_for_candidate. */
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

export type SubmitInterviewerFeedbackInput = {
  bookingId: string
  technicalSkills: number
  problemSolving: number
  communication: number
  overall: number
  strengths: string[]
  improvements: string[]
  summary: string
  readiness: ReadinessLevel
  systemDesign?: number | null
  coding?: number | null
  behavioral?: number | null
  internalNotes?: string | null
}

const FEEDBACK_COLUMNS = [
  'id',
  'booking_id',
  'interviewer_profile_id',
  'candidate_profile_id',
  'technical_skills',
  'problem_solving',
  'communication',
  'system_design',
  'coding',
  'behavioral',
  'overall',
  'strengths',
  'improvements',
  'summary',
  'readiness',
  'internal_notes',
  'created_at',
  'updated_at',
].join(', ')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export function isReadinessLevel(value: string): value is ReadinessLevel {
  return (READINESS_LEVELS as readonly string[]).includes(value)
}

export function isFeedbackScore(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function interviewerFeedbackAction(
  status: DbBookingStatus,
  alreadySubmitted: boolean,
): 'give' | 'submitted' | null {
  if (status !== 'completed') return null
  return alreadySubmitted ? 'submitted' : 'give'
}

export function canSubmitInterviewerFeedback(status: DbBookingStatus, alreadySubmitted: boolean) {
  return interviewerFeedbackAction(status, alreadySubmitted) === 'give'
}

function errorText(error: { message: string; code?: string; details?: string; hint?: string }) {
  return `${error.code ?? ''} ${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
}

function isNetworkFailure(error: unknown) {
  if (error instanceof TypeError) return true
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)
}

export function mapFeedbackRpcError(
  error: { message: string; code?: string; details?: string; hint?: string },
  kind: 'load' | 'submit' = 'submit',
) {
  const text = errorText(error)
  if (isNetworkFailure(error) || text.includes('failed to fetch') || text.includes('network')) {
    return new Error(FEEDBACK_NETWORK_ERROR)
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    return new Error(FEEDBACK_UNAUTHORIZED)
  }
  if (text.includes('booking_not_found') || error.code === 'P0002') {
    return new Error('Booking not found.')
  }
  if (
    error.code === '23505' ||
    error.code === '409' ||
    text.includes('interviewer_feedback_booking_id') ||
    text.includes('duplicate key') ||
    text.includes('already exists')
  ) {
    return new Error(FEEDBACK_ALREADY_SUBMITTED)
  }
  if (text.includes('invalid_status') || error.code === 'P0001') {
    return new Error(FEEDBACK_NOT_COMPLETED)
  }
  if (
    error.code === '23514' ||
    text.includes('interviewer_feedback_scores_chk') ||
    text.includes('scores_chk')
  ) {
    return new Error(FEEDBACK_INVALID_SCORE)
  }
  if (error.code === '23502' || text.includes('null value') || text.includes('not-null')) {
    return new Error(FEEDBACK_MISSING_FIELDS)
  }
  return new Error(kind === 'load' ? 'Could not load feedback. Please try again.' : FEEDBACK_GENERIC_ERROR)
}

export function validateFeedbackInput(input: SubmitInterviewerFeedbackInput) {
  if (!isUuid(input.bookingId)) return 'Booking not found.'
  if (
    !isFeedbackScore(input.technicalSkills) ||
    !isFeedbackScore(input.problemSolving) ||
    !isFeedbackScore(input.communication) ||
    !isFeedbackScore(input.overall)
  ) {
    return 'Please rate overall performance, technical knowledge, problem solving, and communication from 1 to 5.'
  }
  for (const optional of [input.systemDesign, input.coding, input.behavioral]) {
    if (optional != null && !isFeedbackScore(optional)) return FEEDBACK_INVALID_SCORE
  }
  if (!input.summary.trim()) return 'Please add a summary for the candidate.'
  if (!isReadinessLevel(input.readiness)) return 'Please select a readiness level.'
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return isRecord(first) ? first : null
  }
  return isRecord(value) ? value : null
}

function parseFeedback(value: unknown): InterviewerFeedbackRecord | null {
  const row = asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const bookingId = readString(row, 'booking_id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const candidateProfileId = readString(row, 'candidate_profile_id')
  const technicalSkills = readNumber(row, 'technical_skills')
  const problemSolving = readNumber(row, 'problem_solving')
  const communication = readNumber(row, 'communication')
  const overall = readNumber(row, 'overall')
  const summary = readString(row, 'summary')
  const readiness = readString(row, 'readiness')
  const createdAt = readString(row, 'created_at')
  const updatedAt = readString(row, 'updated_at')
  if (
    !id ||
    !bookingId ||
    !interviewerProfileId ||
    !candidateProfileId ||
    technicalSkills === null ||
    problemSolving === null ||
    communication === null ||
    overall === null ||
    summary === null ||
    !readiness ||
    !isReadinessLevel(readiness) ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }
  return {
    id,
    bookingId,
    interviewerProfileId,
    candidateProfileId,
    technicalSkills,
    problemSolving,
    communication,
    systemDesign: readNumber(row, 'system_design'),
    coding: readNumber(row, 'coding'),
    behavioral: readNumber(row, 'behavioral'),
    overall,
    strengths: readStringArray(row.strengths),
    improvements: readStringArray(row.improvements),
    summary,
    readiness,
    internalNotes: readString(row, 'internal_notes'),
    createdAt,
    updatedAt,
  }
}

export async function getFeedbackBookingIds(bookingIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>()
  if (bookingIds.length === 0) return ids
  const { data, error } = await supabase
    .from(TABLES.interviewerFeedback)
    .select('booking_id')
    .in('booking_id', bookingIds)
  if (error) throw mapFeedbackRpcError(error, 'load')
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const bookingId = readString(row, 'booking_id')
    if (bookingId) ids.add(bookingId)
  }
  return ids
}

export async function getMyFeedbackForBooking(bookingId: string): Promise<InterviewerFeedbackRecord | null> {
  if (!isUuid(bookingId)) throw new Error('Booking not found.')
  const { data, error } = await supabase
    .from(TABLES.interviewerFeedback)
    .select(FEEDBACK_COLUMNS)
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw mapFeedbackRpcError(error, 'load')
  return parseFeedback(data)
}

export async function submitInterviewerFeedback(
  input: SubmitInterviewerFeedbackInput,
): Promise<InterviewerFeedbackRecord> {
  const invalid = validateFeedbackInput(input)
  if (invalid) throw new Error(invalid)

  try {
    const { data, error } = await supabase.rpc('submit_interviewer_feedback', {
      p_booking_id: input.bookingId,
      p_technical_skills: input.technicalSkills,
      p_problem_solving: input.problemSolving,
      p_communication: input.communication,
      p_overall: input.overall,
      p_strengths: input.strengths,
      p_improvements: input.improvements,
      p_summary: input.summary.trim(),
      p_readiness: input.readiness,
      p_system_design: input.systemDesign ?? null,
      p_coding: input.coding ?? null,
      p_behavioral: input.behavioral ?? null,
      p_internal_notes: input.internalNotes?.trim() || null,
    })
    if (error) throw mapFeedbackRpcError(error)
    const saved = parseFeedback(data)
    if (!saved) throw new Error(FEEDBACK_GENERIC_ERROR)
    return saved
  } catch (caught) {
    if (isNetworkFailure(caught)) throw new Error(FEEDBACK_NETWORK_ERROR)
    if (caught instanceof Error) throw caught
    throw new Error(FEEDBACK_GENERIC_ERROR)
  }
}
