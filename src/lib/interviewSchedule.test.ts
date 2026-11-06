import { describe, expect, it } from 'vitest'
import {
  applyTimeToSelectedDays,
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

describe('validateScheduleDraft', () => {
  it('requires a day and a time before the schedule can be saved', () => {
    const draft = scheduleDraftFromAvailability('2026-11-10', '2026-12-10', [])
    expect(validateScheduleDraft(draft, '2026-11-06').some((error) => error.includes('at least one day'))).toBe(true)
  })

  it('accepts a date window with hours on the selected days', () => {
    const draft = applyTimeToSelectedDays(scheduleDraftFromAvailability('2026-11-10', '2026-12-10', []))
    expect(validateScheduleDraft(draft, '2026-11-06')).toEqual([])
  })
})
