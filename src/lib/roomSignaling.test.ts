import { describe, expect, it } from 'vitest'
import {
  ROOM_SIGNAL_TOPIC,
  SCREEN_SHARE_MESSAGES,
  encodeHandSignal,
  isRoomSignalTopic,
  parseHandSignal,
  screenShareFailure,
} from './roomSignaling.ts'

const bytes = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))

function namedError(name: string, message = '') {
  return Object.assign(new Error(message), { name })
}

describe('hand signal', () => {
  it('uses the same topic and JSON payload as the Candidate app', () => {
    expect(ROOM_SIGNAL_TOPIC).toBe('roundone-room')
    expect(JSON.parse(new TextDecoder().decode(encodeHandSignal(true)))).toEqual({ v: 1, type: 'hand', raised: true })
    expect(new TextDecoder().decode(encodeHandSignal(false))).toBe('{"v":1,"type":"hand","raised":false}')
  })

  it('round trips raised and lowered', () => {
    expect(parseHandSignal(encodeHandSignal(true))).toBe(true)
    expect(parseHandSignal(encodeHandSignal(false))).toBe(false)
    expect(parseHandSignal(bytes({ v: 1, type: 'hand', raised: true }))).toBe(true)
  })

  it('rejects any other shape', () => {
    for (const payload of [
      undefined,
      new Uint8Array(),
      bytes('not json'),
      bytes('null'),
      bytes([]),
      bytes({ v: 2, type: 'hand', raised: true }),
      bytes({ v: 1, type: 'chat', raised: true }),
      bytes({ v: 1, type: 'hand', raised: 'yes' }),
      bytes({ v: 1, type: 'hand' }),
    ]) {
      expect(parseHandSignal(payload)).toBeNull()
    }
  })

  it('accepts the room topic or no topic, like the Candidate receiver', () => {
    expect(isRoomSignalTopic(ROOM_SIGNAL_TOPIC)).toBe(true)
    expect(isRoomSignalTopic(undefined)).toBe(true)
    expect(isRoomSignalTopic(null)).toBe(true)
    expect(isRoomSignalTopic('')).toBe(true)
    expect(isRoomSignalTopic('chat')).toBe(false)
  })
})

describe('screenShareFailure', () => {
  it('stays silent when the picker is cancelled', () => {
    expect(screenShareFailure(namedError('NotAllowedError', 'Permission denied'))).toBeNull()
    expect(screenShareFailure(new DOMException('Permission denied', 'NotAllowedError'))).toBeNull()
    expect(screenShareFailure(namedError('AbortError'))).toBeNull()
  })

  it('explains system-level blocks, missing sources, busy capture and unsupported browsers', () => {
    expect(screenShareFailure(namedError('NotAllowedError', 'Permission denied by system'))).toBe(
      SCREEN_SHARE_MESSAGES.blockedBySystem,
    )
    expect(screenShareFailure(namedError('NotFoundError'))).toBe(SCREEN_SHARE_MESSAGES.nothingToShare)
    expect(screenShareFailure(namedError('NotReadableError'))).toBe(SCREEN_SHARE_MESSAGES.unreadable)
    expect(screenShareFailure(namedError('DeviceUnsupportedError'))).toBe(SCREEN_SHARE_MESSAGES.unsupported)
    expect(screenShareFailure(namedError('NotSupportedError'))).toBe(SCREEN_SHARE_MESSAGES.unsupported)
    expect(screenShareFailure(new Error('boom'))).toBe(SCREEN_SHARE_MESSAGES.failed)
    expect(screenShareFailure('boom')).toBe(SCREEN_SHARE_MESSAGES.failed)
  })
})
