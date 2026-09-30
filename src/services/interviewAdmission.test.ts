import { describe, expect, it, vi } from 'vitest'
import type { RealtimeChannelLike, RealtimeClientLike } from './bookingRealtime.ts'
import { parseAdmissionStatus, watchInterviewAdmission } from './interviewAdmission.ts'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

function fakeClient() {
  let handler: (payload: { new?: unknown }) => void = () => {}
  let onStatus: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR') => void = () => {}
  const filters: unknown[] = []
  const channel: RealtimeChannelLike = {
    on(_type, filter, callback) {
      filters.push(filter)
      handler = callback
      return channel
    },
    subscribe(callback) {
      onStatus = callback
      return channel
    },
  }
  const client: RealtimeClientLike & { removed: number } = {
    removed: 0,
    channel: () => channel,
    removeChannel() {
      client.removed += 1
    },
  }
  return {
    client,
    filters,
    push: (row: unknown) => handler({ new: row }),
    setStatus: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR') => onStatus(status),
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('watchInterviewAdmission', () => {
  it('loads the current status once live and streams changes for this session only', async () => {
    const fake = fakeClient()
    const load = vi.fn(async () => 'waiting' as const)
    const onStatus = vi.fn()
    const watch = watchInterviewAdmission(SESSION_ID, onStatus, { client: fake.client, load })

    expect(fake.filters[0]).toMatchObject({ table: 'interview_admissions', filter: `session_id=eq.${SESSION_ID}` })
    expect(load).not.toHaveBeenCalled()
    fake.setStatus('SUBSCRIBED')
    await flush()
    expect(onStatus).toHaveBeenLastCalledWith('waiting')

    fake.push({ session_id: SESSION_ID, status: 'admitted' })
    fake.push({ session_id: 'other', status: 'denied' })
    fake.push({ session_id: SESSION_ID, status: 'bogus' })
    expect(onStatus.mock.calls).toEqual([['waiting'], ['admitted']])

    watch.unsubscribe()
    watch.unsubscribe()
    fake.push({ session_id: SESSION_ID, status: 'denied' })
    expect(onStatus).toHaveBeenCalledTimes(2)
    expect(fake.client.removed).toBe(1)
  })

  it('ignores a missing row and failed loads', async () => {
    const fake = fakeClient()
    const onStatus = vi.fn()
    watchInterviewAdmission(SESSION_ID, onStatus, { client: fake.client, load: async () => null })
    fake.setStatus('SUBSCRIBED')
    await flush()
    const failing = fakeClient()
    watchInterviewAdmission(SESSION_ID, onStatus, {
      client: failing.client,
      load: async () => {
        throw new Error('offline')
      },
    })
    failing.setStatus('SUBSCRIBED')
    await flush()
    expect(onStatus).not.toHaveBeenCalled()
  })
})

describe('parseAdmissionStatus', () => {
  it('accepts only known statuses', () => {
    expect(parseAdmissionStatus('admitted')).toBe('admitted')
    expect(parseAdmissionStatus('ADMITTED')).toBeNull()
    expect(parseAdmissionStatus(null)).toBeNull()
  })
})
