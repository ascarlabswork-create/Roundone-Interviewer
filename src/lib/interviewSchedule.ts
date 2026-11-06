import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../data/catalogs.ts'
import { minutesToTime, timeToMinutes, toISODate } from './dates.ts'
import { validateAvailableRange } from './slots.ts'

export const DEFAULT_RANGE_START = '10:00'
export const DEFAULT_RANGE_END = '18:00'

export type ScheduleWindow = {
  /** Existing weekly row, when this window was loaded from the server. */
  id: string | null
  startTime: string
  endTime: string
}

export type ScheduleDay = {
  enabled: boolean
  windows: ScheduleWindow[]
}

/** Booking window plus the weekly hours that repeat inside it. */
export type ScheduleDraft = {
  from: string
  until: string
  allStart: string
  allEnd: string
  days: ScheduleDay[]
}

type StoredWindow = {
  id: string
  weekday: number
  start_time: string
  end_time: string
}

function clock(value: string) {
  return value.slice(0, 5)
}

function emptyDays(): ScheduleDay[] {
  return Array.from({ length: 7 }, () => ({ enabled: false, windows: [] }))
}

export function scheduleDraftFromAvailability(
  from: string | null,
  until: string | null,
  windows: StoredWindow[],
): ScheduleDraft {
  const days = emptyDays()
  for (const window of windows) {
    const day = days[window.weekday]
    if (!day) continue
    day.enabled = true
    day.windows.push({
      id: window.id,
      startTime: clock(window.start_time),
      endTime: clock(window.end_time),
    })
  }

  const first = days.find((day) => day.enabled)?.windows[0]
  return {
    from: from ?? '',
    until: until ?? '',
    allStart: first?.startTime ?? DEFAULT_RANGE_START,
    allEnd: first?.endTime ?? DEFAULT_RANGE_END,
    days,
  }
}

/** Puts the shared time on every selected day. Weekdays are selected when none are yet. */
export function applyTimeToSelectedDays(draft: ScheduleDraft): ScheduleDraft {
  const anyEnabled = draft.days.some((day) => day.enabled)
  return {
    ...draft,
    days: draft.days.map((day, weekday) => {
      const selected = anyEnabled ? day.enabled : weekday >= 1 && weekday <= 5
      if (!selected) return { enabled: false, windows: [] }
      return {
        enabled: true,
        windows: [{ id: day.windows.length === 1 ? day.windows[0].id : null, startTime: draft.allStart, endTime: draft.allEnd }],
      }
    }),
  }
}

export function setDayEnabled(draft: ScheduleDraft, weekday: number, enabled: boolean): ScheduleDraft {
  return {
    ...draft,
    days: draft.days.map((day, index) => {
      if (index !== weekday) return day
      if (!enabled) return { enabled: false, windows: [] }
      if (day.windows.length > 0) return { ...day, enabled: true }
      return {
        enabled: true,
        windows: [{ id: null, startTime: draft.allStart, endTime: draft.allEnd }],
      }
    }),
  }
}

export function updateDayWindow(
  draft: ScheduleDraft,
  weekday: number,
  index: number,
  patch: Partial<Pick<ScheduleWindow, 'startTime' | 'endTime'>>,
): ScheduleDraft {
  return {
    ...draft,
    days: draft.days.map((day, dayIndex) => {
      if (dayIndex !== weekday) return day
      return {
        ...day,
        windows: day.windows.map((window, windowIndex) =>
          windowIndex === index ? { ...window, ...patch } : window,
        ),
      }
    }),
  }
}

export function addDayWindow(draft: ScheduleDraft, weekday: number): ScheduleDraft {
  return {
    ...draft,
    days: draft.days.map((day, index) => {
      if (index !== weekday) return day
      const last = day.windows[day.windows.length - 1]
      const start = last ? timeToMinutes(last.endTime) : timeToMinutes(draft.allStart)
      const end = Math.min(start + 60, 23 * 60 + 59)
      if (end <= start) return day
      return {
        enabled: true,
        windows: [...day.windows, { id: null, startTime: minutesToTime(start), endTime: minutesToTime(end) }],
      }
    }),
  }
}

export function removeDayWindow(draft: ScheduleDraft, weekday: number, index: number): ScheduleDraft {
  return {
    ...draft,
    days: draft.days.map((day, dayIndex) => {
      if (dayIndex !== weekday) return day
      const windows = day.windows.filter((_, windowIndex) => windowIndex !== index)
      return { enabled: windows.length > 0, windows }
    }),
  }
}

function windowsOverlap(windows: ScheduleWindow[]) {
  const spans = windows
    .map((window) => ({ start: timeToMinutes(window.startTime), end: timeToMinutes(window.endTime) }))
    .sort((a, b) => a.start - b.start)
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index].start < spans[index - 1].end) return true
  }
  return false
}

export function validateScheduleDraft(draft: ScheduleDraft, today = toISODate(new Date())) {
  const errors = validateAvailableRange(draft.from || null, draft.until || null)
  if (!draft.days.some((day) => day.enabled)) {
    errors.push('Select at least one day, and set the hours candidates can book.')
  }
  for (const weekday of WEEKDAY_ORDER) {
    const day = draft.days[weekday]
    if (!day?.enabled) continue
    if (day.windows.length === 0) {
      errors.push(`${WEEKDAY_LABELS[weekday]} needs a start and end time.`)
      continue
    }
    if (day.windows.some((window) => timeToMinutes(window.startTime) >= timeToMinutes(window.endTime))) {
      errors.push(`${WEEKDAY_LABELS[weekday]} must end after it starts.`)
    }
    if (windowsOverlap(day.windows)) {
      errors.push(`${WEEKDAY_LABELS[weekday]} has overlapping times.`)
    }
  }
  if (draft.until && draft.until < today) {
    errors.push('The end date is in the past, so candidates cannot book. Extend it to reopen bookings.')
  }
  return errors
}
