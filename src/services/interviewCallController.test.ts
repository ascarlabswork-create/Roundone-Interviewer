import { describe, expect, it, vi } from 'vitest'
import { ROOM_SIGNAL_TOPIC, SCREEN_SHARE_MESSAGES, encodeHandSignal } from '../lib/roomSignaling.ts'
import { callError, type InterviewCallToken } from './interviewCall.ts'
import {
  InterviewCallController,
  pickCandidateParticipant,
  type CallLocalParticipant,
  type CallParticipant,
  type CallPublication,
  type CallRoom,
  type CallSource,
  type CallTrack,
  type LocalMedia,
  type LocalMediaTrack,
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

class FakeLocalTrack implements LocalMediaTrack {
  readonly label: string
  isMuted = false
  stopped = false

  constructor(label: string) {
    this.label = label
  }

  attach(element: HTMLMediaElement) {
    return element
  }

  detach(element: HTMLMediaElement) {
    return element
  }

  async mute() {
    this.isMuted = true
  }

  async unmute() {
    this.isMuted = false
  }

  stop() {
    this.stopped = true
  }
}

type FakePublication = CallPublication & { isSubscribed: boolean }

class FakeParticipant implements CallParticipant {
  readonly identity: string
  readonly sid: string
  name?: string
  publications = new Map<CallSource, FakePublication>()

  constructor(identity: string, name?: string, sid = 'PA_1') {
    this.identity = identity
    this.name = name
    this.sid = sid
  }

  getTrackPublication(source: CallSource) {
    return this.publications.get(source)
  }

  getTrackPublications() {
    return [...this.publications.values()]
  }

  /** Mirrors LiveKit: a remote track only exists once it is subscribed. */
  publish(source: CallSource, track: CallTrack, isMuted = false) {
    const publication: FakePublication = {
      isMuted,
      isSubscribed: false,
      get track() {
        return this.isSubscribed ? track : undefined
      },
      setSubscribed(subscribed: boolean) {
        this.isSubscribed = subscribed
      },
    }
    this.publications.set(source, publication)
    return publication
  }
}

class FakeLocalParticipant implements CallLocalParticipant {
  readonly identity = SELF
  published = new Set<LocalMediaTrack>()
  publishError: Error | null = null
  screen: CallPublication | undefined
  screenShareCalls: Array<[boolean, { audio: boolean } | undefined]> = []
  screenShareError: Error | null = null
  /** Lets a test hold the browser picker open. */
  screenShareGate: Promise<void> | null = null
  onScreenShareChange: () => void = () => {}

  async publishTrack(track: LocalMediaTrack) {
    if (this.publishError) throw this.publishError
    this.published.add(track)
  }

  async unpublishTrack(track: LocalMediaTrack) {
    this.published.delete(track)
  }

  getTrackPublication(source: CallSource) {
    return source === 'screen_share' ? this.screen : undefined
  }

  async setScreenShareEnabled(enabled: boolean, options?: { audio: boolean }) {
    this.screenShareCalls.push([enabled, options])
    if (this.screenShareGate) await this.screenShareGate
    if (this.screenShareError) throw this.screenShareError
    this.screen = enabled ? { isMuted: false, track: fakeTrack('local-screen') } : undefined
    this.onScreenShareChange()
  }
}

type Listener = (...args: unknown[]) => void

class FakeRoom implements CallRoom {
  localParticipant = new FakeLocalParticipant()
  remoteParticipants = new Map<string, CallParticipant>()
  canPlaybackAudio = true
  listeners = new Map<string, Set<Listener>>()
  connectArgs: [string, string, { autoSubscribe: boolean } | undefined] | null = null
  connectError: Error | null = null
  disconnects = 0

  constructor() {
    this.localParticipant.onScreenShareChange = () =>
      this.emit(this.localParticipant.screen ? 'localTrackPublished' : 'localTrackUnpublished')
  }

  on(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener)
    this.listeners.set(event, set)
    return this
  }

  removeAllListeners() {
    this.listeners.clear()
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }

  listenerCount() {
    let count = 0
    for (const set of this.listeners.values()) count += set.size
    return count
  }

  async connect(url: string, jwt: string, options?: { autoSubscribe: boolean }) {
    if (this.connectError) throw this.connectError
    this.connectArgs = [url, jwt, options]
  }

  async disconnect() {
    this.disconnects += 1
  }

  async startAudio() {
    this.canPlaybackAudio = true
  }
}

