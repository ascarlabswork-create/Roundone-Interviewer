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

export function timezoneLabel(zone: string) {
  if (zone === 'Asia/Kolkata') return 'Asia/Kolkata (IST)'
  return zone
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
