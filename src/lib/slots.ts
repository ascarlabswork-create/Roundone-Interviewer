import { WEEKDAY_LABELS } from '../data/catalogs.ts'
import { isValidTimezone } from './timezones.ts'
import {
  combineDateTime,
  formatClock,
  fromYMD,
  minutesToTime,
  timeToMinutes,
  toISODate,
} from './dates.ts'
import type {
  AvailabilitySchedule,
  BookableSlot,
  Booking,
  CalendarPeriod,
  CustomAvailabilitySlot,
  RecurringAvailability,
} from '../types.ts'

export type SlotEngineInput = {
  schedule: AvailabilitySchedule
  bookings: Booking[]
  date: string
  durationMin: number
  serviceId?: string | null
}

type Interval = {
  start: number
  end: number
  source?: 'recurring' | 'custom'
  label?: string
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end
}

function mergeIntervals(items: Interval[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const item of sorted) {
    const last = merged[merged.length - 1]
    if (last && item.start <= last.end) {
      last.end = Math.max(last.end, item.end)
      if (last.source !== item.source) last.source = last.source ?? item.source
    } else {
      merged.push({ ...item })
    }
  }
  return merged
}

function appliesToService(serviceId: string | null | undefined, selected?: string | null) {
  if (!serviceId) return true
  if (!selected) return true
  return serviceId === selected
}

export function isDateWithinRange(date: string, from?: string | null, until?: string | null) {
  if (from && date < from) return false
  if (until && date > until) return false
  return true
}

export const RANGE_START_AFTER_END = 'Start date must be on or before the end date.'

export function validateAvailableRange(from: string | null, until: string | null) {
  const errors: string[] = []
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toISODate(fromYMD(value)) === value
  if (from && !isDate(from)) errors.push('Choose a valid start date.')
  if (until && !isDate(until)) errors.push('Choose a valid end date.')
  if (from && until && from > until) errors.push(RANGE_START_AFTER_END)
  return errors
}

function windowsForDate(input: SlotEngineInput): Interval[] {
  const { availableFrom, availableUntil } = input.schedule.settings
  if (!isDateWithinRange(input.date, availableFrom, availableUntil)) return []
  const weekday = fromYMD(input.date).getDay()
  const windows: Interval[] = []

  for (const range of input.schedule.recurring) {
    if (!range.isActive) continue
    if (range.dayOfWeek !== weekday) continue
    if (!appliesToService(range.serviceId, input.serviceId)) continue
    windows.push({
      start: timeToMinutes(range.startTime),
      end: timeToMinutes(range.endTime),
      source: 'recurring',
    })
  }

  for (const slot of input.schedule.customSlots) {
    if (slot.date !== input.date) continue
    if (!appliesToService(slot.serviceId, input.serviceId)) continue
    windows.push({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime),
      source: 'custom',
    })
  }

  return mergeIntervals(windows)
}

function blockedForDate(schedule: AvailabilitySchedule, date: string): Interval[] {
  return schedule.blockedTimes
    .filter((item) => item.date === date)
    .map((item) =>
      item.allDay || !item.startTime || !item.endTime
        ? { start: 0, end: 24 * 60, label: item.reason }
        : { start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime), label: item.reason },
    )
}

function bookedForDate(bookings: Booking[], date: string): Interval[] {
  return bookings
    .filter((item) => item.status === 'upcoming')
    .filter((item) => toISODate(new Date(item.start)) === date)
    .map((item) => {
      const start = new Date(item.start)
      const startMin = start.getHours() * 60 + start.getMinutes()
      return {
        start: startMin,
        end: startMin + item.durationMin,
        label: item.serviceName,
      }
    })
}

export function generateBookableSlots(input: SlotEngineInput): BookableSlot[] {
  const { schedule, date, durationMin } = input
  const bufferMin = schedule.settings.bufferMin
  const windows = windowsForDate(input)
  const blocked = blockedForDate(schedule, date)
  const booked = bookedForDate(input.bookings, date)
  const slots: BookableSlot[] = []

  for (const window of windows) {
    for (let start = window.start; start + durationMin <= window.end; start += durationMin) {
      const end = start + durationMin
      const session = { start, end }
      if (blocked.some((item) => overlaps(session, item))) continue
      if (
        booked.some((item) =>
          overlaps(session, { start: item.start - bufferMin, end: item.end + bufferMin }),
        )
      ) {
        continue
      }
      const startTime = minutesToTime(start)
      const endTime = minutesToTime(end)
      slots.push({
        id: `${date}-${startTime}-${durationMin}`,
        date,
        startTime,
        endTime,
        start: combineDateTime(date, startTime).toISOString(),
        end: combineDateTime(date, endTime).toISOString(),
        durationMin,
        source: window.source ?? 'recurring',
      })
    }
  }

  return slots
}

