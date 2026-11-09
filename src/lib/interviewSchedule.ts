import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../data/catalogs.ts'
import { addDays, fromYMD, minutesToTime, timeToMinutes, toISODate } from './dates.ts'
import { isDateWithinRange, validateAvailableRange } from './slots.ts'

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

export type CommonApplyMode = 'replace' | 'add'

/** Booking window plus the weekly hours that repeat inside it. */
export type ScheduleDraft = {
  from: string
  until: string
  allStart: string
  allEnd: string
  /** Shared slots shown in the “common hours” editor before Apply. */
  commonWindows: ScheduleWindow[]
  applyMode: CommonApplyMode
  days: ScheduleDay[]
}

export type CalendarDayKind = 'available' | 'custom' | 'unavailable' | 'outside'

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

function defaultCommonWindows(): ScheduleWindow[] {
  return [
    { id: null, startTime: '09:00', endTime: '12:00' },
    { id: null, startTime: '13:00', endTime: '17:00' },
  ]
}

function syncAllClock(commonWindows: ScheduleWindow[]) {
  const first = commonWindows[0]
  return {
    allStart: first?.startTime ?? DEFAULT_RANGE_START,
    allEnd: first?.endTime ?? DEFAULT_RANGE_END,
  }
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

  const firstEnabled = days.find((day) => day.enabled)
  const commonWindows =
    firstEnabled && firstEnabled.windows.length > 0
      ? firstEnabled.windows.map((window) => ({
          id: null,
          startTime: window.startTime,
          endTime: window.endTime,
        }))
      : defaultCommonWindows()

  return {
    from: from ?? '',
    until: until ?? '',
    ...syncAllClock(commonWindows),
    commonWindows,
    applyMode: 'replace',
    days,
  }
}

