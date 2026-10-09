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
import { SCREEN_SHARE_MESSAGES, isRoomSignalTopic, parseHandSignal, screenShareFailure } from '../lib/roomSignaling.ts'

/** Structural subset of livekit-client used by the call; keeps the controller testable. */
export type CallTrack = {
  attach(element: HTMLMediaElement): HTMLMediaElement
  detach(element: HTMLMediaElement): HTMLMediaElement
}

export type LocalMediaTrack = CallTrack & {
  isMuted: boolean
  mute(): Promise<unknown>
  unmute(): Promise<unknown>
  stop(): void
}

export type LocalMedia = {
  audio: LocalMediaTrack | null
  video: LocalMediaTrack | null
  error: unknown
}

export type CallPublication = {
  isMuted: boolean
  track?: CallTrack
  isSubscribed?: boolean
  setSubscribed?(subscribed: boolean): void
}

/** LiveKit `Track.Source` values used by the interview room. */
export type CallSource = 'camera' | 'microphone' | 'screen_share'

export type CallParticipant = {
  identity: string
  sid?: string
  name?: string
  getTrackPublication(source: CallSource): CallPublication | undefined
  getTrackPublications(): CallPublication[]
}

export type CallLocalParticipant = {
  identity: string
  publishTrack(track: LocalMediaTrack): Promise<unknown>
  unpublishTrack(track: LocalMediaTrack, stopOnUnpublish?: boolean): Promise<unknown>
  getTrackPublication?(source: CallSource): CallPublication | undefined
  setScreenShareEnabled?(enabled: boolean, options?: { audio: boolean }): Promise<unknown>
}

