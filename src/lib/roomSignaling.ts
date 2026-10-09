/**
 * In-room signals shared with the Candidate app over LiveKit data messages.
 * The topic and payload shape must stay identical in both repositories.
 */
export const ROOM_SIGNAL_TOPIC = 'roundone-room'

export type HandSignal = {
  v: 1
  type: 'hand'
  raised: boolean
}

export function encodeHandSignal(raised: boolean) {
  const payload: HandSignal = { v: 1, type: 'hand', raised }
  return new TextEncoder().encode(JSON.stringify(payload))
}

export function parseHandSignal(data: Uint8Array | undefined): boolean | null {
  if (!data || data.length === 0) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data)) as Partial<HandSignal>
    if (parsed.v !== 1 || parsed.type !== 'hand' || typeof parsed.raised !== 'boolean') return null
    return parsed.raised
  } catch {
    return null
  }
}

/** Signals without a topic are accepted, matching the Candidate app's receiver. */
export function isRoomSignalTopic(topic: unknown) {
  return topic === undefined || topic === null || topic === '' || topic === ROOM_SIGNAL_TOPIC
}

export const SCREEN_SHARE_MESSAGES = {
  unsupported: 'Screen sharing is not supported in this browser.',
  blockedBySystem:
    'Your computer blocked screen sharing. Allow screen recording for this browser in system settings, then try again.',
  nothingToShare: 'No screen, window, or tab is available to share.',
  unreadable: 'Your screen could not be captured. Close other apps that are capturing the screen and try again.',
  failed: 'Could not start screen sharing. Try again.',
  stopFailed: 'Could not stop screen sharing. Try again.',
} as const

/** Returns null when the user cancelled the browser picker, so no error is shown. */
export function screenShareFailure(error: unknown): string | null {
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  const message = error instanceof Error || error instanceof DOMException ? error.message : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return /system/i.test(message) ? SCREEN_SHARE_MESSAGES.blockedBySystem : null
  }
  if (name === 'AbortError') return null
  if (name === 'NotFoundError') return SCREEN_SHARE_MESSAGES.nothingToShare
  if (name === 'NotReadableError') return SCREEN_SHARE_MESSAGES.unreadable
  if (name === 'DeviceUnsupportedError' || name === 'NotSupportedError' || name === 'TypeError') {
    return SCREEN_SHARE_MESSAGES.unsupported
  }
  return SCREEN_SHARE_MESSAGES.failed
}