export function generateUpcomingSlots(
  schedule: AvailabilitySchedule,
  bookings: Booking[],
  durationMin: number,
  days = 21,
): BookableSlot[] {
  const today = toISODate(new Date())
  const slots: BookableSlot[] = []
  const start = fromYMD(today)
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    const ymd = toISODate(date)
    slots.push(
      ...generateBookableSlots({
        schedule,
        bookings,
        date: ymd,
        durationMin,
      }),
    )
  }
  return slots.filter((slot) => new Date(slot.start) > new Date())
}

export function buildDayPeriods(input: SlotEngineInput): CalendarPeriod[] {
  const windows = windowsForDate(input)
  const blocked = blockedForDate(input.schedule, input.date)
  const booked = bookedForDate(input.bookings, input.date)
  const bounds = new Set<number>([0, 24 * 60])
  for (const item of [...windows, ...blocked, ...booked]) {
    bounds.add(item.start)
    bounds.add(item.end)
  }
  const points = [...bounds].sort((a, b) => a - b)
  const periods: CalendarPeriod[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const startMin = points[index]
    const endMin = points[index + 1]
    if (endMin - startMin < 1) continue
    const mid = { start: startMin, end: endMin }
    const isBlocked = blocked.some((item) => overlaps(mid, item))
    const isBooked = booked.some((item) => overlaps(mid, item))
    const isAvailable = windows.some((item) => overlaps(mid, item))
    let state: CalendarPeriod['state'] | null = null
    if (isBlocked) state = 'blocked'
    else if (isBooked) state = 'booked'
    else if (isAvailable) state = 'available'
    if (!state) continue
    const last = periods[periods.length - 1]
    if (last && last.state === state && last.endMin === startMin) {
      last.endMin = endMin
    } else {
      const bookedMatch = booked.find((item) => overlaps(mid, item))
      const blockedMatch = blocked.find((item) => overlaps(mid, item))
      periods.push({
        startMin,
        endMin,
        state,
        label: state === 'booked' ? bookedMatch?.label : state === 'blocked' ? blockedMatch?.label : undefined,
      })
    }
  }

  return periods
}

export function weeklyAvailableHours(recurring: RecurringAvailability[]) {
  return recurring
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + (timeToMinutes(item.endTime) - timeToMinutes(item.startTime)) / 60, 0)
}

export function validateRecurring(ranges: RecurringAvailability[], timezone: string) {
  const errors: string[] = []
  if (!timezone.trim()) errors.push('Timezone is required.')
  if (!isValidTimezone(timezone)) errors.push('Choose a valid timezone.')

  ranges.forEach((range) => {
    if (!range.isActive) return
    if (timeToMinutes(range.startTime) >= timeToMinutes(range.endTime)) {
      errors.push(`${WEEKDAY_LABELS[range.dayOfWeek]}: start time must be before end time.`)
    }
  })

  const active = ranges.filter((item) => item.isActive)
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i]
      const b = active[j]
      if (a.dayOfWeek !== b.dayOfWeek) continue
      if (a.serviceId && b.serviceId && a.serviceId !== b.serviceId) continue
      if (
        overlaps(
          { start: timeToMinutes(a.startTime), end: timeToMinutes(a.endTime) },
          { start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime) },
        )
      ) {
        errors.push(`${WEEKDAY_LABELS[a.dayOfWeek]} has overlapping availability ranges.`)
      }
    }
  }

  return [...new Set(errors)]
}

export function validateCustomSlot(slot: Pick<CustomAvailabilitySlot, 'date' | 'startTime' | 'endTime'>, existing: CustomAvailabilitySlot[]) {
  const errors: string[] = []
  if (!slot.date) errors.push('Choose a date.')
  else if (fromYMD(slot.date) < fromYMD(toISODate(new Date()))) errors.push('Past dates cannot be added as future availability.')
  if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) errors.push('Start time must be before end time.')
  const clash = existing.some(
    (item) =>
      item.date === slot.date &&
      overlaps(
        { start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) },
        { start: timeToMinutes(slot.startTime), end: timeToMinutes(slot.endTime) },
      ),
  )
  if (clash) errors.push('This custom slot overlaps another custom slot.')
  return errors
}

