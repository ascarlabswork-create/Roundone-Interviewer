import { describe, expect, it, vi } from 'vitest'
import { callError, type InterviewCallToken } from './interviewCall.ts'
import {
  InterviewCallController,
  pickCandidateParticipant,
  type CallLocalParticipant,
  type CallParticipant,
  type CallPublication,
  type CallRoom,
  type CallTrack,
} from './interviewCallController.ts'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

const SELF = 'interviewer:33333333-3333-4333-8333-333333333333'
const CANDIDATE = 'candidate:44444444-4444-4444-8444-444444444444'

const token: InterviewCallToken = {
  token: 'jwt',
  url: 'wss://example.livekit.cloud',
  room: `roundone-interview-${SESSION_ID}`,
  identity: SELF,
}

function fakeTrack(label: string): CallTrack & { label: string } {
  return { label, attach: (element) => element, detach: (element) => element }
}

type Source = 'camera' | 'microphone'

class FakeParticipant implements CallParticipant {
  readonly identity: string
  name?: string
  publications = new Map<Source, CallPublication>()

  constructor(identity: string, name?: string) {
    this.identity = identity
    this.name = name
  }

  getTrackPublication(source: Source) {
    return this.publications.get(source)
  }
}

class FakeLocalParticipant extends FakeParticipant implements CallLocalParticipant {
  mediaError: Error | null = null

  get isMicrophoneEnabled() {
    const pub = this.publications.get('microphone')
    return Boolean(pub && !pub.isMuted)
  }

  get isCameraEnabled() {
    const pub = this.publications.get('camera')
    return Boolean(pub && !pub.isMuted)
  }

  async setMicrophoneEnabled(enabled: boolean) {
    if (enabled && this.mediaError) throw this.mediaError
    this.publications.set('microphone', { isMuted: !enabled, track: fakeTrack('local-mic') })
  }

  async setCameraEnabled(enabled: boolean) {
    if (enabled && this.mediaError) throw this.mediaError
    this.publications.set('camera', { isMuted: !enabled, track: fakeTrack('local-camera') })
  }
}

class FakeRoom implements CallRoom {
  localParticipant = new FakeLocalParticipant(SELF, 'Interviewer')
  remoteParticipants = new Map<string, CallParticipant>()
  canPlaybackAudio = true
  listeners = new Map<string, Set<(arg?: unknown) => void>>()
  connectArgs: [string, string] | null = null
  connectError: Error | null = null
  disconnects = 0

  on(event: string, listener: (arg?: unknown) => void) {
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener)
    this.listeners.set(event, set)
    return this
  }

  removeAllListeners() {
    this.listeners.clear()
    return this
  }

  emit(event: string, arg?: unknown) {
    for (const listener of this.listeners.get(event) ?? []) listener(arg)
  }

  listenerCount() {
    let count = 0
    for (const set of this.listeners.values()) count += set.size
    return count
  }

  async connect(url: string, jwt: string) {
    if (this.connectError) throw this.connectError
    this.connectArgs = [url, jwt]
  }

  async disconnect() {
    this.disconnects += 1
  }

  async startAudio() {
    this.canPlaybackAudio = true
  }
}

function setup(overrides: Partial<{ fetchToken: (id: string) => Promise<InterviewCallToken> }> = {}) {
  const room = new FakeRoom()
  const createRoom = vi.fn(() => room)
  const onJoined = vi.fn()
  const onLeft = vi.fn()
  const fetchToken = vi.fn(overrides.fetchToken ?? (async () => token))
  const controller = new InterviewCallController({ sessionId: SESSION_ID, fetchToken, createRoom, onJoined, onLeft })
  return { room, createRoom, onJoined, onLeft, fetchToken, controller }
}

function addCandidate(room: FakeRoom) {
  const candidate = new FakeParticipant(CANDIDATE, 'Grace')
  room.remoteParticipants.set(candidate.identity, candidate)
  room.emit('participantConnected', candidate)
  return candidate
}