type SetupOptions = {
  fetchToken: (id: string) => Promise<InterviewCallToken>
  mediaError: unknown
  canShareScreen: boolean
}

function setup(overrides: Partial<SetupOptions> = {}) {
  const room = new FakeRoom()
  const createRoom = vi.fn(() => room)
  const onJoined = vi.fn()
  const onLeft = vi.fn()
  const onAdmissionRequested = vi.fn()
  const onCandidateHandRaised = vi.fn()
  const fetchToken = vi.fn(overrides.fetchToken ?? (async () => token))
  const media = { error: overrides.mediaError ?? null, created: [] as FakeLocalTrack[] }
  const createLocalMedia = vi.fn(async (want: { audio: boolean; video: boolean }): Promise<LocalMedia> => {
    if (media.error) return { audio: null, video: null, error: media.error }
    const audio = want.audio ? new FakeLocalTrack('local-mic') : null
    const video = want.video ? new FakeLocalTrack('local-camera') : null
    for (const track of [audio, video]) if (track) media.created.push(track)
    return { audio, video, error: null }
  })
  const controller = new InterviewCallController({
    sessionId: SESSION_ID,
    fetchToken,
    createRoom,
    createLocalMedia,
    onJoined,
    onLeft,
    onAdmissionRequested,
    canShareScreen: () => overrides.canShareScreen ?? true,
    onCandidateHandRaised,
  })
  return {
    room,
    createRoom,
    onJoined,
    onLeft,
    onAdmissionRequested,
    onCandidateHandRaised,
    fetchToken,
    createLocalMedia,
    media,
    controller,
  }
}

function addCandidate(room: FakeRoom, sid = 'PA_1') {
  const candidate = new FakeParticipant(CANDIDATE, 'Grace', sid)
  room.remoteParticipants.set(candidate.identity, candidate)
  room.emit('participantConnected', candidate)
  return candidate
}

function removeCandidate(room: FakeRoom, candidate: FakeParticipant) {
  room.remoteParticipants.delete(candidate.identity)
  room.emit('participantDisconnected', candidate)
}

/** LiveKit `dataReceived` arguments: payload, participant, kind, topic. */
function sendHand(room: FakeRoom, from: CallParticipant | undefined, raised: boolean, topic: string | undefined = ROOM_SIGNAL_TOPIC) {
  room.emit('dataReceived', encodeHandSignal(raised), from, 0, topic)
}

function namedError(name: string, message = '') {
  return Object.assign(new Error(message), { name })
}