export function validateBlockedTime(item: { date: string; allDay: boolean; startTime: string; endTime: string }) {
  const errors: string[] = []
  if (!item.date) errors.push('Choose a date to block.')
  else if (fromYMD(item.date) < fromYMD(toISODate(new Date()))) errors.push('Past dates cannot be blocked as future unavailability.')
  if (!item.allDay && timeToMinutes(item.startTime) >= timeToMinutes(item.endTime)) {
    errors.push('Blocked start time must be before end time.')
  }
  return errors
}

export function nextAvailableLabel(slots: BookableSlot[]) {
  const next = slots[0]
  if (!next) return 'No upcoming slots'
  const date = fromYMD(next.date)
  const weekday = WEEKDAY_LABELS[date.getDay()]
  return `${weekday}, ${formatClock(next.startTime)}`
}

/** First slot when a weekday is turned on — one hour; widen start/end with the clock. */
export function defaultRangeForDay(dayOfWeek: number): { startTime: string; endTime: string } {
  if (dayOfWeek === 0 || dayOfWeek === 6) return { startTime: '10:00', endTime: '11:00' }
  if (dayOfWeek === 4) return { startTime: '19:00', endTime: '20:00' }
  return { startTime: '18:00', endTime: '19:00' }
}

const DAY_END_MINUTES = 23 * 60 + 59
const MIN_RANGE_MINUTES = 15
/** New rows from “Add time” start as a short window; length is not capped — edit freely. */
const DEFAULT_NEW_SLOT_MINUTES = 60

/** Picks the next weekly window that does not overlap existing ranges on the same day. */
export function proposeNextWeeklyRange(
  existing: { startTime: string; endTime: string }[],
  fallback: { startTime: string; endTime: string },
): { startTime: string; endTime: string } {
  const booked = existing
    .map((range) => ({
      start: timeToMinutes(range.startTime),
      end: timeToMinutes(range.endTime),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start)

  if (booked.length === 0) return fallback

  const candidates: Interval[] = []

  for (let index = 0; index < booked.length - 1; index += 1) {
    const gapStart = booked[index].end
    const gapEnd = booked[index + 1].start
    if (gapEnd - gapStart >= MIN_RANGE_MINUTES) {
      const span = Math.min(DEFAULT_NEW_SLOT_MINUTES, gapEnd - gapStart)
      candidates.push({ start: gapStart, end: gapStart + span })
    }
  }

  const last = booked[booked.length - 1]
  if (last.end + MIN_RANGE_MINUTES <= DAY_END_MINUTES) {
    const span = Math.min(DEFAULT_NEW_SLOT_MINUTES, DAY_END_MINUTES - last.end)
    candidates.push({ start: last.end, end: last.end + span })
  }

  const first = booked[0]
  if (first.start - 8 * 60 >= MIN_RANGE_MINUTES) {
    const span = Math.min(DEFAULT_NEW_SLOT_MINUTES, first.start - 8 * 60)
    candidates.push({
      start: first.start - span,
      end: first.start,
    })
  }

  for (const candidate of candidates) {
    if (candidate.end <= candidate.start) continue
    if (!booked.some((range) => overlaps(candidate, range))) {
      return { startTime: minutesToTime(candidate.start), endTime: minutesToTime(candidate.end) }
    }
  }

  throw new Error('No open time slot on this day. Remove or shorten a range first.')
}

export function bookingWindowSource(
  schedule: AvailabilitySchedule,
  booking: Booking,
): 'recurring' | 'custom' | null {
  const date = toISODate(new Date(booking.start))
  const start = new Date(booking.start)
  const startMin = start.getHours() * 60 + start.getMinutes()
  const session = { start: startMin, end: startMin + booking.durationMin }
  const custom = schedule.customSlots.find(
    (item) =>
      item.date === date &&
      overlaps(session, { start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) }),
  )
  if (custom) return 'custom'
  const weekday = fromYMD(date).getDay()
  const recurring = schedule.recurring.find(
    (item) =>
      item.isActive &&
      item.dayOfWeek === weekday &&
      overlaps(session, { start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) }),
  )
  return recurring ? 'recurring' : null
}
