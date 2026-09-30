import {
  InterviewCallError,
  MEDIA_ERROR_MESSAGES,
  callError,
  candidatePresence,
  classifyMediaError,
  interviewRoomName,
  parseParticipantRole,
  type CallErrorKind,
  type CandidatePresence,
  type InterviewCallToken,
  type MediaErrorKind,
} from './interviewCall.ts'

/** Structural subset of livekit-client used by the call; keeps the controller testable. */
export type CallTrack = {
  attach(element: HTMLMediaElement): HTMLMediaElement
  detach(element: HTMLMediaElement): HTMLMediaElement
}

export type CallPublication = { isMuted: boolean; track?: CallTrack }

export type CallParticipant = {
  identity: string
  name?: string
  getTrackPublication(source: 'camera' | 'microphone'): CallPublication | undefined
}

export type CallLocalParticipant = CallParticipant & {
  isMicrophoneEnabled: boolean
  isCameraEnabled: boolean
  setMicrophoneEnabled(enabled: boolean): Promise<unknown>
  setCameraEnabled(enabled: boolean): Promise<unknown>
}

export type CallRoom = {
  localParticipant: CallLocalParticipant
  remoteParticipants: Map<string, CallParticipant>
  canPlaybackAudio: boolean
  on(event: string, listener: (arg?: unknown) => void): unknown
  removeAllListeners(): unknown
  connect(url: string, token: string): Promise<void>
  disconnect(): Promise<void>
  startAudio(): Promise<void>
}

export const CALL_ROOM_EVENTS = {
  participantConnected: 'participantConnected',
  participantDisconnected: 'participantDisconnected',
  trackPublished: 'trackPublished',
  trackUnpublished: 'trackUnpublished',
  trackSubscribed: 'trackSubscribed',
  trackUnsubscribed: 'trackUnsubscribed',
  trackMuted: 'trackMuted',
  trackUnmuted: 'trackUnmuted',
  localTrackPublished: 'localTrackPublished',
  localTrackUnpublished: 'localTrackUnpublished',
  audioPlaybackChanged: 'audioPlaybackChanged',
  mediaDevicesError: 'mediaDevicesError',
  reconnecting: 'reconnecting',
  reconnected: 'reconnected',
  disconnected: 'disconnected',
} as const

const SYNC_EVENTS = [
  CALL_ROOM_EVENTS.participantConnected,
  CALL_ROOM_EVENTS.participantDisconnected,
  CALL_ROOM_EVENTS.trackPublished,
  CALL_ROOM_EVENTS.trackUnpublished,
  CALL_ROOM_EVENTS.trackSubscribed,
  CALL_ROOM_EVENTS.trackUnsubscribed,
  CALL_ROOM_EVENTS.trackMuted,
  CALL_ROOM_EVENTS.trackUnmuted,
  CALL_ROOM_EVENTS.localTrackPublished,
  CALL_ROOM_EVENTS.localTrackUnpublished,
  CALL_ROOM_EVENTS.audioPlaybackChanged,
]

export type CallPhase =
  | 'idle'
  | 'requesting_token'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'left'
  | 'error'

export type CandidateView = {
  presence: CandidatePresence
  name: string | null
  videoTrack: CallTrack | null
  audioTrack: CallTrack | null
  micMuted: boolean
  cameraOff: boolean
}

export type CallSnapshot = {
  phase: CallPhase
  error: { kind: CallErrorKind; message: string } | null
  mediaError: { kind: MediaErrorKind; message: string } | null
  micEnabled: boolean
  cameraEnabled: boolean
  localVideoTrack: CallTrack | null
  candidate: CandidateView
  canPlaybackAudio: boolean
}

const EMPTY_CANDIDATE: CandidateView = {
  presence: 'waiting',
  name: null,
  videoTrack: null,
  audioTrack: null,
  micMuted: true,
  cameraOff: true,
}

export const INITIAL_CALL_SNAPSHOT: CallSnapshot = {
  phase: 'idle',
  error: null,
  mediaError: null,
  micEnabled: false,
  cameraEnabled: false,
  localVideoTrack: null,
  candidate: EMPTY_CANDIDATE,
  canPlaybackAudio: true,
}

export function pickCandidateParticipant(
  participants: Iterable<CallParticipant>,
  selfIdentity: string | null,
): CallParticipant | null {
  for (const participant of participants) {
    if (participant.identity === selfIdentity) continue
    if (parseParticipantRole(participant.identity) === 'candidate') return participant
  }
  return null
}

function visibleTrack(publication: CallPublication | undefined) {
  return publication && !publication.isMuted && publication.track ? publication.track : null
}

export type InterviewCallDeps = {
  sessionId: string
  fetchToken: (sessionId: string) => Promise<InterviewCallToken>
  createRoom: () => CallRoom
  /** Called after every successful connection to the room. */
  onJoined?: () => void
  /** Called once per connection when it ends (leave, unmount or unexpected disconnect). */
  onLeft?: () => void
}

export class InterviewCallController {
  private readonly deps: InterviewCallDeps
  private snapshot: CallSnapshot = INITIAL_CALL_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private room: CallRoom | null = null
  private selfIdentity: string | null = null
  private candidateEverJoined = false
  private inRoom = false
  private disposed = false
  private started = false

  constructor(deps: InterviewCallDeps) {
    this.deps = deps
  }

