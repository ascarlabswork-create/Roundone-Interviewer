import { describe, expect, it } from 'vitest'
import type { AvailabilitySchedule } from '../types.ts'
import {
  RANGE_START_AFTER_END,
  generateBookableSlots,
  isDateWithinRange,
  proposeNextWeeklyRange,
  validateAvailableRange,
} from './slots.ts'

const MONDAY = '2030-01-07'
const NEXT_MONDAY = '2030-01-14'
const WEDNESDAY = '2030-01-09'

function schedule(overrides: Partial<AvailabilitySchedule> = {}, range: { from?: string; until?: string } = {}) {
  const base: AvailabilitySchedule = {
    settings: {
      interviewerId: 'ip-1',
      timezone: 'Asia/Kolkata',
      defaultDurationMin: 60,
      bufferMin: 0,
      availableFrom: range.from ?? null,
      availableUntil: range.until ?? null,
    },
    recurring: [
      { id: 'r1', interviewerId: 'ip-1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00', timezone: 'Asia/Kolkata', isActive: true },
      { id: 'r2', interviewerId: 'ip-1', dayOfWeek: 1, startTime: '14:00', endTime: '16:00', timezone: 'Asia/Kolkata', isActive: true },
    ],
    customSlots: [],
    blockedTimes: [],
  }
  return { ...base, ...overrides }
}

function times(input: AvailabilitySchedule, date: string) {
  return generateBookableSlots({ schedule: input, bookings: [], date, durationMin: 60 }).map((slot) => slot.startTime)
}

describe('available date range', () => {
  it('validates that the start date is on or before the end date', () => {
    expect(validateAvailableRange('2026-10-01', '2026-12-31')).toEqual([])
    expect(validateAvailableRange('2026-10-01', '2026-10-01')).toEqual([])
    expect(validateAvailableRange('2026-12-31', '2026-10-01')).toEqual([RANGE_START_AFTER_END])
    expect(validateAvailableRange(null, null)).toEqual([])
    expect(validateAvailableRange('2026-02-30', null)).toEqual(['Choose a valid start date.'])
  })

  it('treats empty bounds as open-ended and bounds as inclusive', () => {
    expect(isDateWithinRange('2026-10-01', null, null)).toBe(true)
    expect(isDateWithinRange('2026-10-01', '2026-10-01', '2026-12-31')).toBe(true)
    expect(isDateWithinRange('2026-12-31', '2026-10-01', '2026-12-31')).toBe(true)
    expect(isDateWithinRange('2026-09-30', '2026-10-01', '2026-12-31')).toBe(false)
    expect(isDateWithinRange('2027-01-01', '2026-10-01', null)).toBe(true)
    expect(isDateWithinRange('2027-01-01', null, '2026-12-31')).toBe(false)
  })
})

describe('slot generation', () => {
  it('keeps existing weekly slot generation when no range is set, with multiple windows per day', () => {
    expect(times(schedule(), MONDAY)).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00'])
    expect(times(schedule(), WEDNESDAY)).toEqual([])
  })

  it('repeats weekly availability only inside the date range', () => {
    const ranged = schedule({}, { from: '2030-01-01', until: '2030-01-10' })
    expect(times(ranged, MONDAY)).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00'])
    expect(times(ranged, NEXT_MONDAY)).toEqual([])
  })

  it('never generates slots before the range starts', () => {
    expect(times(schedule({}, { from: '2030-01-08' }), MONDAY)).toEqual([])
  })

  it('adds custom slots inside the range and ignores custom slots outside it', () => {
    const custom = schedule(
      {
        customSlots: [
          { id: 'c1', interviewerId: 'ip-1', date: WEDNESDAY, startTime: '18:00', endTime: '20:00', timezone: 'Asia/Kolkata' },
          { id: 'c2', interviewerId: 'ip-1', date: '2030-02-01', startTime: '18:00', endTime: '20:00', timezone: 'Asia/Kolkata' },
        ],
      },
      { from: '2030-01-01', until: '2030-01-31' },
    )
    expect(times(custom, WEDNESDAY)).toEqual(['18:00', '19:00'])
    expect(times(custom, '2030-02-01')).toEqual([])
  })

  it('lets blocked times override weekly and custom availability', () => {
    const blocked = schedule(
      {
        blockedTimes: [
          { id: 'b1', interviewerId: 'ip-1', date: MONDAY, startTime: '10:00', endTime: '11:00', allDay: false, reason: '', timezone: 'Asia/Kolkata' },
          { id: 'b2', interviewerId: 'ip-1', date: NEXT_MONDAY, startTime: null, endTime: null, allDay: true, reason: '', timezone: 'Asia/Kolkata' },
        ],
      },
      { from: '2030-01-01', until: '2030-01-31' },
    )
    expect(times(blocked, MONDAY)).toEqual(['09:00', '11:00', '14:00', '15:00'])
    expect(times(blocked, NEXT_MONDAY)).toEqual([])
  })
})

describe('proposeNextWeeklyRange', () => {
  it('fills the gap between morning and evening blocks instead of reusing a conflicting default', () => {
    expect(
      proposeNextWeeklyRange(
        [
          { startTime: '10:00', endTime: '14:00' },
          { startTime: '18:00', endTime: '21:00' },
        ],
        { startTime: '10:00', endTime: '14:00' },
      ),
    ).toEqual({ startTime: '14:00', endTime: '15:00' })
  })

  it('extends after the last range when there is still room before 11pm', () => {
    expect(
      proposeNextWeeklyRange([{ startTime: '18:00', endTime: '21:00' }], { startTime: '10:00', endTime: '11:00' }),
    ).toEqual({ startTime: '21:00', endTime: '22:00' })
  })
})
