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

type Source = 'camera' | 'microphone'

type FakePublication = CallPublication & { isSubscribed: boolean }

class FakeParticipant implements CallParticipant {
  readonly identity: string
  name?: string
  publications = new Map<Source, FakePublication>()

  constructor(identity: string, name?: string) {
    this.identity = identity
    this.name = name
  }

  getTrackPublication(source: Source) {
    return this.publications.get(source)
  }

  getTrackPublications() {
    return [...this.publications.values()]
  }

  /** Mirrors LiveKit: a remote track only exists once it is subscribed. */
  publish(source: Source, track: CallTrack, isMuted = false) {
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

  async publishTrack(track: LocalMediaTrack) {
    if (this.publishError) throw this.publishError
    this.published.add(track)
  }

  async unpublishTrack(track: LocalMediaTrack) {
    this.published.delete(track)
  }
}

class FakeRoom implements CallRoom {
  localParticipant = new FakeLocalParticipant()
  remoteParticipants = new Map<string, CallParticipant>()
  canPlaybackAudio = true
  listeners = new Map<string, Set<(arg?: unknown) => void>>()
  connectArgs: [string, string, { autoSubscribe: boolean } | undefined] | null = null
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
}

function setup(overrides: Partial<SetupOptions> = {}) {
  const room = new FakeRoom()
  const createRoom = vi.fn(() => room)
  const onJoined = vi.fn()
  const onLeft = vi.fn()
  const onAdmissionRequested = vi.fn()
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
  })
  return { room, createRoom, onJoined, onLeft, onAdmissionRequested, fetchToken, createLocalMedia, media, controller }
}

function addCandidate(room: FakeRoom) {
  const candidate = new FakeParticipant(CANDIDATE, 'Grace')
  room.remoteParticipants.set(candidate.identity, candidate)
  room.emit('participantConnected', candidate)
  return candidate
}

describe('InterviewCallController lobby', () => {
  it('joins with manual subscription and previews the camera locally without publishing', async () => {
    const { room, controller, fetchToken, onJoined, onLeft } = setup()
    await controller.join()

    expect(fetchToken).toHaveBeenCalledWith(SESSION_ID)
    expect(room.connectArgs).toEqual([token.url, token.token, { autoSubscribe: false }])
    expect(room.localParticipant.published.size).toBe(0)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'connected',
      admission: 'none',
      live: false,
      micEnabled: true,
      cameraEnabled: true,
      candidate: { presence: 'waiting' },
    })
    expect(controller.getSnapshot().localVideoTrack).not.toBeNull()
    expect(onJoined).toHaveBeenCalledTimes(1)
    expect(onLeft).not.toHaveBeenCalled()
  })

  it('asks the interviewer to admit a candidate and keeps their media blocked until then', async () => {
    const { room, controller, onAdmissionRequested } = setup()
    await controller.join()

    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))
    const mic = candidate.publish('microphone', fakeTrack('candidate-mic'))
    room.emit('trackPublished')

    expect(onAdmissionRequested).toHaveBeenCalledTimes(1)
    expect(camera.isSubscribed).toBe(false)
    expect(mic.isSubscribed).toBe(false)
    expect(room.localParticipant.published.size).toBe(0)
    expect(controller.getSnapshot()).toMatchObject({
      admission: 'requested',
      candidate: { presence: 'joined', name: 'Grace', videoTrack: null, audioTrack: null },
    })
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

  it('declining keeps everything private and asks again when the candidate rejoins', async () => {
    const { room, controller, onAdmissionRequested } = setup()
    await controller.join()
    const candidate = addCandidate(room)
    const camera = candidate.publish('camera', fakeTrack('candidate-camera'))

    await controller.deny()
    expect(controller.getSnapshot().admission).toBe('denied')
    expect(camera.isSubscribed).toBe(false)
    expect(room.localParticipant.published.size).toBe(0)

    room.remoteParticipants.delete(candidate.identity)
    room.emit('participantDisconnected', candidate)
    addCandidate(room)
    expect(controller.getSnapshot().admission).toBe('requested')
    expect(onAdmissionRequested).toHaveBeenCalledTimes(2)
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

  it('treats a stored knock as a request but never downgrades an admission', async () => {
    const { controller, onAdmissionRequested } = setup()
    await controller.join()
    await controller.applyServerAdmission('waiting')
    expect(controller.getSnapshot().admission).toBe('requested')
    expect(onAdmissionRequested).toHaveBeenCalledTimes(1)

    await controller.admit()
    await controller.applyServerAdmission('waiting')
    expect(controller.getSnapshot().admission).toBe('admitted')
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
    await controller.join()
    room.localParticipant.publishError = Object.assign(new Error('busy'), { name: 'NotReadableError' })
    await controller.admit()
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

describe('pickCandidateParticipant', () => {
  it('picks the candidate identity and ignores everyone else', () => {
    const self = new FakeParticipant(SELF, 'Me')
    const unknown = new FakeParticipant('x', 'X')
    const candidate = new FakeParticipant(CANDIDATE, 'C')
    expect(pickCandidateParticipant([self, unknown, candidate], SELF)).toBe(candidate)
    expect(pickCandidateParticipant([self, unknown], SELF)).toBeNull()
  })
})