describe('InterviewCallController', () => {
  it('joins the shared session room with the edge-function token and publishes mic and camera', async () => {
    const { room, controller, fetchToken, onJoined, onLeft } = setup()
    await controller.join()

    expect(fetchToken).toHaveBeenCalledWith(SESSION_ID)
    expect(room.connectArgs).toEqual([token.url, token.token])
    const snapshot = controller.getSnapshot()
    expect(snapshot.phase).toBe('connected')
    expect(snapshot.micEnabled).toBe(true)
    expect(snapshot.cameraEnabled).toBe(true)
    expect(snapshot.localVideoTrack).not.toBeNull()
    expect(snapshot.candidate.presence).toBe('waiting')
    expect(onJoined).toHaveBeenCalledTimes(1)
    expect(onLeft).not.toHaveBeenCalled()
  })

  it('shows the candidate when they join and renders their audio and video tracks', async () => {
    const { room, controller } = setup()
    await controller.join()

    const candidate = addCandidate(room)
    expect(controller.getSnapshot().candidate).toMatchObject({ presence: 'joined', name: 'Grace', videoTrack: null })

    const video = fakeTrack('candidate-camera')
    const audio = fakeTrack('candidate-mic')
    candidate.publications.set('camera', { isMuted: false, track: video })
    candidate.publications.set('microphone', { isMuted: false, track: audio })
    room.emit('trackSubscribed')
    expect(controller.getSnapshot().candidate).toMatchObject({
      videoTrack: video,
      audioTrack: audio,
      micMuted: false,
      cameraOff: false,
    })

    candidate.publications.set('camera', { isMuted: true, track: video })
    room.emit('trackMuted')
    expect(controller.getSnapshot().candidate).toMatchObject({ videoTrack: null, cameraOff: true })

    room.remoteParticipants.delete(candidate.identity)
    room.emit('participantDisconnected', candidate)
    expect(controller.getSnapshot().candidate.presence).toBe('left')
  })

  it('toggles the microphone and camera', async () => {
    const { controller } = setup()
    await controller.join()

    await controller.toggleMic()
    expect(controller.getSnapshot().micEnabled).toBe(false)
    await controller.toggleMic()
    expect(controller.getSnapshot().micEnabled).toBe(true)

    await controller.toggleCamera()
    expect(controller.getSnapshot()).toMatchObject({ cameraEnabled: false, localVideoTrack: null })
    await controller.toggleCamera()
    expect(controller.getSnapshot().cameraEnabled).toBe(true)
  })

  it('stays connected and reports permission denied when media is blocked', async () => {
    const { room, controller } = setup()
    room.localParticipant.mediaError = Object.assign(new Error('blocked'), { name: 'NotAllowedError' })
    await controller.join()

    const snapshot = controller.getSnapshot()
    expect(snapshot.phase).toBe('connected')
    expect(snapshot.mediaError?.kind).toBe('permission_denied')
    expect(snapshot.micEnabled).toBe(false)

    room.localParticipant.mediaError = null
    await controller.retryMedia()
    expect(controller.getSnapshot()).toMatchObject({ mediaError: null, micEnabled: true, cameraEnabled: true })
  })

  it('never creates a room when the token is refused', async () => {
    for (const kind of ['not_authorized', 'not_joinable'] as const) {
      const { controller, createRoom } = setup({
        fetchToken: async () => {
          throw callError(kind)
        },
      })
      await controller.join()
      expect(createRoom).not.toHaveBeenCalled()
      expect(controller.getSnapshot()).toMatchObject({ phase: 'error', error: { kind } })
    }
  })

  it('refuses a token for a different room', async () => {
    const { controller, createRoom } = setup({ fetchToken: async () => ({ ...token, room: SESSION_ID }) })
    await controller.join()
    expect(createRoom).not.toHaveBeenCalled()
    expect(controller.getSnapshot().error?.kind).toBe('not_found')
  })

  it('surfaces connection errors, releases the room and can retry', async () => {
    const { room, controller, onJoined, onLeft } = setup()
    room.connectError = new Error('ws failed')
    await controller.join()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'error', error: { kind: 'connection' } })
    expect(room.listenerCount()).toBe(0)
    expect(onJoined).not.toHaveBeenCalled()
    expect(onLeft).not.toHaveBeenCalled()

    room.connectError = null
    await controller.retry()
    expect(controller.getSnapshot().phase).toBe('connected')
  })

  it('leaving disconnects, removes every listener and records the leave once', async () => {
    const { room, controller, onLeft } = setup()
    await controller.join()
    addCandidate(room)
    expect(room.listenerCount()).toBeGreaterThan(0)

    controller.leave()
    expect(room.disconnects).toBe(1)
    expect(room.listenerCount()).toBe(0)
    expect(onLeft).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'left',
      localVideoTrack: null,
      candidate: { presence: 'waiting', videoTrack: null, audioTrack: null },
    })

    controller.leave()
    controller.dispose()
    expect(room.disconnects).toBe(1)
    expect(onLeft).toHaveBeenCalledTimes(1)
  })

  it('disposing on unmount disconnects and records the leave', async () => {
    const { room, controller, onLeft } = setup()
    await controller.join()
    controller.dispose()
    expect(room.disconnects).toBe(1)
    expect(room.listenerCount()).toBe(0)
    expect(onLeft).toHaveBeenCalledTimes(1)
  })

  it('dispose during token fetch never connects', async () => {
    let release: (value: InterviewCallToken) => void = () => {}
    const { controller, createRoom } = setup({
      fetchToken: () =>
        new Promise((resolve) => {
          release = resolve
        }),
    })
    const joining = controller.join()
    controller.dispose()
    release(token)
    await joining
    expect(createRoom).not.toHaveBeenCalled()
  })

  it('handles an unexpected disconnect', async () => {
    const { room, controller } = setup()
    await controller.join()
    room.emit('disconnected')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'disconnected', error: { kind: 'connection' } })
    expect(room.disconnects).toBe(1)
    expect(room.listenerCount()).toBe(0)
  })

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { controller } = setup()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    await controller.join()
    expect(listener).toHaveBeenCalled()
    const calls = listener.mock.calls.length
    unsubscribe()
    await controller.toggleMic()
    expect(listener.mock.calls.length).toBe(calls)
  })
})

describe('pickCandidateParticipant', () => {
  it('picks the candidate identity and ignores everyone else', () => {
    const self = new FakeParticipant(SELF, 'Me')
    const unknown = new FakeParticipant('x', 'X')
    const candidate = new FakeParticipant(CANDIDATE, 'C')
    expect(pickCandidateParticipant([self, unknown, candidate], SELF)).toBe(candidate)
    expect(pickCandidateParticipant([self, unknown], SELF)).toBeNull()
  })
})