describe('InterviewCallController lobby', () => {
  it('joins subscribed and publishes immediately for a 1-to-1 interview', async () => {
    const { room, controller, fetchToken, onJoined, onLeft } = setup()
    await controller.join()

    expect(fetchToken).toHaveBeenCalledWith(SESSION_ID)
    expect(room.connectArgs).toEqual([token.url, token.token, { autoSubscribe: true }])
    expect(room.localParticipant.published.size).toBe(2)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'connected',
      admission: 'admitted',
      live: true,
      micEnabled: true,
      cameraEnabled: true,
      candidate: { presence: 'waiting' },
    })
    expect(controller.getSnapshot().localVideoTrack).not.toBeNull()
    expect(onJoined).toHaveBeenCalledTimes(1)
    expect(onLeft).not.toHaveBeenCalled()
  })

  it('lets the candidate in without an interviewer admit step', async () => {
    const { room, controller, onAdmissionRequested } = setup()
    await controller.join()

    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))
    const mic = candidate.publish('microphone', fakeTrack('candidate-mic'))
    room.emit('trackPublished')

    expect(onAdmissionRequested).not.toHaveBeenCalled()
    expect(camera.isSubscribed).toBe(true)
    expect(mic.isSubscribed).toBe(true)
    expect(room.localParticipant.published.size).toBe(2)
    expect(controller.getSnapshot()).toMatchObject({
      admission: 'admitted',
      candidate: { presence: 'joined', name: 'Grace' },
    })
    expect(controller.getSnapshot().candidate.videoTrack).not.toBeNull()
    expect(controller.getSnapshot().candidate.audioTrack).not.toBeNull()
  })

  it('publishes the microphone when it opens after the candidate was already admitted', async () => {
    let releaseMedia: () => void = () => {}
    const mediaReady = new Promise<void>((resolve) => {
      releaseMedia = resolve
    })
    const room = new FakeRoom()
    const controller = new InterviewCallController({
      sessionId: SESSION_ID,
      fetchToken: async () => token,
      createRoom: () => room,
      createLocalMedia: async () => {
        await mediaReady
        return { audio: new FakeLocalTrack('local-mic'), video: new FakeLocalTrack('local-camera'), error: null }
      },
    })
    const joining = controller.join()
    await vi.waitFor(() => expect(room.connectArgs).not.toBeNull())
    await controller.admit()
    expect(room.localParticipant.published.size).toBe(0)
    releaseMedia()
    await joining
    expect(room.localParticipant.published.size).toBe(2)
    expect(controller.getSnapshot()).toMatchObject({ admission: 'admitted', live: true, micEnabled: true })
  })

  it('does not publish while connecting even if the interviewer already admitted', async () => {
    const { room, controller } = setup()
    let releaseConnect = () => {}
    const held = new Promise<void>((resolve) => {
      releaseConnect = resolve
    })
    const connect = room.connect.bind(room)
    room.connect = async (url, jwt, options) => {
      room.connectArgs = [url, jwt, options]
      await held
      await connect(url, jwt, options)
    }

    const joining = controller.join()
    await vi.waitFor(() => expect(room.connectArgs).not.toBeNull())
    await controller.admit()
    expect(room.localParticipant.published.size).toBe(0)

    releaseConnect()
    await joining
    expect(room.localParticipant.published.size).toBe(2)
    expect(controller.getSnapshot()).toMatchObject({ admission: 'admitted', live: true, micEnabled: true })
  })

  it('admitting publishes local media and subscribes to the candidate both ways', async () => {
    const { room, controller } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))
    room.emit('trackPublished')

    await controller.admit()
    expect(room.localParticipant.published.size).toBe(2)
    expect(camera.isSubscribed).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ admission: 'admitted', live: true })
    expect(controller.getSnapshot().candidate.videoTrack).not.toBeNull()

    const mic = candidate.publish('microphone', fakeTrack('candidate-mic'))
    room.emit('trackPublished')
    expect(mic.isSubscribed).toBe(true)
    expect(controller.getSnapshot().candidate).toMatchObject({ micMuted: false })
    expect(controller.getSnapshot().candidate.audioTrack).not.toBeNull()
  })

  it('declining keeps everything private until the interviewer admits', async () => {
    const { room, controller, onAdmissionRequested } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))

    await controller.deny()
    expect(controller.getSnapshot().admission).toBe('denied')
    expect(camera.isSubscribed).toBe(false)
    expect(room.localParticipant.published.size).toBe(0)
    expect(onAdmissionRequested).not.toHaveBeenCalled()
  })

  it('removing an admitted candidate unpublishes and unsubscribes', async () => {
    const { room, controller } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))
    await controller.admit()

    await controller.deny()
    expect(room.localParticipant.published.size).toBe(0)
    expect(camera.isSubscribed).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ live: false, candidate: { videoTrack: null } })
  })

  it('applies a stored admission so an admitted candidate reconnects without asking again', async () => {
    const { room, controller, onAdmissionRequested } = setup()
    await controller.join()
    await controller.applyServerAdmission('admitted')
    expect(room.localParticipant.published.size).toBe(2)

    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))
    room.emit('trackPublished')
    expect(onAdmissionRequested).not.toHaveBeenCalled()
    expect(camera.isSubscribed).toBe(true)
  })

  it('treats a stored waiting knock as already admitted for a 1-to-1 interview', async () => {
    const { controller, onAdmissionRequested } = setup()
    await controller.join()
    await controller.applyServerAdmission('waiting')
    expect(controller.getSnapshot().admission).toBe('admitted')
    expect(onAdmissionRequested).not.toHaveBeenCalled()
  })

  it('republishes after a reconnect once the candidate was admitted', async () => {
    const { room, controller } = setup()
    await controller.join()
    await controller.admit()
    room.emit('disconnected')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'disconnected', live: false })

    room.localParticipant.published.clear()
    await controller.retry()
    expect(room.localParticipant.published.size).toBe(2)
    expect(controller.getSnapshot()).toMatchObject({ phase: 'connected', admission: 'admitted', live: true })
  })
})

