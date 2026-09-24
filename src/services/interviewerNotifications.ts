import { formatDateShortInZone, formatTimeInZone } from '../lib/dates.ts'
import { supabase } from '../lib/supabase.ts'
import { requireUser } from './auth.ts'
import {
  getMyBookingsByIds,
  interviewerBookingHref,
  tabForBooking,
  type InterviewerBooking,
} from './interviewerBookings.ts'
import { TABLES } from './tables.ts'

export const NOTIFICATION_PAGE_SIZE = 50

/** Kinds emitted by existing `private.notify` / booking triggers. */
export const NOTIFICATION_KINDS = [
  'booking_requested',
  'booking_confirmed',
  'booking_rejected',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_expired',
  'interview_completed',
  'interview_reminder',
  'feedback_ready',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export type InterviewerNotification = {
  id: string
  kind: string
  title: string
  body: string
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export type NotificationBoard = {
  items: InterviewerNotification[]
  unreadCount: number
  bookingsById: Map<string, InterviewerBooking>
}

export type NotificationDisplay = {
  title: string
  body: string
  dateLabel: string | null
  timeLabel: string | null
  actionLabel: string | null
}

const SELECT_COLUMNS = 'id, kind, title, body, payload, read_at, created_at'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function mapLoadError(error: { message?: string; code?: string } | null) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  throw new Error('Could not load notifications. Check your connection and try again.')
}

function mapUpdateError(error: { message?: string; code?: string } | null) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    throw new Error('You can only update your own notifications.')
  }
  throw new Error('Could not update that notification. Try again.')
}

function parsePayload(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function parseNotification(value: unknown): InterviewerNotification | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const kind = readString(value, 'kind')
  const title = readString(value, 'title')
  const body = readString(value, 'body')
  const createdAt = readString(value, 'created_at')
  if (!id || !kind || !title || !body || !createdAt) return null
  return {
    id,
    kind,
    title,
    body,
    payload: parsePayload(value.payload),
    readAt: readString(value, 'read_at'),
    createdAt,
  }
}

export function notificationBookingId(item: Pick<InterviewerNotification, 'payload'>) {
  const value = item.payload.booking_id
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function notificationHref(
  item: Pick<InterviewerNotification, 'kind' | 'payload'>,
  booking?: InterviewerBooking | null,
) {
  const bookingId = notificationBookingId(item)
  if (bookingId && booking) {
    if (item.kind === 'interview_reminder') {
      return `/interviewer/interview/${bookingId}`
    }
    if (item.kind === 'interview_completed') {
      return `/interviewer/feedback/${bookingId}`
    }
    const tab = tabForBooking(booking.status)
    if (tab) return interviewerBookingHref(bookingId, booking.status)
  }
  switch (item.kind) {
    case 'booking_requested':
      return bookingId ? interviewerBookingHref(bookingId, 'requested') : '/interviewer/bookings?tab=pending'
    case 'booking_cancelled':
    case 'booking_expired':
    case 'booking_rejected':
      return bookingId
        ? interviewerBookingHref(bookingId, 'cancelled')
        : '/interviewer/bookings?tab=cancelled'
    case 'booking_rescheduled':
      return bookingId
        ? interviewerBookingHref(bookingId, 'rescheduled')
        : '/interviewer/bookings?tab=cancelled'
    case 'booking_confirmed':
      return bookingId
        ? interviewerBookingHref(bookingId, 'confirmed')
        : '/interviewer/bookings?tab=upcoming'
    case 'interview_reminder':
      return bookingId ? `/interviewer/interview/${bookingId}` : '/interviewer/bookings?tab=upcoming'
    case 'interview_completed':
      return bookingId ? `/interviewer/feedback/${bookingId}` : '/interviewer/bookings?tab=completed'
    case 'feedback_ready':
      return '/interviewer/reviews'
    default:
      return bookingId ? interviewerBookingHref(bookingId) : '/interviewer/dashboard'
  }
}

export function notificationDisplay(
  item: InterviewerNotification,
  booking?: InterviewerBooking | null,
): NotificationDisplay {
  if (item.kind === 'booking_requested') {
    const candidate = booking?.candidate.name?.trim() || 'A candidate'
    const service = booking?.serviceName?.trim() || 'a session'
    return {
      title: 'New Interview Request',
      body: `${candidate} requested ${service}.`,
      dateLabel: booking
        ? formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)
        : null,
      timeLabel: booking ? formatTimeInZone(booking.startsAtUtc, booking.displayTimezone) : null,
      actionLabel: 'Review Booking',
    }
  }

  const dateLabel = booking
    ? formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)
    : null
  const timeLabel = booking ? formatTimeInZone(booking.startsAtUtc, booking.displayTimezone) : null
  const hasBookingLink = Boolean(notificationBookingId(item)) && item.kind !== 'feedback_ready'

  if (item.kind === 'booking_cancelled') {
    return {
      title: item.title,
      body: booking ? `${booking.candidate.name} · ${booking.serviceName} was cancelled.` : item.body,
      dateLabel,
      timeLabel,
      actionLabel: hasBookingLink ? 'View booking' : null,
    }
  }
  if (item.kind === 'booking_rescheduled') {
    return {
      title: item.title,
      body: booking ? `${booking.serviceName} was moved to a new time.` : item.body,
      dateLabel,
      timeLabel,
      actionLabel: hasBookingLink ? 'View booking' : null,
    }
  }

  return {
    title: item.title,
    body: item.body,
    dateLabel,
    timeLabel,
    actionLabel: hasBookingLink ? 'View booking' : null,
  }
}

export function formatNotificationTime(iso: string, now = Date.now()) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const delta = Math.max(0, now - then)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function listMyNotifications(limit = NOTIFICATION_PAGE_SIZE): Promise<InterviewerNotification[]> {
  await requireUser()
  const { data, error } = await supabase
    .from(TABLES.notifications)
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  mapLoadError(error)
  return (data ?? []).map(parseNotification).filter((item): item is InterviewerNotification => Boolean(item))
}

export async function countMyUnreadNotifications(): Promise<number> {
  await requireUser()
  const { count, error } = await supabase
    .from(TABLES.notifications)
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  mapLoadError(error)
  return count ?? 0
}

export async function loadMyNotificationBoard(limit = NOTIFICATION_PAGE_SIZE): Promise<NotificationBoard> {
  const [items, unreadCount] = await Promise.all([listMyNotifications(limit), countMyUnreadNotifications()])
  const bookingIds = items.map(notificationBookingId).filter((id): id is string => Boolean(id))
  let bookingsById = new Map<string, InterviewerBooking>()
  try {
    bookingsById = await getMyBookingsByIds(bookingIds)
  } catch {
    bookingsById = new Map()
  }
  return { items, unreadCount, bookingsById }
}

export async function markNotificationRead(id: string): Promise<void> {
  await requireUser()
  const { error } = await supabase
    .from(TABLES.notifications)
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  mapUpdateError(error)
}

export async function markAllNotificationsRead(): Promise<void> {
  await requireUser()
  const { error } = await supabase
    .from(TABLES.notifications)
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  mapUpdateError(error)
}
