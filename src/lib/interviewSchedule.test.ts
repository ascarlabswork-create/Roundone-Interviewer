import { describe, expect, it } from 'vitest'
import {
  applyTimeToSelectedDates,
  applyTimeToSelectedDays,
  dateTimesForRange,
  listRangeDates,
  scheduleDraftFromAvailability,
  setDayEnabled,
  validateScheduleDraft,
} from './interviewSchedule.ts'

describe('scheduleDraftFromAvailability', () => {
  it('keeps saved weekly hours and uses the first one as the shared time', () => {
    const draft = scheduleDraftFromAvailability('2026-11-09', '2026-11-20', [
      { id: 'mon', weekday: 1, start_time: '10:00:00', end_time: '13:00:00' },
    ])
    expect(draft.from).toBe('2026-11-09')
    expect(draft.allStart).toBe('10:00')
    expect(draft.allEnd).toBe('13:00')
    expect(draft.days[1].enabled).toBe(true)
    expect(draft.days[1].windows[0].id).toBe('mon')
    expect(draft.days[2].enabled).toBe(false)
  })
})

describe('applyTimeToSelectedDays', () => {
  it('fills weekdays with the shared time when no day is selected yet', () => {
    const draft = applyTimeToSelectedDays(
      scheduleDraftFromAvailability(null, null, []),
    )
    expect(draft.days[1].enabled).toBe(true)
    expect(draft.days[1].windows[0]).toMatchObject({ startTime: '10:00', endTime: '18:00' })
    expect(draft.days[0].enabled).toBe(false)
    expect(draft.days[6].enabled).toBe(false)
  })

  it('only updates days the interviewer already selected', () => {
    const base = setDayEnabled(scheduleDraftFromAvailability(null, null, []), 1, true)
    const draft = applyTimeToSelectedDays({ ...base, allStart: '09:00', allEnd: '12:00' })
    expect(draft.days[1].windows[0]).toMatchObject({ startTime: '09:00', endTime: '12:00' })
    expect(draft.days[2].enabled).toBe(false)
  })
})

describe('applyTimeToSelectedDates', () => {
  it('sets the shared time on ticked dates and leaves the others alone', () => {
    const rows = applyTimeToSelectedDates(
      [
        { date: '2026-11-06', enabled: true, startTime: '10:00', endTime: '11:00' },
        { date: '2026-11-07', enabled: false, startTime: '10:00', endTime: '11:00' },
      ],
      '08:00',
      '12:15',
    )
    expect(rows[0]).toMatchObject({ enabled: true, startTime: '08:00', endTime: '12:15' })
    expect(rows[1].enabled).toBe(false)
  })

  it('ticks every date when none are selected yet', () => {
    const rows = applyTimeToSelectedDates(
      [{ date: '2026-11-06', enabled: false, startTime: '10:00', endTime: '11:00' }],
      '09:00',
      '13:00',
    )
    expect(rows[0]).toMatchObject({ enabled: true, startTime: '09:00', endTime: '13:00' })
  })
})

describe('dateTimesForRange', () => {
  it('lists every date in the window and keeps a saved time for that date', () => {
    expect(listRangeDates('2026-11-06', '2026-11-08')).toEqual(['2026-11-06', '2026-11-07', '2026-11-08'])
    const rows = dateTimesForRange(
      '2026-11-06',
      '2026-11-08',
      [],
      [{ on_date: '2026-11-07', start_time: '15:00:00', end_time: '16:00:00' }],
      { startTime: '10:00', endTime: '12:00' },
    )
    expect(rows[0]).toMatchObject({ date: '2026-11-06', enabled: false })
    expect(rows[1]).toMatchObject({ date: '2026-11-07', enabled: true, startTime: '15:00', endTime: '16:00' })
  })
})

describe('validateScheduleDraft', () => {
  it('requires a day and a time before the schedule can be saved', () => {
    const draft = scheduleDraftFromAvailability('2026-11-10', '2026-12-10', [])
    expect(validateScheduleDraft(draft, '2026-11-06').some((error) => error.includes('at least one day or date'))).toBe(true)
  })

  it('accepts a date window with hours on the selected days', () => {
    const draft = applyTimeToSelectedDays(scheduleDraftFromAvailability('2026-11-10', '2026-12-10', []))
    expect(validateScheduleDraft(draft, '2026-11-06')).toEqual([])
  })
})
