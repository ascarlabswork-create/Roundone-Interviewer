import { getCurrentInterviewer } from './interviewer.ts'
import {
  listMyBookingsWithStatuses,
  type DbBookingStatus,
  type InterviewerBooking,
} from './interviewerBookings.ts'

export const EARNED_BOOKING_STATUSES = ['completed'] as const satisfies readonly DbBookingStatus[]
export const UNSETTLED_BOOKING_STATUSES = [
  'requested',
  'confirmed',
  'in_progress',
] as const satisfies readonly DbBookingStatus[]

export type EarningsPeriod = 'all' | 'this_month' | 'last_month' | 'last_3_months'

export type EarningsRow = {
  bookingId: string
  startsAtUtc: string
  candidateName: string
  serviceName: string
  interviewType: string
  status: DbBookingStatus
  sessionFeePaise: number
  platformFeePaise: number
  netPaise: number
  currency: string
}

export type EarningsMonth = {
  key: string
  label: string
  completedCount: number
  netPaise: number
}

export type EarningsService = {
  serviceName: string
  completedCount: number
  netPaise: number
}

export type EarningsBoard = {
  timezone: string
  period: EarningsPeriod
  totalNetPaise: number
  completedCount: number
  thisMonthNetPaise: number
  unsettledNetPaise: number
  unsettledCount: number
  history: EarningsRow[]
  months: EarningsMonth[]
  services: EarningsService[]
}

function ymdInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return { year: Number(year), month: Number(month), day: Number(day) }
}

function monthStartIso(year: number, month: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`
}

function addMonths(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export function earningsDateRange(period: EarningsPeriod, timeZone: string, now = new Date()) {
  if (period === 'all') return {}
  const today = ymdInZone(now, timeZone)
  if (!today) return {}
  if (period === 'this_month') {
    return { fromIso: monthStartIso(today.year, today.month) }
  }
  if (period === 'last_month') {
    const start = addMonths(today.year, today.month, -1)
    return {
      fromIso: monthStartIso(start.year, start.month),
      toExclusiveIso: monthStartIso(today.year, today.month),
    }
  }
  const start = addMonths(today.year, today.month, -2)
  return { fromIso: monthStartIso(start.year, start.month) }
}

export function netEarningsPaise(sessionFeePaise: number, platformFeePaise: number) {
  return sessionFeePaise - platformFeePaise
}

function toRow(booking: InterviewerBooking): EarningsRow {
  return {
    bookingId: booking.id,
    startsAtUtc: booking.startsAtUtc,
    candidateName: booking.candidate.name,
    serviceName: booking.serviceName,
    interviewType: booking.interviewType,
    status: booking.status,
    sessionFeePaise: booking.sessionFeePaise,
    platformFeePaise: booking.platformFeePaise,
    netPaise: netEarningsPaise(booking.sessionFeePaise, booking.platformFeePaise),
    currency: booking.currency,
  }
}

function sumNet(rows: Array<{ netPaise: number }>) {
  return rows.reduce((total, row) => total + row.netPaise, 0)
}

function monthKeyInZone(iso: string, timeZone: string) {
  const parts = ymdInZone(new Date(iso), timeZone)
  if (!parts) return null
  const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`
  const label = new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { key, label }
}

function groupMonths(rows: EarningsRow[], timeZone: string): EarningsMonth[] {
  const byKey = new Map<string, EarningsMonth>()
  for (const row of rows) {
    const month = monthKeyInZone(row.startsAtUtc, timeZone)
    if (!month) continue
    const current = byKey.get(month.key) ?? {
      key: month.key,
      label: month.label,
      completedCount: 0,
      netPaise: 0,
    }
    current.completedCount += 1
    current.netPaise += row.netPaise
    byKey.set(month.key, current)
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function groupServices(rows: EarningsRow[]): EarningsService[] {
  const byName = new Map<string, EarningsService>()
  for (const row of rows) {
    const current = byName.get(row.serviceName) ?? {
      serviceName: row.serviceName,
      completedCount: 0,
      netPaise: 0,
    }
    current.completedCount += 1
    current.netPaise += row.netPaise
    byName.set(row.serviceName, current)
  }
  return [...byName.values()].sort((a, b) => b.netPaise - a.netPaise)
}

function mapLoadError(error: unknown): never {
  if (error instanceof Error && /sign in/i.test(error.message)) throw error
  throw new Error('Could not load earnings. Check your connection and try again.')
}

export async function loadMyEarnings(period: EarningsPeriod): Promise<EarningsBoard> {
  try {
    const account = await getCurrentInterviewer()
    const timezone = account.interviewer.timezone || account.profile.timezone || 'Asia/Kolkata'
    const thisMonth = earningsDateRange('this_month', timezone)
    const historyRange = earningsDateRange(period, timezone)

    const [completed, thisMonthCompleted, unsettled, historySource] = await Promise.all([
      listMyBookingsWithStatuses(EARNED_BOOKING_STATUSES),
      listMyBookingsWithStatuses(EARNED_BOOKING_STATUSES, thisMonth),
      listMyBookingsWithStatuses(UNSETTLED_BOOKING_STATUSES),
      period === 'all'
        ? Promise.resolve(null)
        : listMyBookingsWithStatuses(EARNED_BOOKING_STATUSES, historyRange),
    ])

    const historyBookings = historySource ?? completed
    const history = historyBookings.map(toRow)
    const completedRows = completed.map(toRow)
    const thisMonthRows = thisMonthCompleted.map(toRow)
    const unsettledRows = unsettled.map(toRow)

    return {
      timezone,
      period,
      totalNetPaise: sumNet(completedRows),
      completedCount: completedRows.length,
      thisMonthNetPaise: sumNet(thisMonthRows),
      unsettledNetPaise: sumNet(unsettledRows),
      unsettledCount: unsettledRows.length,
      history,
      months: groupMonths(history, timezone),
      services: groupServices(history),
    }
  } catch (error) {
    mapLoadError(error)
  }
}