describe('InterviewCallController media and lifecycle', () => {
  it('toggles the microphone and camera through the local tracks, before and after admission', async () => {
    const { controller } = setup()
    await controller.join()

    await controller.toggleMic()
    expect(controller.getSnapshot().micEnabled).toBe(false)
    await controller.toggleMic()
    expect(controller.getSnapshot().micEnabled).toBe(true)

    await controller.admit()
    await controller.toggleCamera()
    expect(controller.getSnapshot()).toMatchObject({ cameraEnabled: false, localVideoTrack: null })
    await controller.toggleCamera()
    expect(controller.getSnapshot().cameraEnabled).toBe(true)
  })

  it('removes the camera from the room while it is off so the candidate never sees a frozen frame', async () => {
    const { room, controller, media } = setup()
    await controller.join()
    const camera = media.created.find((track) => track.label === 'local-camera')!
    const mic = media.created.find((track) => track.label === 'local-mic')!

    await controller.toggleCamera()
    expect(camera.isMuted).toBe(true)
    expect(room.localParticipant.published.has(camera)).toBe(false)
    expect(room.localParticipant.published.has(mic)).toBe(true)

    await controller.retryMedia()
    expect(room.localParticipant.published.has(camera)).toBe(false)

    await controller.toggleCamera()
    expect(camera.isMuted).toBe(false)
    expect(room.localParticipant.published.has(camera)).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ cameraEnabled: true, live: true })
  })

  it('stays connected and reports permission denied when media is blocked, then recovers', async () => {
    const { room, controller, media } = setup({
      mediaError: Object.assign(new Error('blocked'), { name: 'NotAllowedError' }),
    })
    await controller.join()
    await controller.admit()

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'connected',
      micEnabled: false,
      mediaError: { kind: 'permission_denied' },
    })

    media.error = null
    await controller.retryMedia()
    expect(controller.getSnapshot()).toMatchObject({ mediaError: null, micEnabled: true, cameraEnabled: true })
    expect(room.localParticipant.published.size).toBe(2)
  })

  it('reports a publish failure without dropping the call', async () => {
    const { room, controller } = setup()
    room.localParticipant.publishError = Object.assign(new Error('busy'), { name: 'NotReadableError' })
    await controller.join()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'connected', mediaError: { kind: 'device_in_use' } })
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

  it('leaving disconnects, releases the camera and mic and records the leave once', async () => {
    const { room, controller, onLeft, media } = setup()
    await controller.join()
    addCandidate(room)
    expect(room.listenerCount()).toBeGreaterThan(0)

    controller.leave()
    expect(room.disconnects).toBe(1)
    expect(room.listenerCount()).toBe(0)
    expect(onLeft).toHaveBeenCalledTimes(1)
    expect(media.created.every((track) => track.stopped)).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'left',
      localVideoTrack: null,
      micEnabled: false,
      candidate: { presence: 'waiting', videoTrack: null, audioTrack: null },
    })

    controller.leave()
    controller.dispose()
    expect(room.disconnects).toBe(1)
    expect(onLeft).toHaveBeenCalledTimes(1)
  })

  it('rejoining after leaving opens fresh camera and mic tracks', async () => {
    const { controller, createLocalMedia } = setup()
    await controller.join()
    controller.leave()
    await controller.retry()
    expect(createLocalMedia).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ phase: 'connected', cameraEnabled: true })
  })

  it('disposing on unmount disconnects, stops local tracks and records the leave', async () => {
    const { room, controller, onLeft, media } = setup()
    await controller.join()
    controller.dispose()
    expect(room.disconnects).toBe(1)
    expect(room.listenerCount()).toBe(0)
    expect(onLeft).toHaveBeenCalledTimes(1)
    expect(media.created.every((track) => track.stopped)).toBe(true)
  })

  it('dispose during token fetch never connects and stops any preview tracks', async () => {
    let release: (value: InterviewCallToken) => void = () => {}
    const { controller, createRoom, media } = setup({
      fetchToken: () =>
        new Promise((resolve) => {
          release = resolve
        }),
    })
    const joining = controller.join()
    await Promise.resolve()
    controller.dispose()
    release(token)
    await joining
    expect(createRoom).not.toHaveBeenCalled()
    expect(media.created.every((track) => track.stopped)).toBe(true)
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

describe('InterviewCallController candidate raised hand', () => {
  it('shows the candidate raising and lowering their hand and notifies once per raise', async () => {
    const { room, controller, onCandidateHandRaised } = setup()
    await controller.join()
    const candidate = addCandidate(room)

    sendHand(room, candidate, true)
    expect(controller.getSnapshot().candidate.handRaised).toBe(true)
    expect(onCandidateHandRaised).toHaveBeenCalledTimes(1)

    sendHand(room, candidate, true)
    expect(onCandidateHandRaised).toHaveBeenCalledTimes(1)

    sendHand(room, candidate, false)
    expect(controller.getSnapshot().candidate.handRaised).toBe(false)

    sendHand(room, candidate, true)
    expect(onCandidateHandRaised).toHaveBeenCalledTimes(2)
  })

  it('never changes the call, microphone or camera when a hand is raised', async () => {
    const { room, controller } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const mic = candidate.publish('microphone', fakeTrack('candidate-mic'))
    room.emit('trackPublished')

    sendHand(room, candidate, true)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'connected',
      admission: 'admitted',
      micEnabled: true,
      cameraEnabled: true,
      candidate: { micMuted: false, handRaised: true },
    })
    expect(mic.isSubscribed).toBe(true)
    expect(room.localParticipant.published.size).toBe(2)
  })

  it('accepts messages without a topic, like the Candidate app', async () => {
    const { room, controller } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    sendHand(room, candidate, true, undefined)
    expect(controller.getSnapshot().candidate.handRaised).toBe(true)
  })

  it('ignores other topics, malformed payloads, non-candidates and messages without a sender', async () => {
    const { room, controller, onCandidateHandRaised } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const other = new FakeParticipant('observer:1', 'Someone', 'PA_9')
    room.remoteParticipants.set(other.identity, other)

    sendHand(room, candidate, true, 'chat')
    room.emit('dataReceived', new TextEncoder().encode('{"v":1,"type":"hand"}'), candidate, 0, ROOM_SIGNAL_TOPIC)
    room.emit('dataReceived', new TextEncoder().encode('not json'), candidate, 0, ROOM_SIGNAL_TOPIC)
    room.emit('dataReceived', 'not bytes', candidate, 0, ROOM_SIGNAL_TOPIC)
    sendHand(room, other, true)
    sendHand(room, new FakeParticipant(SELF, 'Me'), true)
    sendHand(room, undefined, true)

    expect(controller.getSnapshot().candidate.handRaised).toBe(false)
    expect(onCandidateHandRaised).not.toHaveBeenCalled()
  })

  it('clears the hand when the candidate disconnects', async () => {
    const { room, controller } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    sendHand(room, candidate, true)

    removeCandidate(room, candidate)
    expect(controller.getSnapshot().candidate).toMatchObject({ presence: 'left', handRaised: false })

    addCandidate(room)
    expect(controller.getSnapshot().candidate).toMatchObject({ presence: 'joined', handRaised: false })
  })

  it('drops a stale hand when the candidate rejoins with a new participant sid', async () => {
    const { room, controller, onCandidateHandRaised } = setup()
    await controller.join()
    sendHand(room, addCandidate(room, 'PA_1'), true)
    expect(controller.getSnapshot().candidate.handRaised).toBe(true)

    const rejoined = addCandidate(room, 'PA_2')
    expect(controller.getSnapshot().candidate.handRaised).toBe(false)

    sendHand(room, rejoined, true)
    expect(controller.getSnapshot().candidate.handRaised).toBe(true)
    expect(onCandidateHandRaised).toHaveBeenCalledTimes(2)
  })

  it('clears the hand when we leave or the room disconnects', async () => {
    const { room, controller } = setup()
    await controller.join()
    sendHand(room, addCandidate(room), true)
    controller.leave()
    expect(controller.getSnapshot().candidate.handRaised).toBe(false)

    await controller.retry()
    sendHand(room, addCandidate(room), true)
    room.emit('disconnected')
    expect(controller.getSnapshot().candidate.handRaised).toBe(false)

    await controller.retry()
    addCandidate(room)
    expect(controller.getSnapshot().candidate.handRaised).toBe(false)
  })
})

