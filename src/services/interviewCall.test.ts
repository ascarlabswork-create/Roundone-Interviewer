import { FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  InterviewCallError,
  candidatePresence,
  classifyMediaError,
  interviewRoomName,
  parseParticipantRole,
  requestInterviewToken,
  tokenErrorKind,
} from './interviewCall.ts'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '99999999-9999-4999-8999-999999999999'

const okResponse = {
  livekit_url: 'wss://example.livekit.cloud',
  token: 'jwt',
  room_name: `roundone-interview-${SESSION_ID}`,
  participant_identity: `interviewer:${USER_ID}`,
}

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }))
}

describe('interviewRoomName', () => {
  it('matches the shared room naming used by the Candidate app', () => {
    expect(interviewRoomName(SESSION_ID)).toBe(`roundone-interview-${SESSION_ID}`)
  })
})

describe('requestInterviewToken', () => {
  it('sends the interview session id and returns only the short-lived token and LiveKit url', async () => {
    const token = await requestInterviewToken(SESSION_ID, async (id) => {
      expect(id).toBe(SESSION_ID)
      return { data: okResponse, error: null }
    })
    expect(token).toEqual({
      token: 'jwt',
      url: 'wss://example.livekit.cloud',
      room: `roundone-interview-${SESSION_ID}`,
      identity: `interviewer:${USER_ID}`,
    })
  })

  it.each([
    [401, 'not_authenticated', 'not_authenticated'],
    [403, 'not_authorized', 'not_authorized'],
    [403, 'session_not_found', 'not_found'],
    [403, 'booking_not_confirmed', 'not_joinable'],
    [403, 'session_expired', 'session_ended'],
    [403, 'INTERVIEW_NOT_STARTED', 'not_started'],
    [403, 'JOIN_WINDOW_CLOSED', 'join_closed'],
    [403, 'JOIN_DEADLINE_PASSED', 'join_closed'],
    [503, 'unconfigured', 'not_configured'],
    [500, 'boom', 'network'],
  ] as const)('maps HTTP %s %s to %s', async (status, code, kind) => {
    const error = await requestInterviewToken(SESSION_ID, async () => ({
      data: null,
      error: httpError(status, { error: code }),
    })).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(InterviewCallError)
    expect((error as InterviewCallError).kind).toBe(kind)
  })

  it('falls back to the HTTP status when the body has no code', () => {
    expect(tokenErrorKind(null, 401)).toBe('not_authenticated')
    expect(tokenErrorKind(null, 403)).toBe('not_authorized')
    expect(tokenErrorKind(null, 503)).toBe('not_configured')
    expect(tokenErrorKind(null, null)).toBe('network')
  })

  it('rejects a token issued for a different room', async () => {
    await expect(
      requestInterviewToken(SESSION_ID, async () => ({
        data: { ...okResponse, room_name: 'roundone-interview-22222222-2222-4222-8222-222222222222' },
        error: null,
      })),
    ).rejects.toMatchObject({ kind: 'not_found' })
  })

  it('rejects a candidate identity in the interviewer app', async () => {
    await expect(
      requestInterviewToken(SESSION_ID, async () => ({
        data: { ...okResponse, participant_identity: `candidate:${USER_ID}` },
        error: null,
      })),
    ).rejects.toMatchObject({ kind: 'not_authorized' })
  })

  it('rejects malformed responses', async () => {
    await expect(
      requestInterviewToken(SESSION_ID, async () => ({ data: { token: 'jwt' }, error: null })),
    ).rejects.toMatchObject({ kind: 'network' })
  })

  it('maps thrown transport failures to a network error', async () => {
    await expect(
      requestInterviewToken(SESSION_ID, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('call helpers', () => {
  it('parses participant roles from shared identities', () => {
    expect(parseParticipantRole(`candidate:${USER_ID}`)).toBe('candidate')
    expect(parseParticipantRole(`interviewer:${USER_ID}`)).toBe('interviewer')
    expect(parseParticipantRole(USER_ID)).toBeNull()
    expect(parseParticipantRole(undefined)).toBeNull()
  })

  it('derives waiting, joined and left presence', () => {
    expect(candidatePresence(false, false)).toBe('waiting')
    expect(candidatePresence(true, true)).toBe('joined')
    expect(candidatePresence(false, true)).toBe('left')
  })

  it('classifies getUserMedia failures', () => {
    expect(classifyMediaError({ name: 'NotAllowedError' })).toBe('permission_denied')
    expect(classifyMediaError({ name: 'SecurityError' })).toBe('permission_denied')
    expect(classifyMediaError({ name: 'NotFoundError' })).toBe('device_not_found')
    expect(classifyMediaError({ name: 'NotReadableError' })).toBe('device_in_use')
    expect(classifyMediaError(new Error('x'))).toBe('unknown')
  })
})
