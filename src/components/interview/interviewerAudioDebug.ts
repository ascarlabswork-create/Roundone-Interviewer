import {
  RoomEvent,
  Track,
  TrackEvent,
  type LocalTrack,
  type LocalTrackPublication,
  type Room,
  type TrackPublishOptions,
} from 'livekit-client'

const PREFIX = '[INTERVIEWER AUDIO]'

export function logInterviewerAudio(event: string, detail?: Record<string, unknown>) {
  if (detail) console.info(PREFIX, event, detail)
  else console.info(PREFIX, event)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function mediaTrackInfo(track: MediaStreamTrack | undefined) {
  if (!track) return { exists: false }
  const settings = track.getSettings()
  return {
    exists: true,
    id: track.id,
    label: track.label,
    kind: track.kind,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    deviceId: settings.deviceId ?? null,
  }
}

function publicationInfo(publication: LocalTrackPublication | undefined) {
  if (!publication) return { exists: false }
  const media = publication.track?.mediaStreamTrack
  return {
    exists: true,
    kind: publication.kind,
    source: publication.source,
    published: Boolean(publication.trackSid),
    trackSid: publication.trackSid || null,
    muted: publication.isMuted,
    trackExists: Boolean(publication.track),
    trackMuted: publication.track?.isMuted ?? null,
    media: mediaTrackInfo(media),
  }
}

/** LiveKit publish options so an audio track is registered as a microphone, not unknown. */
export function publishSourceForTrack(track: LocalTrack | MediaStreamTrack): TrackPublishOptions {
  const kind = 'kind' in track ? String(track.kind) : ''
  if (kind === Track.Kind.Audio || kind === 'audio') return { source: Track.Source.Microphone }
  if (kind === Track.Kind.Video || kind === 'video') return { source: Track.Source.Camera }
  return {}
}

export function inspectLocalMicrophone(room: Room) {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone)
  const audioPublications = [...room.localParticipant.audioTrackPublications.values()].map((item) =>
    publicationInfo(item),
  )
  logInterviewerAudio('local microphone publication', {
    connectionState: room.state,
    identity: room.localParticipant.identity,
    microphone: publicationInfo(publication),
    audioPublications,
  })
  return publication
}

export async function logMicrophoneEnvironment() {
  let permission = 'query-unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    permission = status.state
  } catch {
    permission = 'query-unsupported'
  }
  let devices: Array<{ label: string; deviceId: string; groupId: string }> = []
  try {
    devices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({ label: device.label || '(unlabeled)', deviceId: device.deviceId, groupId: device.groupId }))
  } catch (error) {
    logInterviewerAudio('enumerateDevices failed', { error: errorMessage(error) })
  }
  logInterviewerAudio('mic permission', { state: permission, microphoneCount: devices.length, devices })
}

export function watchLocalAudioTrack(track: LocalTrack) {
  const media = track.mediaStreamTrack
  logInterviewerAudio('mic track created', {
    kind: track.kind,
    source: track.source,
    isMuted: track.isMuted,
    media: mediaTrackInfo(media),
  })
  if (media && !media.enabled) {
    logInterviewerAudio('mic MediaStreamTrack was disabled; enabling')
    media.enabled = true
  }
  const onEnded = () => {
    logInterviewerAudio('mic track ended', mediaTrackInfo(track.mediaStreamTrack))
  }
  const onMuted = () => {
    logInterviewerAudio('mic LocalTrack muted', { isMuted: track.isMuted, media: mediaTrackInfo(track.mediaStreamTrack) })
  }
  const onUnmuted = () => {
    logInterviewerAudio('mic LocalTrack unmuted', { isMuted: track.isMuted, media: mediaTrackInfo(track.mediaStreamTrack) })
  }
  track.on(TrackEvent.Ended, onEnded)
  track.on(TrackEvent.Muted, onMuted)
  track.on(TrackEvent.Unmuted, onUnmuted)
}

export function attachInterviewerAudioDebug(room: Room) {
  const logPublication = (event: string, publication: LocalTrackPublication) => {
    logInterviewerAudio(event, publicationInfo(publication))
    inspectLocalMicrophone(room)
  }

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    logInterviewerAudio('connectionStateChanged', { state })
  })
  room.on(RoomEvent.LocalTrackPublished, (publication) => {
    logPublication('LocalTrackPublished', publication)
  })
  room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
    logPublication('LocalTrackUnpublished', publication)
  })
  room.on(RoomEvent.TrackMuted, (publication, participant) => {
    if (participant !== room.localParticipant) return
    logInterviewerAudio('TrackMuted', {
      identity: participant.identity,
      kind: publication.kind,
      source: publication.source,
      muted: publication.isMuted,
    })
  })
  room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
    if (participant !== room.localParticipant) return
    logInterviewerAudio('TrackUnmuted', {
      identity: participant.identity,
      kind: publication.kind,
      source: publication.source,
      muted: publication.isMuted,
    })
  })
  room.on(RoomEvent.MediaDevicesError, (error: Error) => {
    logInterviewerAudio('MediaDevicesError', { error: errorMessage(error) })
  })
  room.on(RoomEvent.LocalAudioSilenceDetected, (publication) => {
    logInterviewerAudio('LocalAudioSilenceDetected', publicationInfo(publication))
  })
}

export function wrapPublishTrack(room: Room) {
  const publish = room.localParticipant.publishTrack.bind(room.localParticipant)
  room.localParticipant.publishTrack = async (track, options) => {
    const sourceOpts = publishSourceForTrack(track)
    logInterviewerAudio('publishTrack called', {
      ...sourceOpts,
      hasOptions: Boolean(options),
      media: 'mediaStreamTrack' in track ? mediaTrackInfo(track.mediaStreamTrack) : mediaTrackInfo(track),
    })
    try {
      const publication = await publish(track, { ...options, ...sourceOpts })
      logInterviewerAudio('publishTrack resolved', publicationInfo(publication))
      if (
        publication.source === Track.Source.Microphone &&
        publication.isMuted &&
        publication.track &&
        !publication.track.isMuted
      ) {
        logInterviewerAudio('microphone publication muted while local track is live; unmuting')
        await publication.unmute()
        logInterviewerAudio('microphone after unmute', publicationInfo(publication))
      }
      inspectLocalMicrophone(room)
      return publication
    } catch (error) {
      logInterviewerAudio('publishTrack failed', { error: errorMessage(error) })
      inspectLocalMicrophone(room)
      throw error
    }
  }
}
