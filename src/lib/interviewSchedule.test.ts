import { describe, expect, it } from 'vitest'
import {
  applyCommonSlotsToDays,
  applyTimeToSelectedDays,
  countInclusiveDays,
  dateCalendarKind,
  scheduleDraftFromAvailability,
  scheduleSummary,
  setDayEnabled,
  validateScheduleDraft,
  weekdaysInDateRange,
} from './interviewSchedule.ts'

describe('scheduleDraftFromAvailability', () => {
  it('keeps saved weekly hours and seeds common windows from them', () => {
    const draft = scheduleDraftFromAvailability('2026-11-09', '2026-11-20', [
      { id: 'mon', weekday: 1, start_time: '10:00:00', end_time: '13:00:00' },
    ])
    expect(draft.from).toBe('2026-11-09')
    expect(draft.allStart).toBe('10:00')
    expect(draft.allEnd).toBe('13:00')
    expect(draft.commonWindows[0]).toMatchObject({ startTime: '10:00', endTime: '13:00' })
    expect(draft.days[1].enabled).toBe(true)
    expect(draft.days[1].windows[0].id).toBe('mon')
    expect(draft.days[2].enabled).toBe(false)
  })
})

describe('applyTimeToSelectedDays', () => {
  it('fills weekdays with the shared time when no day is selected yet', () => {
    const draft = applyTimeToSelectedDays(scheduleDraftFromAvailability(null, null, []))
    expect(draft.days[1].enabled).toBe(true)
    expect(draft.days[1].windows[0]).toMatchObject({ startTime: '09:00', endTime: '12:00' })
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

describe('applyCommonSlotsToDays', () => {
  it('replaces weekday hours for every day that appears in the date range', () => {
    const base = scheduleDraftFromAvailability('2026-11-10', '2026-11-12', [])
    const draft = applyCommonSlotsToDays({
      ...base,
      applyMode: 'replace',
      commonWindows: [
        { id: null, startTime: '09:00', endTime: '12:00' },
        { id: null, startTime: '13:00', endTime: '17:00' },
      ],
    })
    // Nov 10–12 2026 is Tue–Thu
    expect(draft.days[2].windows).toHaveLength(2)
    expect(draft.days[3].windows[0]).toMatchObject({ startTime: '09:00', endTime: '12:00' })
    expect(draft.days[1].enabled).toBe(false)
  })
})

describe('calendar helpers', () => {
  it('counts inclusive days and weekdays in a range', () => {
    expect(countInclusiveDays('2026-11-10', '2026-12-09')).toBe(30)
    expect(weekdaysInDateRange('2026-11-10', '2026-11-12')).toEqual([2, 3, 4])
  })

  it('marks custom dates ahead of common availability', () => {
    const draft = applyCommonSlotsToDays(scheduleDraftFromAvailability('2026-11-10', '2026-11-20', []))
    expect(dateCalendarKind('2026-11-11', draft, new Set(['2026-11-11']))).toBe('custom')
    expect(dateCalendarKind('2026-11-12', draft, new Set(['2026-11-11']))).toBe('available')
    expect(dateCalendarKind('2026-11-01', draft, new Set())).toBe('outside')
  })

  it('summarizes common vs custom dates in the window', () => {
    const draft = applyCommonSlotsToDays(scheduleDraftFromAvailability('2026-11-10', '2026-11-12', []))
    expect(scheduleSummary(draft, new Set(['2026-11-11']))).toEqual({
      total: 3,
      common: 2,
      custom: 1,
      closed: 0,
    })
  })
})

describe('validateScheduleDraft', () => {
  it('requires applied hours before the schedule can be saved', () => {
    const draft = scheduleDraftFromAvailability('2026-11-10', '2026-12-10', [])
    expect(validateScheduleDraft(draft, '2026-11-06').some((error) => error.includes('at least one weekday'))).toBe(
      true,
    )
  })

  it('accepts a date window with hours on the selected days', () => {
    const draft = applyCommonSlotsToDays(scheduleDraftFromAvailability('2026-11-10', '2026-12-10', []))
    expect(validateScheduleDraft(draft, '2026-11-06')).toEqual([])
  })
})