describe('InterviewCallController screen share', () => {
  it('shares and stops the screen only when asked, without audio', async () => {
    const { room, controller } = setup()
    await controller.join()
    expect(room.localParticipant.screenShareCalls).toEqual([])
    expect(controller.getSnapshot()).toMatchObject({ screenShareSupported: true, localScreenTrack: null })

    await controller.toggleScreenShare()
    expect(room.localParticipant.screenShareCalls).toEqual([[true, { audio: false }]])
    expect(controller.getSnapshot().localScreenTrack).not.toBeNull()
    expect(controller.getSnapshot()).toMatchObject({ screenShareBusy: false, screenShareError: null })

    await controller.toggleScreenShare()
    expect(room.localParticipant.screenShareCalls.at(-1)).toEqual([false, { audio: false }])
    expect(controller.getSnapshot().localScreenTrack).toBeNull()
    expect(controller.getSnapshot()).toMatchObject({ micEnabled: true, cameraEnabled: true, live: true })
  })

  it('shows nothing when the picker is cancelled, even though LiveKit reports a device error', async () => {
    const { room, controller } = setup()
    await controller.join()
    let release = () => {}
    room.localParticipant.screenShareGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const cancelled = namedError('NotAllowedError', 'Permission denied')
    room.localParticipant.screenShareError = cancelled

    const sharing = controller.toggleScreenShare()
    room.emit('mediaDevicesError', cancelled, undefined)
    release()
    await sharing

    expect(controller.getSnapshot()).toMatchObject({
      screenShareBusy: false,
      screenShareError: null,
      localScreenTrack: null,
      mediaError: null,
    })
  })

  it('still reports microphone and camera device errors', async () => {
    const { room, controller } = setup()
    await controller.join()
    room.emit('mediaDevicesError', namedError('NotReadableError'), 'audioinput')
    expect(controller.getSnapshot().mediaError?.kind).toBe('device_in_use')
  })

  it('explains a system-level block and can be dismissed', async () => {
    const { room, controller } = setup()
    await controller.join()
    room.localParticipant.screenShareError = namedError('NotAllowedError', 'Permission denied by system')
    await controller.toggleScreenShare()
    expect(controller.getSnapshot()).toMatchObject({
      screenShareError: SCREEN_SHARE_MESSAGES.blockedBySystem,
      screenShareBusy: false,
      localScreenTrack: null,
    })

    controller.dismissScreenShareError()
    expect(controller.getSnapshot().screenShareError).toBeNull()
  })

  it('reports an unsupported browser without opening a picker', async () => {
    const { room, controller } = setup({ canShareScreen: false })
    await controller.join()
    expect(controller.getSnapshot().screenShareSupported).toBe(false)
    await controller.toggleScreenShare()
    expect(room.localParticipant.screenShareCalls).toEqual([])
    expect(controller.getSnapshot().screenShareError).toBe(SCREEN_SHARE_MESSAGES.unsupported)
  })

  it('ignores clicks while the picker is open and before connecting', async () => {
    const { room, controller } = setup()
    await controller.toggleScreenShare()
    expect(room.localParticipant.screenShareCalls).toEqual([])

    await controller.join()
    let release = () => {}
    room.localParticipant.screenShareGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = controller.toggleScreenShare()
    expect(controller.getSnapshot().screenShareBusy).toBe(true)
    await controller.toggleScreenShare()
    release()
    await first
    expect(room.localParticipant.screenShareCalls).toHaveLength(1)
    expect(controller.getSnapshot().screenShareBusy).toBe(false)
  })

  it('resyncs when the browser ends the capture', async () => {
    const { room, controller } = setup()
    await controller.join()
    await controller.toggleScreenShare()
    expect(controller.getSnapshot().localScreenTrack).not.toBeNull()

    room.localParticipant.screen = undefined
    room.emit('localTrackUnpublished')
    expect(controller.getSnapshot().localScreenTrack).toBeNull()

    await controller.toggleScreenShare()
    expect(room.localParticipant.screenShareCalls.at(-1)?.[0]).toBe(true)
  })

  it('stops sharing when we leave', async () => {
    const { room, controller } = setup()
    await controller.join()
    await controller.toggleScreenShare()
    controller.leave()
    expect(room.localParticipant.screenShareCalls.at(-1)?.[0]).toBe(false)
    expect(room.disconnects).toBe(1)
    expect(controller.getSnapshot()).toMatchObject({ phase: 'left', localScreenTrack: null, screenShareBusy: false })
  })

  it('shows the candidate screen and clears it when they stop or disconnect', async () => {
    const { room, controller } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const screen = candidate.publish('screen_share', fakeTrack('candidate-screen'))
    room.emit('trackPublished')
    expect(screen.isSubscribed).toBe(true)
    expect(controller.getSnapshot().candidate.screenTrack).toBe(screen.track)

    candidate.publications.delete('screen_share')
    room.emit('trackUnpublished')
    expect(controller.getSnapshot().candidate.screenTrack).toBeNull()

    candidate.publish('screen_share', fakeTrack('candidate-screen-2'))
    room.emit('trackPublished')
    expect(controller.getSnapshot().candidate.screenTrack).not.toBeNull()
    removeCandidate(room, candidate)
    expect(controller.getSnapshot().candidate.screenTrack).toBeNull()
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