export type CallRoom = {
  localParticipant: CallLocalParticipant
  remoteParticipants: Map<string, CallParticipant>
  canPlaybackAudio: boolean
  on(event: string, listener: (...args: unknown[]) => void): unknown
  removeAllListeners(): unknown
  connect(url: string, token: string, options?: { autoSubscribe: boolean }): Promise<void>
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
  dataReceived: 'dataReceived',
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

/**
 * none: nobody has asked yet · requested: the candidate is waiting to be let in ·
 * admitted: media flows both ways · denied: the interviewer declined.
 */
export type AdmissionState = 'none' | 'requested' | 'admitted' | 'denied'

export type ServerAdmissionStatus = 'waiting' | 'admitted' | 'denied'

export type CandidateView = {
  presence: CandidatePresence
  name: string | null
  videoTrack: CallTrack | null
  audioTrack: CallTrack | null
  screenTrack: CallTrack | null
  micMuted: boolean
  cameraOff: boolean
  handRaised: boolean
}

export type CallSnapshot = {
  phase: CallPhase
  error: { kind: CallErrorKind; message: string } | null
  mediaError: { kind: MediaErrorKind; message: string } | null
  admission: AdmissionState
  /** True once the interviewer's mic/camera are published to the room. */
  live: boolean
  micEnabled: boolean
  cameraEnabled: boolean
  localVideoTrack: CallTrack | null
  candidate: CandidateView
  canPlaybackAudio: boolean
  screenShareSupported: boolean
  /** The interviewer's own published screen, if sharing. */
  localScreenTrack: CallTrack | null
  screenShareBusy: boolean
  screenShareError: string | null
}

const EMPTY_CANDIDATE: CandidateView = {
  presence: 'waiting',
  name: null,
  videoTrack: null,
  audioTrack: null,
  screenTrack: null,
  micMuted: true,
  cameraOff: true,
  handRaised: false,
}

export const INITIAL_CALL_SNAPSHOT: CallSnapshot = {
  phase: 'idle',
  error: null,
  mediaError: null,
  admission: 'admitted',
  live: false,
  micEnabled: false,
  cameraEnabled: false,
  localVideoTrack: null,
  candidate: EMPTY_CANDIDATE,
  canPlaybackAudio: true,
  screenShareSupported: false,
  localScreenTrack: null,
  screenShareBusy: false,
  screenShareError: null,
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

/** A rejoin gets a new participant sid, so state tied to the old connection is stale. */
function isSameParticipant(participant: CallParticipant | null, ref: { identity: string; sid?: string }) {
  if (!participant || participant.identity !== ref.identity) return false
  return !ref.sid || !participant.sid || participant.sid === ref.sid
}

export type InterviewCallDeps = {
  sessionId: string
  fetchToken: (sessionId: string) => Promise<InterviewCallToken>
  createRoom: () => CallRoom
  /** Opens the camera and microphone independently so one failure keeps the other. */
  createLocalMedia: (want: { audio: boolean; video: boolean }) => Promise<LocalMedia>
  /** Called after every successful connection to the room. */
  onJoined?: () => void
  /** Called once per connection when it ends (leave, unmount or unexpected disconnect). */
  onLeft?: () => void
  /** Called each time the candidate starts waiting to be admitted. */
  onAdmissionRequested?: () => void
  /** Whether this browser can capture a screen; capture itself only starts from toggleScreenShare. */
  canShareScreen?: () => boolean
  /** Called when the candidate raises their hand (not when it is lowered). */
  onCandidateHandRaised?: () => void
}

/**
 * 1-to-1 interview: both participants publish and subscribe as soon as they are
 * authorized. There is no interviewer admit step.
 */
export class InterviewCallController {
  private readonly deps: InterviewCallDeps
  private snapshot: CallSnapshot = INITIAL_CALL_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private room: CallRoom | null = null
  private selfIdentity: string | null = null
  private audio: LocalMediaTrack | null = null
  private video: LocalMediaTrack | null = null
  private published = new Set<LocalMediaTrack>()
  private candidatePresent = false
  private candidateEverJoined = false
  private inRoom = false
  private disposed = false
  private started = false
  /** The candidate participant whose hand is currently raised; cleared when that participant leaves. */
  private raisedHand: { identity: string; sid?: string } | null = null

  constructor(deps: InterviewCallDeps) {
    this.deps = deps
    this.snapshot = { ...INITIAL_CALL_SNAPSHOT, screenShareSupported: deps.canShareScreen?.() ?? false }
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

  private setAdmission(admission: AdmissionState) {
    if (this.snapshot.admission === admission) return
    this.update({ admission })
    if (admission === 'requested') this.deps.onAdmissionRequested?.()
  }

  private localPatch(): Partial<CallSnapshot> {
    const cameraEnabled = Boolean(this.video && !this.video.isMuted)
    return {
      micEnabled: Boolean(this.audio && !this.audio.isMuted),
      cameraEnabled,
      localVideoTrack: cameraEnabled ? this.video : null,
      live: this.published.size > 0,
      localScreenTrack: visibleTrack(this.room?.localParticipant.getTrackPublication?.('screen_share')),
    }
  }

  private sync() {
    const room = this.room
    if (!room) {
      this.update(this.localPatch())
      return
    }
    const candidate = pickCandidateParticipant(room.remoteParticipants.values(), this.selfIdentity)
    const arrived = Boolean(candidate) && !this.candidatePresent
    this.candidatePresent = Boolean(candidate)
    if (candidate) this.candidateEverJoined = true

    const admitted = this.snapshot.admission !== 'denied'
    if (candidate) {
      for (const publication of candidate.getTrackPublications()) {
        if (publication.isSubscribed !== admitted) publication.setSubscribed?.(admitted)
      }
    }
    if (arrived && this.snapshot.admission === 'none') this.setAdmission('admitted')
    if (!candidate && this.snapshot.admission === 'requested') this.setAdmission('none')
    if (this.raisedHand && !isSameParticipant(candidate, this.raisedHand)) this.raisedHand = null

    const camera = candidate?.getTrackPublication('camera')
    const microphone = candidate?.getTrackPublication('microphone')
    const screen = candidate?.getTrackPublication('screen_share')
    this.update({
      ...this.localPatch(),
      canPlaybackAudio: room.canPlaybackAudio,
      candidate: {
        presence: candidatePresence(Boolean(candidate), this.candidateEverJoined),
        name: candidate?.name?.trim() || null,
        videoTrack: admitted ? visibleTrack(camera) : null,
        audioTrack: admitted ? visibleTrack(microphone) : null,
        screenTrack: admitted ? visibleTrack(screen) : null,
        micMuted: !microphone || microphone.isMuted,
        cameraOff: !camera || camera.isMuted,
        handRaised: this.raisedHand !== null,
      },
    })
  }

  private receiveSignal(payload: unknown, from: unknown, topic: unknown) {
    if (!isRoomSignalTopic(topic) || !(payload instanceof Uint8Array)) return
    const raised = parseHandSignal(payload)
    if (raised === null) return
    const sender = from as CallParticipant | undefined
    if (!sender || sender.identity === this.selfIdentity || parseParticipantRole(sender.identity) !== 'candidate') return
    const wasRaised = this.raisedHand !== null
    this.raisedHand = raised ? { identity: sender.identity, sid: sender.sid } : null
    this.sync()
    if (raised && !wasRaised) this.deps.onCandidateHandRaised?.()
  }

  /** Best effort; disconnecting also stops every local track, including the screen capture. */
  private stopScreenShareBeforeLeaving(room: CallRoom | null) {
    const local = room?.localParticipant
    if (!local?.getTrackPublication?.('screen_share')) return
    void local.setScreenShareEnabled?.(false)?.catch(() => {})
  }

  private async ensureLocalMedia() {
    const want = { audio: !this.audio, video: !this.video }
    if (!want.audio && !want.video) return
    const media = await this.deps.createLocalMedia(want)
    if (this.disposed) {
      media.audio?.stop()
      media.video?.stop()
      return
    }
    if (media.audio) this.audio = media.audio
    if (media.video) this.video = media.video
    if (media.error) this.setMediaError(media.error)
    else this.update({ mediaError: null })
    // Admit can happen while the microphone is still opening. Publish once it exists
    // and the room is connected — LiveKit will stop a track that times out unpublished.
    await this.publishLocalMedia()
  }

  private stopLocalMedia() {
    this.audio?.stop()
    this.video?.stop()
    this.audio = null
    this.video = null
    this.published.clear()
  }

  private async publishLocalMedia() {
    const room = this.room
    const hasAudio = Boolean(this.audio)
    const hasVideo = Boolean(this.video)
    if (!room || !this.inRoom || this.snapshot.admission === 'denied') {
      console.info('[INTERVIEWER AUDIO] publish skipped', {
        hasRoom: Boolean(room),
        inRoom: this.inRoom,
        admission: this.snapshot.admission,
        hasAudio,
        hasVideo,
        audioMuted: this.audio?.isMuted ?? null,
      })
      return
    }
    console.info('[INTERVIEWER AUDIO] publish starting', {
      hasAudio,
      hasVideo,
      audioMuted: this.audio?.isMuted ?? null,
      alreadyPublished: this.published.size,
    })
    for (const track of [this.audio, this.video]) {
      if (!track || this.published.has(track)) continue
      try {
        await room.localParticipant.publishTrack(track)
        if (this.room !== room) return
        this.published.add(track)
      } catch (error) {
        if (this.room !== room) return
        this.setMediaError(error)
      }
    }
    console.info('[INTERVIEWER AUDIO] publish finished', {
      publishedCount: this.published.size,
      publishedAudio: this.audio ? this.published.has(this.audio) : false,
      publishedVideo: this.video ? this.published.has(this.video) : false,
    })
  }

  private async unpublishLocalMedia() {
    const room = this.room
    const tracks = [...this.published]
    this.published.clear()
    if (!room) return
    for (const track of tracks) {
      await room.localParticipant.unpublishTrack(track, false).catch(() => {})
    }
  }

  private releaseRoom() {
    const room = this.room
    this.stopScreenShareBeforeLeaving(room)
    this.room = null
    this.published.clear()
    this.candidatePresent = false
    this.raisedHand = null
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
    room.on(CALL_ROOM_EVENTS.dataReceived, (payload, from, _kind, topic) => this.receiveSignal(payload, from, topic))
    room.on(CALL_ROOM_EVENTS.mediaDevicesError, (error, kind) => {
      // LiveKit also reports screen capture failures here, without a device kind; toggleScreenShare handles those.
      if (kind === undefined && this.snapshot.screenShareBusy) return
      this.setMediaError(error)
    })
    room.on(CALL_ROOM_EVENTS.reconnecting, () => this.update({ phase: 'reconnecting' }))
    room.on(CALL_ROOM_EVENTS.reconnected, () => {
      this.update({ phase: 'connected' })
      this.sync()
    })
    room.on(CALL_ROOM_EVENTS.disconnected, () => {
      if (this.room !== room) return
      this.releaseRoom()
      this.update({
        ...this.localPatch(),
        phase: 'disconnected',
        error: { kind: 'connection', message: 'The call was disconnected.' },
        candidate: { ...EMPTY_CANDIDATE, presence: candidatePresence(false, this.candidateEverJoined) },
      })
    })
  }

  async join(): Promise<void> {
    if (this.started || this.disposed) return
    this.started = true
    this.update({ phase: 'requesting_token', error: null })

    const media = this.ensureLocalMedia().then(() => this.sync())
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
      await room.connect(credentials.url, credentials.token, { autoSubscribe: true })
    } catch (error) {
      if (this.room !== room) return
      this.releaseRoom()
      this.fail(error, 'connection')
      return
    }
    if (this.room !== room) return

    this.inRoom = true
    if (this.snapshot.admission === 'none') this.setAdmission('admitted')
    this.update({ phase: 'connected' })
    this.sync()
    this.deps.onJoined?.()
    await media
    await this.publishLocalMedia()
    this.sync()
  }

  /** Lets the candidate in: publishes local media and subscribes to theirs. */
  async admit(): Promise<void> {
    if (this.disposed) return
    this.setAdmission('admitted')
    this.sync()
    await this.publishLocalMedia()
    this.sync()
  }

  /** Keeps the candidate out: nothing is sent to or received from them. */
  async deny(): Promise<void> {
    if (this.disposed) return
    this.setAdmission('denied')
    await this.unpublishLocalMedia()
    this.sync()
  }

  /** Applies an admission decision stored in the database. 1-to-1 interviews auto-admit. */
  applyServerAdmission(status: ServerAdmissionStatus): Promise<void> {
    if (status === 'denied') return this.snapshot.admission === 'denied' ? Promise.resolve() : this.deny()
    return this.snapshot.admission === 'admitted' ? Promise.resolve() : this.admit()
  }

  /** Starts a fresh connection after an error, unexpected disconnect or leaving. */
  retry(): Promise<void> {
    if (this.disposed || this.room) return Promise.resolve()
    this.started = false
    return this.join()
  }

  async toggleMic(): Promise<void> {
    console.info('[INTERVIEWER AUDIO] toggleMic', {
      hasAudio: Boolean(this.audio),
      isMuted: this.audio?.isMuted ?? null,
      admission: this.snapshot.admission,
      inRoom: this.inRoom,
    })
    if (!this.audio) {
      await this.retryMedia()
      return
    }
    try {
      await (this.audio.isMuted ? this.audio.unmute() : this.audio.mute())
    } catch (error) {
      this.setMediaError(error)
    }
    this.sync()
  }

  async toggleCamera(): Promise<void> {
    if (!this.video) {
      await this.retryMedia()
      return
    }
    try {
      await (this.video.isMuted ? this.video.unmute() : this.video.mute())
    } catch (error) {
      this.setMediaError(error)
    }
    this.sync()
  }

  async retryMedia(): Promise<void> {
    await this.ensureLocalMedia()
    await this.publishLocalMedia()
    this.sync()
  }

  /** Opens the browser's screen picker on start; only ever called from an explicit user action. */
  async toggleScreenShare(): Promise<void> {
    const room = this.room
    const local = room?.localParticipant
    if (!room || !local || !this.inRoom || this.snapshot.screenShareBusy) return
    const enable = !local.getTrackPublication?.('screen_share')
    if (enable && (!this.snapshot.screenShareSupported || !local.setScreenShareEnabled)) {
      this.update({ screenShareError: SCREEN_SHARE_MESSAGES.unsupported })
      return
    }
    this.update({ screenShareBusy: true, screenShareError: null })
    try {
      await local.setScreenShareEnabled?.(enable, { audio: false })
    } catch (error) {
      if (this.room === room) {
        this.update({ screenShareError: enable ? screenShareFailure(error) : SCREEN_SHARE_MESSAGES.stopFailed })
      }
    }
    if (this.disposed) return
    this.update({ screenShareBusy: false })
    this.sync()
  }

  dismissScreenShareError(): void {
    this.update({ screenShareError: null })
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

  /** Disconnects, removes every room listener and releases the camera and mic. Safe to call repeatedly. */
  leave(): void {
    this.releaseRoom()
    this.stopLocalMedia()
    if (this.snapshot.phase !== 'left') {
      this.update({
        ...this.localPatch(),
        phase: 'left',
        candidate: EMPTY_CANDIDATE,
        screenShareError: null,
      })
    }
  }

  dispose(): void {
    this.disposed = true
    this.releaseRoom()
    this.stopLocalMedia()
    this.listeners.clear()
  }
}
