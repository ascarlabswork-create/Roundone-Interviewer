import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

/** Shared with the Candidate app; the function and room naming live in the shared Supabase project. */
export const INTERVIEW_TOKEN_FUNCTION = 'create-interview-token'
export const INTERVIEW_ROOM_PREFIX = 'roundone-interview-'

export function interviewRoomName(sessionId: string) {
  return `${INTERVIEW_ROOM_PREFIX}${sessionId}`
}

export type InterviewCallToken = {
  token: string
  url: string
  room: string
  identity: string
}

export type CallErrorKind =
  | 'not_authenticated'
  | 'not_authorized'
  | 'not_found'
  | 'not_joinable'
  | 'not_started'
  | 'join_closed'
  | 'session_ended'
  | 'not_configured'
  | 'connection'
  | 'network'

export class InterviewCallError extends Error {
  readonly kind: CallErrorKind

  constructor(kind: CallErrorKind, message: string) {
    super(message)
    this.name = 'InterviewCallError'
    this.kind = kind
  }
}

const CALL_ERROR_MESSAGES: Record<CallErrorKind, string> = {
  not_authenticated: 'Your session has expired. Sign in again to join the interview.',
  not_authorized: 'You are not a participant in this interview.',
  not_found: 'This interview session could not be found.',
  not_joinable: 'This interview is not open for joining. Only confirmed bookings can start a call.',
  not_started: 'The interview room opens 15 minutes before the scheduled start.',
  join_closed: 'Interview join window has closed.',
  session_ended: 'This interview session has ended.',
  not_configured: 'Video calling is not configured yet. Please contact support.',
  connection: 'Could not connect to the interview call. Check your connection and try again.',
  network: 'Could not reach the interview service. Check your connection and try again.',
}

export function callError(kind: CallErrorKind) {
  return new InterviewCallError(kind, CALL_ERROR_MESSAGES[kind])
}

const ERROR_CODE_KINDS: Record<string, CallErrorKind> = {
  not_authenticated: 'not_authenticated',
  not_authorized: 'not_authorized',
  session_not_found: 'not_found',
  booking_not_confirmed: 'not_joinable',
  INTERVIEW_NOT_STARTED: 'not_started',
  JOIN_WINDOW_CLOSED: 'join_closed',
  JOIN_DEADLINE_PASSED: 'join_closed',
  session_expired: 'session_ended',
  unconfigured: 'not_configured',
}

export function tokenErrorKind(code: string | null, status: number | null): CallErrorKind {
  if (code && ERROR_CODE_KINDS[code]) return ERROR_CODE_KINDS[code]
  if (status === 401) return 'not_authenticated'
  if (status === 403) return 'not_authorized'
  if (status === 503) return 'not_configured'
  return 'network'
}

type InvokeResult = { data: unknown; error: unknown }
export type InvokeTokenFunction = (sessionId: string) => Promise<InvokeResult>

const invokeTokenFunction: InvokeTokenFunction = (sessionId) =>
  supabase.functions.invoke(INTERVIEW_TOKEN_FUNCTION, {
    body: { interview_session_id: sessionId },
  })

async function readError(error: unknown): Promise<{ code: string | null; status: number | null }> {
  if (!(error instanceof FunctionsHttpError)) return { code: null, status: null }
  const context: unknown = error.context
  if (!(context instanceof Response)) return { code: null, status: null }
  let code: string | null = null
  try {
    const body: unknown = await context.clone().json()
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      code = (body as { error: string }).error
    }
  } catch {
    code = null
  }
  return { code, status: context.status }
}

export function parseTokenResponse(data: unknown, sessionId: string): InterviewCallToken {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw callError('network')
  const row = data as Record<string, unknown>
  const { token, livekit_url: url, room_name: room, participant_identity: identity } = row
  if (typeof token !== 'string' || typeof url !== 'string' || typeof room !== 'string' || typeof identity !== 'string') {
    throw callError('network')
  }
  if (!token || !url) throw callError('network')
  if (room !== interviewRoomName(sessionId)) throw callError('not_found')
  if (parseParticipantRole(identity) !== 'interviewer') throw callError('not_authorized')
  return { token, url, room, identity }
}

/** Short-lived LiveKit credentials from the secure Edge Function; no secret reaches the browser. */
export async function requestInterviewToken(
  sessionId: string,
  invoke: InvokeTokenFunction = invokeTokenFunction,
): Promise<InterviewCallToken> {
  let result: InvokeResult
  try {
    result = await invoke(sessionId)
  } catch {
    throw callError('network')
  }
  if (result.error) {
    const { code, status } = await readError(result.error)
    throw callError(tokenErrorKind(code, status))
  }
  return parseTokenResponse(result.data, sessionId)
}

export const END_INTERVIEW_CALL_FUNCTION = 'end-interview-call'

/** Closes the LiveKit room once the interview has ended so no one stays connected; best effort. */
export async function closeInterviewRoom(
  sessionId: string,
  invoke: InvokeTokenFunction = (id) =>
    supabase.functions.invoke(END_INTERVIEW_CALL_FUNCTION, { body: { interview_session_id: id } }),
): Promise<boolean> {
  try {
    const result = await invoke(sessionId)
    return !result.error
  } catch {
    return false
  }
}

export type ParticipantRole = 'interviewer' | 'candidate' | null

/** Participant identities are issued as `<role>:<auth user id>`. */
export function parseParticipantRole(identity: string | undefined): ParticipantRole {
  if (!identity) return null
  if (identity.startsWith('candidate:')) return 'candidate'
  if (identity.startsWith('interviewer:')) return 'interviewer'
  return null
}

export type CandidatePresence = 'waiting' | 'joined' | 'left'

export function candidatePresence(present: boolean, everJoined: boolean): CandidatePresence {
  if (present) return 'joined'
  return everJoined ? 'left' : 'waiting'
}

export type MediaErrorKind = 'permission_denied' | 'device_not_found' | 'device_in_use' | 'unknown'

export function classifyMediaError(error: unknown): MediaErrorKind {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'permission_denied'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'device_not_found'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'device_in_use'
  }
  return 'unknown'
}

export const MEDIA_ERROR_MESSAGES: Record<MediaErrorKind, string> = {
  permission_denied:
    'Camera or microphone access was blocked. Allow access in your browser settings, then try again.',
  device_not_found: 'No camera or microphone was found. Connect a device and try again.',
  device_in_use: 'Your camera or microphone is being used by another app. Close it and try again.',
  unknown: 'Could not start your camera or microphone. Try again.',
}
