import { describe, expect, it } from 'vitest'
import { candidateStatusCopy, networkCheck } from '../lib/interviewLobby.ts'
import type { InterviewerBooking } from './interviewerBookings.ts'
import { interviewJoinState, parseInterviewTiming, type InterviewSessionRecord } from './interviewSessions.ts'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

const timingRow = {
  session_id: SESSION_ID,
  booking_id: '22222222-2222-4222-8222-222222222222',
  role: 'interviewer',
  status: 'confirmed',
  phase: 'lobby',
  lobby_opens_at: '2026-10-06T07:30:00+00:00',
  call_opens_at: '2026-10-06T07:45:00+00:00',
  starts_at: '2026-10-06T08:00:00+00:00',
  join_deadline: '2026-10-06T08:15:00+00:00',
  ends_at: '2026-10-06T08:30:00+00:00',
  duration_min: 30,
  server_now: '2026-10-06T07:45:00.100+00:00',
  can_join: true,
  has_joined: false,
  session_started_at: null,
  session_ended_at: null,
  candidate_joined: false,
  candidate_presence: null,
  candidate_in_lobby: true,
  admission: null,
  no_show_role: null,
}

describe('parseInterviewTiming', () => {
  it('reads the server schedule and corrects for a wrong local clock', () => {
    const localStart = Date.parse('2026-10-06T10:45:00.000Z')
    const timing = parseInterviewTiming(timingRow, localStart, localStart + 200)
    expect(timing.phase).toBe('lobby')
    expect(timing.schedule.startsAt).toBe(Date.parse('2026-10-06T08:00:00Z'))
    expect(timing.schedule.callOpensAt).toBe(Date.parse('2026-10-06T07:45:00Z'))
    expect(timing.schedule.joinDeadline).toBe(Date.parse('2026-10-06T08:15:00Z'))
    expect(timing.schedule.endsAt).toBe(Date.parse('2026-10-06T08:30:00Z'))
    expect(timing.serverOffsetMs).toBe(-3 * 3_600_000)
    expect(timing.roundTripMs).toBe(200)
    expect(timing.canJoin).toBe(true)
    expect(timing.candidateInLobby).toBe(true)
    expect(timing.sessionEnded).toBe(false)
  })

  it('reads no-show and presence details', () => {
    const timing = parseInterviewTiming(
      { ...timingRow, phase: 'closed', status: 'no_show', no_show_role: 'candidate', candidate_presence: 'left' },
      0,
      0,
    )
    expect(timing.noShowRole).toBe('candidate')
    expect(timing.candidatePresence).toBe('left')
  })

  it('derives call_opens_at 15 minutes before start when the server omits it', () => {
    const { call_opens_at: _omitted, ...withoutCallOpens } = timingRow
    void _omitted
    const timing = parseInterviewTiming(withoutCallOpens, 0, 0)
    expect(timing.schedule.callOpensAt).toBe(Date.parse('2026-10-06T07:45:00Z'))
  })

  it('rejects malformed responses', () => {
    expect(() => parseInterviewTiming(null, 0, 0)).toThrow()
    expect(() => parseInterviewTiming({ ...timingRow, phase: 'party' }, 0, 0)).toThrow()
    expect(() => parseInterviewTiming({ ...timingRow, ends_at: null }, 0, 0)).toThrow()
  })
})

describe('interviewJoinState', () => {
  const booking = {
    id: timingRow.booking_id,
    status: 'confirmed',
    startsAtUtc: '2026-10-06T08:00:00.000Z',
    durationMin: 30,
    displayTimezone: 'UTC',
  } as InterviewerBooking
  const session = { id: SESSION_ID, endedAt: null } as InterviewSessionRecord

  it('shows confirmed/waiting the day before, the lobby 30 minutes early, and the call at the start', () => {
    expect(interviewJoinState(booking, session, new Date('2026-10-05T08:00:00Z')).kind).toBe('waiting')
    expect(interviewJoinState(booking, session, new Date('2026-10-06T07:30:00Z'))).toEqual({
      kind: 'lobby',
      roomOpen: false,
    })
    expect(interviewJoinState(booking, session, new Date('2026-10-06T07:45:00Z'))).toEqual({
      kind: 'lobby',
      roomOpen: true,
    })
    expect(interviewJoinState(booking, session, new Date('2026-10-06T08:00:00Z')).kind).toBe('ready')
    expect(interviewJoinState(booking, session, new Date('2026-10-06T08:30:00Z')).kind).toBe('unavailable')
  })

  it('never offers a cancelled booking', () => {
    const cancelled = { ...booking, status: 'cancelled' } as InterviewerBooking
    expect(interviewJoinState(cancelled, session, new Date('2026-10-06T08:05:00Z')).kind).toBe('unavailable')
  })
})

describe('lobby helpers', () => {
  it('grades the connection', () => {
    expect(networkCheck(false, 50).state).toBe('fail')
    expect(networkCheck(true, null).state).toBe('checking')
    expect(networkCheck(true, 120).state).toBe('ok')
    expect(networkCheck(true, 500).state).toBe('warn')
    expect(networkCheck(true, 1200).state).toBe('warn')
  })

  it('describes candidate status without inventing participants', () => {
    expect(candidateStatusCopy({ candidatePresence: null, candidateInLobby: false }, 'Asha')).toBe('Waiting for candidate')
    expect(candidateStatusCopy({ candidatePresence: null, candidateInLobby: true }, 'Asha')).toBe('Asha is in the lobby')
    expect(candidateStatusCopy({ candidatePresence: 'in_call', candidateInLobby: true }, 'Asha')).toBe(
      'Asha is in the interview room',
    )
  })
})
