import { supabase } from '../lib/supabase.ts'
import { confirmBooking, type InterviewerBooking } from './interviewerBookings.ts'
import { getInterviewSessionByBooking, type InterviewSessionRecord } from './interviewSessions.ts'
import { TABLES } from './tables.ts'

export type BookingStatusChange = { bookingId: string; status: string }

type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'

export type RealtimeChannelLike = {
  on(
    type: 'postgres_changes',
    filter: { event: 'UPDATE'; schema: string; table: string; filter: string },
    callback: (payload: { new?: unknown }) => void,
  ): RealtimeChannelLike
  subscribe(callback: (status: ChannelStatus, error?: Error) => void): RealtimeChannelLike
}

export type RealtimeClientLike = {
  channel(name: string): RealtimeChannelLike
  removeChannel(channel: RealtimeChannelLike): unknown
}

export type BookingStatusWatch = {
  /** Resolves once the channel is subscribed; rejects if it cannot subscribe. */
  ready: Promise<void>
  unsubscribe: () => void
}

const defaultClient = () => supabase as unknown as RealtimeClientLike

function readChange(payload: { new?: unknown }): BookingStatusChange | null {
  const row = payload.new
  if (!row || typeof row !== 'object') return null
  const { id, status } = row as Record<string, unknown>
  return typeof id === 'string' && typeof status === 'string' ? { bookingId: id, status } : null
}

/**
 * Streams status changes for one booking. RLS on bookings still applies to
 * Realtime, so only the booking's own parties receive events.
 */
export function watchBookingStatus(
  bookingId: string,
  onChange: (change: BookingStatusChange) => void,
  client: RealtimeClientLike = defaultClient(),
): BookingStatusWatch {
  let closed = false
  let settled = false
  let resolveReady: () => void = () => {}
  let rejectReady: (error: Error) => void = () => {}
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  ready.catch(() => {})

  const channel = client
    .channel(`booking-status:${bookingId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLES.bookings, filter: `id=eq.${bookingId}` },
      (payload) => {
        if (closed) return
        const change = readChange(payload)
        if (change && change.bookingId === bookingId) onChange(change)
      },
    )

  const unsubscribe = () => {
    if (closed) return
    closed = true
    if (!settled) {
      settled = true
      rejectReady(new Error('Realtime subscription closed.'))
    }
    void client.removeChannel(channel)
  }

  channel.subscribe((status, error) => {
    if (settled) return
    if (status === 'SUBSCRIBED') {
      settled = true
      resolveReady()
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      settled = true
      rejectReady(error ?? new Error(`Realtime subscription failed: ${status}`))
    }
  })

  return { ready, unsubscribe }
}

export const CONFIRMATION_REALTIME_TIMEOUT_MS = 5_000

export type AcceptResult = {
  booking: InterviewerBooking
  confirmedVia: 'realtime' | 'rpc'
}

/**
 * Subscribes to the booking before confirming it so the confirmed state is
 * delivered over Realtime. Falls back to the confirm RPC result if the event
 * does not arrive in time; never polls.
 */
export async function acceptBookingAndAwaitConfirmation(
  bookingId: string,
  deps: {
    confirm?: (bookingId: string) => Promise<InterviewerBooking>
    watch?: (bookingId: string, onChange: (change: BookingStatusChange) => void) => BookingStatusWatch
    timeoutMs?: number
  } = {},
): Promise<AcceptResult> {
  const confirm = deps.confirm ?? confirmBooking
  const watch = deps.watch ?? ((id, onChange) => watchBookingStatus(id, onChange))
  const timeoutMs = deps.timeoutMs ?? CONFIRMATION_REALTIME_TIMEOUT_MS

  let markConfirmed: () => void = () => {}
  const confirmedEvent = new Promise<'realtime'>((resolve) => {
    markConfirmed = () => resolve('realtime')
  })
  const subscription = watch(bookingId, (change) => {
    if (change.status === 'confirmed' || change.status === 'in_progress') markConfirmed()
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const realtimeReady = await subscription.ready.then(
      () => true,
      () => false,
    )
    const booking = await confirm(bookingId)
    if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
      throw new Error('This booking could not be confirmed.')
    }
    if (!realtimeReady) return { booking, confirmedVia: 'rpc' }
    const via = await Promise.race([
      confirmedEvent,
      new Promise<'rpc'>((resolve) => {
        timer = setTimeout(() => resolve('rpc'), timeoutMs)
      }),
    ])
    return { booking, confirmedVia: via }
  } finally {
    if (timer) clearTimeout(timer)
    subscription.unsubscribe()
  }
}

export function interviewCallPath(id: string) {
  return `/interviewer/interview/${id}`
}

/** Accepts a request and returns the call route, keyed by interview_session_id. */
export async function acceptBookingAndGetCallPath(
  bookingId: string,
  deps: {
    accept?: (bookingId: string) => Promise<AcceptResult>
    findSession?: (bookingId: string) => Promise<InterviewSessionRecord | null>
  } = {},
): Promise<string> {
  const accept = deps.accept ?? ((id) => acceptBookingAndAwaitConfirmation(id))
  const findSession = deps.findSession ?? ((id) => getInterviewSessionByBooking(id, { retries: 6 }))
  const { booking } = await accept(bookingId)
  const session = await findSession(booking.id)
  return interviewCallPath(session?.id ?? booking.id)
}
