import { formatTimezoneLabel } from './timezones.ts'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function parseSlot(iso: string) {
  return new Date(iso)
}

export function formatDateLong(iso: string) {
  return parseSlot(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(iso: string) {
  return parseSlot(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string) {
  return parseSlot(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatReviewDate(isoDate: string) {
  const date = isoDate.includes('T') ? parseSlot(isoDate) : new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function completedWhenLabel(iso: string) {
  if (sameDay(parseSlot(iso), new Date())) return 'Completed today'
  return `Completed ${formatDateShort(iso)}`
}

export function formatWeekday(iso: string) {
  return WEEKDAYS[parseSlot(iso).getDay()]
}

export function weekdayShort(date: Date) {
  return WEEKDAYS_SHORT[date.getDay()]
}

export function weekdayNameFromDate(date: Date) {
  return WEEKDAYS[date.getDay()]
}

export function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const day = next.getDay()
  next.setDate(next.getDate() - day)
  return next
}

export function atLocal(daysFromToday: number, hour: number, minute = 0) {
  const date = addDays(new Date(), daysFromToday)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

export function fromYMD(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function combineDateTime(ymd: string, hhmm: string) {
  const [hour, minute] = hhmm.split(':').map(Number)
  const date = fromYMD(ymd)
  date.setHours(hour, minute, 0, 0)
  return date
}

export function timeToMinutes(hhmm: string) {
  const [hour, minute] = hhmm.split(':').map(Number)
  return hour * 60 + minute
}

export function minutesToTime(total: number) {
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function formatClock(hhmm: string) {
  return combineDateTime('2026-01-01', hhmm).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatClockRange(start: string, end: string) {
  return `${formatClock(start)} → ${formatClock(end)}`
}

export type ClockPeriod = 'AM' | 'PM'

/** Split stored 24-hour HH:MM into 12-hour parts for manual AM/PM entry. */
export function clockPartsFrom24h(hhmm: string): { hour12: number; minute: number; period: ClockPeriod } {
  const safe = hhmm.trim().slice(0, 5)
  const match = /^(\d{1,2}):(\d{2})$/.exec(safe)
  const hour24 = match ? Number(match[1]) : 9
  const minute = match ? Number(match[2]) : 0
  const clampedHour = Number.isFinite(hour24) ? Math.min(23, Math.max(0, hour24)) : 9
  const clampedMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0
  const period: ClockPeriod = clampedHour >= 12 ? 'PM' : 'AM'
  let hour12 = clampedHour % 12
  if (hour12 === 0) hour12 = 12
  return { hour12, minute: clampedMinute, period }
}

/** Combine 12-hour parts into stored 24-hour HH:MM (any minute, any hour 1–12). */
export function clock24hFromParts(hour12: number, minute: number, period: ClockPeriod): string {
  const hour = Math.min(12, Math.max(1, Math.floor(hour12)))
  const min = Math.min(59, Math.max(0, Math.floor(minute)))
  let hour24 = hour % 12
  if (period === 'PM') hour24 += 12
  return minutesToTime(hour24 * 60 + min)
}

export function timezoneLabel(zone: string) {
  return formatTimezoneLabel(zone)
}

/** Same instant shown in two zones (e.g. interviewer CST + candidate IST). */
export function formatInstantInTwoZones(
  iso: string,
  zoneA: string,
  zoneB: string,
  format: 'time' | 'datetime' = 'time',
) {
  if (zoneA === zoneB) {
    return format === 'time'
      ? `${formatTimeInZone(iso, zoneA)} (${timezoneLabel(zoneA)})`
      : `${formatDateLongInZone(iso, zoneA)} · ${formatTimeInZone(iso, zoneA)} (${timezoneLabel(zoneA)})`
  }
  if (format === 'time') {
    return `${formatTimeInZone(iso, zoneA)} (${timezoneLabel(zoneA)}) · ${formatTimeInZone(iso, zoneB)} (${timezoneLabel(zoneB)})`
  }
  return `${formatDateLongInZone(iso, zoneA)} · ${formatTimeInZone(iso, zoneA)} (${timezoneLabel(zoneA)}) · ${formatTimeInZone(iso, zoneB)} (${timezoneLabel(zoneB)})`
}

function formatDateInZone(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const date = parseSlot(iso)
  try {
    return date.toLocaleDateString('en-IN', { ...options, timeZone })
  } catch {
    return date.toLocaleDateString('en-IN', options)
  }
}

function formatTimeOnlyInZone(iso: string, timeZone: string) {
  const date = parseSlot(iso)
  try {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone })
  } catch {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  }
}

export function formatDateLongInZone(iso: string, timeZone: string) {
  return formatDateInZone(iso, timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShortInZone(iso: string, timeZone: string) {
  return formatDateInZone(iso, timeZone, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTimeInZone(iso: string, timeZone: string) {
  return formatTimeOnlyInZone(iso, timeZone)
}

export function isPastYmd(ymd: string) {
  return fromYMD(ymd) < startOfDay(new Date())
}

export function nextDateWithWeekday(weekday: number, from = new Date()) {
  const start = startOfDay(from)
  for (let offset = 0; offset < 14; offset += 1) {
    const day = addDays(start, offset)
    if (day.getDay() === weekday) return toISODate(day)
  }
  return toISODate(start)
}
