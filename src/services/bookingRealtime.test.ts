import { describe, expect, it, vi } from 'vitest'
import {
  acceptBookingAndAwaitConfirmation,
  acceptBookingForInterview,
  watchBookingStatus,
  type RealtimeChannelLike,
  type RealtimeClientLike,
} from './bookingRealtime.ts'
import type { InterviewerBooking } from './interviewerBookings.ts'
import type { InterviewSessionRecord } from './interviewSessions.ts'

const BOOKING_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '11111111-1111-4111-8111-111111111111'

type SubscribeCallback = Parameters<RealtimeChannelLike['subscribe']>[0]

function fakeClient() {
  const state = {
    filter: null as unknown,
    onChange: null as ((payload: { new?: unknown }) => void) | null,
    onStatus: null as SubscribeCallback | null,
    removed: 0,
  }
  const channel: RealtimeChannelLike = {
    on(_type, filter, callback) {
      state.filter = filter
      state.onChange = callback
      return channel
    },
    subscribe(callback) {
      state.onStatus = callback
      return channel
    },
  }
  const client: RealtimeClientLike = {
    channel: () => channel,
    removeChannel: () => {
      state.removed += 1
    },
  }
  return { client, state }
}

const booking = (status: InterviewerBooking['status']) => ({ id: BOOKING_ID, status }) as InterviewerBooking

describe('watchBookingStatus', () => {
  it('filters bookings updates to one id and resolves when subscribed', async () => {
    const { client, state } = fakeClient()
    const onChange = vi.fn()
    const watch = watchBookingStatus(BOOKING_ID, onChange, client)
    expect(state.filter).toEqual({ event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${BOOKING_ID}` })

    state.onStatus?.('SUBSCRIBED')
    await expect(watch.ready).resolves.toBeUndefined()

    state.onChange?.({ new: { id: BOOKING_ID, status: 'confirmed' } })
    state.onChange?.({ new: { id: 'other', status: 'confirmed' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ bookingId: BOOKING_ID, status: 'confirmed' })

    watch.unsubscribe()
    watch.unsubscribe()
    state.onChange?.({ new: { id: BOOKING_ID, status: 'completed' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(state.removed).toBe(1)
  })

  it('rejects ready when the channel fails', async () => {
    const { client, state } = fakeClient()
    const watch = watchBookingStatus(BOOKING_ID, () => {}, client)
    state.onStatus?.('CHANNEL_ERROR', new Error('boom'))
    await expect(watch.ready).rejects.toThrow('boom')
  })
})

describe('acceptBookingAndAwaitConfirmation', () => {
  it('subscribes before confirming and resolves from the realtime event', async () => {
    const { client, state } = fakeClient()
    const order: string[] = []
    const confirm = vi.fn(async () => {
      order.push('confirm')
      state.onChange?.({ new: { id: BOOKING_ID, status: 'confirmed' } })
      return booking('confirmed')
    })
    const pending = acceptBookingAndAwaitConfirmation(BOOKING_ID, {
      confirm,
      watch: (id, onChange) => {
        order.push('subscribe')
        const watch = watchBookingStatus(id, onChange, client)
        state.onStatus?.('SUBSCRIBED')
        return watch
      },
      timeoutMs: 10_000,
    })
    await expect(pending).resolves.toEqual({ booking: booking('confirmed'), confirmedVia: 'realtime' })
    expect(order).toEqual(['subscribe', 'confirm'])
    expect(state.removed).toBe(1)
  })

  it('falls back to the RPC result after the timeout without polling', async () => {
    const { client, state } = fakeClient()
    const confirm = vi.fn(async () => booking('confirmed'))
    const result = await acceptBookingAndAwaitConfirmation(BOOKING_ID, {
      confirm,
      watch: (id, onChange) => {
        const watch = watchBookingStatus(id, onChange, client)
        state.onStatus?.('SUBSCRIBED')
        return watch
      },
      timeoutMs: 5,
    })
    expect(result.confirmedVia).toBe('rpc')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(state.removed).toBe(1)
  })

  it('unsubscribes when confirmation fails', async () => {
    const { client, state } = fakeClient()
    await expect(
      acceptBookingAndAwaitConfirmation(BOOKING_ID, {
        confirm: async () => {
          throw new Error('This booking was already updated.')
        },
        watch: (id, onChange) => {
          const watch = watchBookingStatus(id, onChange, client)
          state.onStatus?.('SUBSCRIBED')
          return watch
        },
      }),
    ).rejects.toThrow('already updated')
    expect(state.removed).toBe(1)
  })
})

describe('acceptBookingForInterview', () => {
  const START = Date.parse('2026-10-06T08:00:00.000Z')
  const scheduled = (startsAtUtc: string) =>
    ({ id: BOOKING_ID, status: 'confirmed', startsAtUtc, durationMin: 30 }) as InterviewerBooking
  const session = async () => ({ id: SESSION_ID, bookingId: BOOKING_ID }) as InterviewSessionRecord

  it("accepting tomorrow's interview confirms it without opening the call", async () => {
    const result = await acceptBookingForInterview(BOOKING_ID, {
      accept: async () => ({ booking: scheduled('2026-10-06T08:00:00.000Z'), confirmedVia: 'realtime' }),
      findSession: session,
      now: () => START - 24 * 60 * 60_000,
    })
    expect(result.booking.status).toBe('confirmed')
    expect(result.lobbyOpen).toBe(false)
    expect(result.callPath).toBe(`/interviewer/interview/${SESSION_ID}`)
  })

  it('offers the lobby when accepting inside the 30-minute early window', async () => {
    const result = await acceptBookingForInterview(BOOKING_ID, {
      accept: async () => ({ booking: scheduled('2026-10-06T08:00:00.000Z'), confirmedVia: 'rpc' }),
      findSession: session,
      now: () => START - 20 * 60_000,
    })
    expect(result.lobbyOpen).toBe(true)
  })

  it('does not look up the session when acceptance fails', async () => {
    const findSession = vi.fn()
    await expect(
      acceptBookingForInterview(BOOKING_ID, {
        accept: async () => {
          throw new Error('nope')
        },
        findSession,
      }),
    ).rejects.toThrow('nope')
    expect(findSession).not.toHaveBeenCalled()
  })
})