/** Weekdays that appear at least once inside the booking window (or Mon–Fri when open-ended). */
export function weekdaysInDateRange(from: string, until: string): number[] {
  if (!from || !until) return [1, 2, 3, 4, 5]
  if (from > until) return []
  const found = new Set<number>()
  let cursor = fromYMD(from)
  const end = fromYMD(until)
  let guard = 0
  while (cursor <= end && guard < 400) {
    found.add(cursor.getDay())
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return WEEKDAY_ORDER.filter((day) => found.has(day))
}

export function countInclusiveDays(from: string, until: string) {
  if (!from || !until || from > until) return 0
  const start = fromYMD(from)
  const end = fromYMD(until)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export function eachDateInRange(from: string, until: string) {
  if (!from || !until || from > until) return [] as string[]
  const dates: string[] = []
  let cursor = fromYMD(from)
  const end = fromYMD(until)
  let guard = 0
  while (cursor <= end && guard < 400) {
    dates.push(toISODate(cursor))
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return dates
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

export function validateCommonWindows(windows: ScheduleWindow[]) {
  const errors: string[] = []
  if (windows.length === 0) {
    errors.push('Add at least one common time slot before applying.')
    return errors
  }
  if (windows.some((window) => timeToMinutes(window.startTime) >= timeToMinutes(window.endTime))) {
    errors.push('Each common slot must end after it starts.')
  }
  if (windowsOverlap(windows)) {
    errors.push('Common time slots overlap. Adjust the ranges first.')
  }
  return errors
}

function mergeWindows(existing: ScheduleWindow[], incoming: ScheduleWindow[]): ScheduleWindow[] {
  const next = [
    ...existing,
    ...incoming.map((window) => ({ id: null as string | null, startTime: window.startTime, endTime: window.endTime })),
  ]
  const sorted = [...next].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  const merged: ScheduleWindow[] = []
  for (const window of sorted) {
    const last = merged[merged.length - 1]
    if (!last) {
      merged.push({ ...window })
      continue
    }
    if (timeToMinutes(window.startTime) < timeToMinutes(last.endTime)) {
      // Skip overlapping add; keep the earlier block.
      continue
    }
    merged.push({ ...window, id: null })
  }
  return merged
}

/** Puts common slots on every weekday that falls in the date range. */
export function applyCommonSlotsToDays(draft: ScheduleDraft): ScheduleDraft {
  const commonErrors = validateCommonWindows(draft.commonWindows)
  if (commonErrors.length > 0) return draft

  const targets = new Set(weekdaysInDateRange(draft.from, draft.until))
  const anyEnabled = draft.days.some((day) => day.enabled)
  const mode = draft.applyMode

  return {
    ...draft,
    ...syncAllClock(draft.commonWindows),
    days: draft.days.map((day, weekday) => {
      const inTarget = targets.has(weekday)
      if (!inTarget) {
        if (mode === 'replace') return { enabled: false, windows: [] }
        return day
      }

      if (mode === 'replace' || !anyEnabled || !day.enabled) {
        return {
          enabled: true,
          windows: draft.commonWindows.map((window) => ({
            id: null,
            startTime: window.startTime,
            endTime: window.endTime,
          })),
        }
      }

      return {
        enabled: true,
        windows: mergeWindows(day.windows, draft.commonWindows),
      }
    }),
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

export function setCommonWindows(draft: ScheduleDraft, commonWindows: ScheduleWindow[]): ScheduleDraft {
  return {
    ...draft,
    commonWindows,
    ...syncAllClock(commonWindows),
  }
}

export function updateCommonWindow(
  draft: ScheduleDraft,
  index: number,
  patch: Partial<Pick<ScheduleWindow, 'startTime' | 'endTime'>>,
): ScheduleDraft {
  const commonWindows = draft.commonWindows.map((window, windowIndex) =>
    windowIndex === index ? { ...window, ...patch } : window,
  )
  return setCommonWindows(draft, commonWindows)
}

export function addCommonWindow(draft: ScheduleDraft): ScheduleDraft {
  const last = draft.commonWindows[draft.commonWindows.length - 1]
  const start = last ? timeToMinutes(last.endTime) : timeToMinutes(DEFAULT_RANGE_START)
  const end = Math.min(start + 60, 23 * 60 + 59)
  if (end <= start) return draft
  return setCommonWindows(draft, [
    ...draft.commonWindows,
    { id: null, startTime: minutesToTime(start), endTime: minutesToTime(end) },
  ])
}

export function removeCommonWindow(draft: ScheduleDraft, index: number): ScheduleDraft {
  if (draft.commonWindows.length <= 1) return draft
  return setCommonWindows(
    draft,
    draft.commonWindows.filter((_, windowIndex) => windowIndex !== index),
  )
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

export function validateScheduleDraft(draft: ScheduleDraft, today = toISODate(new Date())) {
  const errors = validateAvailableRange(draft.from || null, draft.until || null)
  if (!draft.days.some((day) => day.enabled)) {
    errors.push('Apply common hours or set at least one weekday so candidates can book.')
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

export function dateCalendarKind(
  date: string,
  draft: ScheduleDraft,
  customDates: ReadonlySet<string>,
  blockedDates: ReadonlySet<string> = new Set(),
): CalendarDayKind {
  if (!isDateWithinRange(date, draft.from || null, draft.until || null)) return 'outside'
  if (blockedDates.has(date)) return 'unavailable'
  if (customDates.has(date)) return 'custom'
  const weekday = fromYMD(date).getDay()
  const day = draft.days[weekday]
  if (day?.enabled && day.windows.length > 0) return 'available'
  return 'unavailable'
}

export function scheduleSummary(draft: ScheduleDraft, customDates: ReadonlySet<string>) {
  const dates = eachDateInRange(draft.from, draft.until)
  let common = 0
  let custom = 0
  let closed = 0
  for (const date of dates) {
    const kind = dateCalendarKind(date, draft, customDates)
    if (kind === 'custom') custom += 1
    else if (kind === 'available') common += 1
    else closed += 1
  }
  return {
    total: dates.length,
    common,
    custom,
    closed,
  }
}

export type MonthCell = {
  date: string
  inMonth: boolean
  dayNumber: number
}

export function buildMonthCells(monthAnchor: Date): MonthCell[] {
  const year = monthAnchor.getFullYear()
  const month = monthAnchor.getMonth()
  const first = new Date(year, month, 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index)
    return {
      date: toISODate(date),
      inMonth: date.getMonth() === month,
      dayNumber: date.getDate(),
    }
  })
}
