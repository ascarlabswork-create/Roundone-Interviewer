import { describe, expect, it } from 'vitest'
import {
  canEnterCall,
  formatCountdown,
  interviewPhase,
  interviewRoomAccess,
  interviewRoomStatusCopy,
  interviewSchedule,
  isLobbyOpen,
  serverClockOffset,
} from './interviewTiming.ts'

const START = '2026-10-06T08:00:00.000Z'
const at = (hhmmss: string) => Date.parse(`2026-10-06T${hhmmss}.000Z`)

describe('interviewSchedule', () => {
  it('builds the 7:30 lobby / 7:45 room-open / 8:00 start / 8:15 deadline / 8:30 end schedule for a 30 minute service', () => {
    expect(interviewSchedule(START, 30)).toEqual({
      lobbyOpensAt: at('07:30:00'),
      callOpensAt: at('07:45:00'),
      startsAt: at('08:00:00'),
      joinDeadline: at('08:15:00'),
      endsAt: at('08:30:00'),
    })
  })

  it('never puts the late-join deadline after the scheduled end', () => {
    expect(interviewSchedule(START, 10)?.joinDeadline).toBe(at('08:10:00'))
  })

  it('rejects invalid input', () => {
    expect(interviewSchedule('not a date', 30)).toBeNull()
    expect(interviewSchedule(START, 0)).toBeNull()
  })

  it('uses the updated time after a reschedule', () => {
    const original = interviewSchedule(START, 60)!
    const moved = interviewSchedule('2026-10-07T15:00:00.000Z', 60)!
    expect(interviewPhase(original, at('08:05:00'))).toBe('live')
    expect(interviewPhase(moved, at('08:05:00'))).toBe('scheduled')
  })
})

describe('interviewPhase', () => {
  const schedule = interviewSchedule(START, 30)!

  it.each([
    ['the day before', '2026-10-05T08:00:00.000Z', 'scheduled'],
    ['31 minutes before', '2026-10-06T07:29:00.000Z', 'scheduled'],
    ['30 minutes before', '2026-10-06T07:30:00.000Z', 'lobby'],
    ['1 second before', '2026-10-06T07:59:59.000Z', 'lobby'],
    ['at the start', '2026-10-06T08:00:00.000Z', 'live'],
    ['after the deadline', '2026-10-06T08:20:00.000Z', 'live'],
    ['at the scheduled end', '2026-10-06T08:30:00.000Z', 'ended'],
  ] as const)('is %s → %s', (_label, iso, phase) => {
    expect(interviewPhase(schedule, Date.parse(iso))).toBe(phase)
  })

  it('accepting tomorrow does not open the lobby', () => {
    expect(isLobbyOpen(schedule, Date.parse('2026-10-05T09:00:00.000Z'))).toBe(false)
    expect(isLobbyOpen(schedule, at('07:45:00'))).toBe(true)
  })
})

describe('canEnterCall', () => {
  const schedule = interviewSchedule(START, 30)!

  it('blocks LiveKit entry before the 15 minute early-join window, even from the lobby', () => {
    expect(canEnterCall(schedule, at('07:30:00'), false)).toBe(false)
    expect(canEnterCall(schedule, at('07:44:59'), false)).toBe(false)
  })

  it('allows entry from 15 minutes before the start through the 15 minute grace period', () => {
    expect(canEnterCall(schedule, at('07:45:00'), false)).toBe(true)
    expect(canEnterCall(schedule, at('07:59:59'), false)).toBe(true)
    expect(canEnterCall(schedule, at('08:00:00'), false)).toBe(true)
    expect(canEnterCall(schedule, at('08:15:00'), false)).toBe(true)
  })

  it('does not move the scheduled start or end when someone joins early', () => {
    expect(schedule.startsAt).toBe(at('08:00:00'))
    expect(schedule.endsAt).toBe(at('08:30:00'))
    expect(canEnterCall(schedule, at('07:45:00'), false)).toBe(true)
  })

  it('blocks new entry after the grace deadline but lets a participant who already joined reconnect', () => {
    expect(canEnterCall(schedule, at('08:15:01'), false)).toBe(false)
    expect(canEnterCall(schedule, at('08:20:00'), true)).toBe(true)
  })

  it('does not extend the end for a late joiner', () => {
    expect(canEnterCall(schedule, at('08:30:00'), true)).toBe(false)
    expect(schedule.endsAt).toBe(at('08:30:00'))
  })
})

describe('interviewRoomAccess', () => {
  const schedule = interviewSchedule(START, 30)!

  it('describes the interviewer join window against the scheduled clock', () => {
    expect(interviewRoomAccess(schedule, at('07:44:00'), false)).toBe('not_open')
    expect(interviewRoomAccess(schedule, at('07:45:00'), false)).toBe('early')
    expect(interviewRoomAccess(schedule, at('07:59:00'), false)).toBe('early')
    expect(interviewRoomAccess(schedule, at('08:00:00'), false)).toBe('started')
    expect(interviewRoomAccess(schedule, at('08:14:00'), false)).toBe('started')
    expect(interviewRoomAccess(schedule, at('08:15:01'), false)).toBe('join_closed')
    expect(interviewRoomAccess(schedule, at('08:20:00'), true)).toBe('started')
    expect(interviewRoomAccess(schedule, at('08:30:00'), true)).toBe('ended')
  })

  it('uses the required interviewer copy', () => {
    expect(interviewRoomStatusCopy('not_open', '2:15 AM')).toBe('Interview room opens at 2:15 AM.')
    expect(interviewRoomStatusCopy('early', '2:15 AM')).toBe(
      'Interview room is open. You can join early and wait for the other participant.',
    )
    expect(interviewRoomStatusCopy('started', '2:15 AM')).toBe('Interview has started.')
    expect(interviewRoomStatusCopy('join_closed', '2:15 AM')).toBe('No new participants can join.')
  })
})

describe('formatCountdown', () => {
  it('formats minutes and hours and never goes negative', () => {
    expect(formatCountdown(65_000)).toBe('01:05')
    expect(formatCountdown(3_909_000)).toBe('1:05:09')
    expect(formatCountdown(-5_000)).toBe('00:00')
  })
})

describe('serverClockOffset', () => {
  it('measures the offset against the request midpoint so a wrong local clock is corrected', () => {
    const localStart = Date.parse('2026-10-06T09:00:00.000Z')
    const offset = serverClockOffset('2026-10-06T08:00:00.100Z', localStart, localStart + 200)
    expect(offset).toBe(-3_600_000)
  })

  it('returns zero for an unreadable server time', () => {
    expect(serverClockOffset('nope', 0, 10)).toBe(0)
  })
})