  getSnapshot = (): CallSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private update(patch: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  private fail(error: unknown, fallback: CallErrorKind) {
    const typed = error instanceof InterviewCallError ? error : callError(fallback)
    this.update({ phase: 'error', error: { kind: typed.kind, message: typed.message } })
  }

  private setMediaError(error: unknown) {
    const kind = classifyMediaError(error)
    this.update({ mediaError: { kind, message: MEDIA_ERROR_MESSAGES[kind] } })
  }

  private sync() {
    const room = this.room
    if (!room) return
    const local = room.localParticipant
    const candidate = pickCandidateParticipant(room.remoteParticipants.values(), this.selfIdentity)
    if (candidate) this.candidateEverJoined = true
    const camera = candidate?.getTrackPublication('camera')
    const microphone = candidate?.getTrackPublication('microphone')
    this.update({
      micEnabled: local.isMicrophoneEnabled,
      cameraEnabled: local.isCameraEnabled,
      localVideoTrack: visibleTrack(local.getTrackPublication('camera')),
      canPlaybackAudio: room.canPlaybackAudio,
      candidate: {
        presence: candidatePresence(Boolean(candidate), this.candidateEverJoined),
        name: candidate?.name?.trim() || null,
        videoTrack: visibleTrack(camera),
        audioTrack: visibleTrack(microphone),
        micMuted: !microphone || microphone.isMuted,
        cameraOff: !camera || camera.isMuted,
      },
    })
  }

  private releaseRoom() {
    const room = this.room
    this.room = null
    if (!room) return
    room.removeAllListeners()
    void room.disconnect().catch(() => {})
    if (this.inRoom) {
      this.inRoom = false
      this.deps.onLeft?.()
    }
  }

  private bindRoom(room: CallRoom) {
    const sync = () => this.sync()
    for (const event of SYNC_EVENTS) room.on(event, sync)
    room.on(CALL_ROOM_EVENTS.mediaDevicesError, (error) => this.setMediaError(error))
    room.on(CALL_ROOM_EVENTS.reconnecting, () => this.update({ phase: 'reconnecting' }))
    room.on(CALL_ROOM_EVENTS.reconnected, () => {
      this.update({ phase: 'connected' })
      this.sync()
    })
    room.on(CALL_ROOM_EVENTS.disconnected, () => {
      if (this.room !== room) return
      this.releaseRoom()
      this.update({
        phase: 'disconnected',
        error: { kind: 'connection', message: 'The call was disconnected.' },
        localVideoTrack: null,
        candidate: { ...EMPTY_CANDIDATE, presence: candidatePresence(false, this.candidateEverJoined) },
      })
    })
  }

  private async publishLocalMedia() {
    const room = this.room
    if (!room) return
    this.update({ mediaError: null })
    for (const enable of [
      () => room.localParticipant.setMicrophoneEnabled(true),
      () => room.localParticipant.setCameraEnabled(true),
    ]) {
      try {
        await enable()
      } catch (error) {
        if (this.room !== room) return
        this.setMediaError(error)
      }
    }
    if (this.room === room) this.sync()
  }

  async join(): Promise<void> {
    if (this.started || this.disposed) return
    this.started = true
    this.update({ phase: 'requesting_token', error: null })

    let credentials: InterviewCallToken
    try {
      credentials = await this.deps.fetchToken(this.deps.sessionId)
    } catch (error) {
      if (!this.disposed) this.fail(error, 'network')
      return
    }
    if (this.disposed) return
    if (credentials.room !== interviewRoomName(this.deps.sessionId)) {
      this.fail(callError('not_found'), 'not_found')
      return
    }

    const room = this.deps.createRoom()
    this.room = room
    this.selfIdentity = credentials.identity
    this.bindRoom(room)
    this.update({ phase: 'connecting' })

    try {
      await room.connect(credentials.url, credentials.token)
    } catch (error) {
      if (this.room !== room) return
      this.releaseRoom()
      this.fail(error, 'connection')
      return
    }
    if (this.room !== room) return

    this.inRoom = true
    this.update({ phase: 'connected' })
    this.sync()
    this.deps.onJoined?.()
    await this.publishLocalMedia()
  }

  /** Starts a fresh connection after an error or unexpected disconnect. */
  retry(): Promise<void> {
    if (this.disposed || this.room) return Promise.resolve()
    this.started = false
    return this.join()
  }

  async toggleMic(): Promise<void> {
    const room = this.room
    if (!room) return
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
      if (this.room === room) this.update({ mediaError: null })
    } catch (error) {
      if (this.room === room) this.setMediaError(error)
    }
    this.sync()
  }

  async toggleCamera(): Promise<void> {
    const room = this.room
    if (!room) return
    try {
      await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
      if (this.room === room) this.update({ mediaError: null })
    } catch (error) {
      if (this.room === room) this.setMediaError(error)
    }
    this.sync()
  }

  retryMedia(): Promise<void> {
    return this.publishLocalMedia()
  }

  async startAudio(): Promise<void> {
    const room = this.room
    if (!room) return
    try {
      await room.startAudio()
    } finally {
      this.sync()
    }
  }

  /** Disconnects from LiveKit and removes every room listener. Safe to call repeatedly. */
  leave(): void {
    this.releaseRoom()
    if (this.snapshot.phase !== 'left') {
      this.update({
        phase: 'left',
        localVideoTrack: null,
        micEnabled: false,
        cameraEnabled: false,
        candidate: EMPTY_CANDIDATE,
      })
    }
  }

  dispose(): void {
    this.disposed = true
    this.releaseRoom()
    this.listeners.clear()
  }
}
