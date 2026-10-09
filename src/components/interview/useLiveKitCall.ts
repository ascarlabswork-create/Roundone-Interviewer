import { Room, VideoPresets, createLocalAudioTrack, createLocalVideoTrack, type LocalAudioTrack } from 'livekit-client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { requestInterviewToken } from '../../services/interviewCall.ts'
import {
  INITIAL_CALL_SNAPSHOT,
  InterviewCallController,
  type CallRoom,
  type CallSnapshot,
  type LocalMedia,
  type LocalMediaTrack,
} from '../../services/interviewCallController.ts'
import {
  attachInterviewerAudioDebug,
  logInterviewerAudio,
  logMicrophoneEnvironment,
  watchLocalAudioTrack,
  wrapPublishTrack,
} from './interviewerAudioDebug.ts'

const AUDIO_CAPTURE_OPTIONS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as const
const AUDIO_RETRY_MS = 400

function createLiveKitRoom(): CallRoom {
  const room = new Room({ adaptiveStream: true, dynacast: true })
  attachInterviewerAudioDebug(room)
  wrapPublishTrack(room)
  return room as unknown as CallRoom
}

function errorFrom(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

async function captureMicrophone(): Promise<LocalAudioTrack> {
  await logMicrophoneEnvironment()
  const track = await createLocalAudioTrack(AUDIO_CAPTURE_OPTIONS)
  watchLocalAudioTrack(track)
  return track
}

async function captureMicrophoneWithRetry(): Promise<LocalAudioTrack> {
  try {
    return await captureMicrophone()
  } catch (firstError) {
    logInterviewerAudio('getUserMedia audio failed; retrying once', { error: errorFrom(firstError) })
    await new Promise((resolve) => setTimeout(resolve, AUDIO_RETRY_MS))
    try {
      return await captureMicrophone()
    } catch (secondError) {
      logInterviewerAudio('getUserMedia audio failed after retry', { error: errorFrom(secondError) })
      throw secondError
    }
  }
}

async function createLiveKitMedia(want: { audio: boolean; video: boolean }): Promise<LocalMedia> {
  const [audio, video] = await Promise.allSettled([
    want.audio ? captureMicrophoneWithRetry() : Promise.resolve(null),
    want.video ? createLocalVideoTrack({ resolution: VideoPresets.h720.resolution }) : Promise.resolve(null),
  ])
  const failed = [audio, video].find((result) => result.status === 'rejected')
  if (audio.status === 'rejected') {
    logInterviewerAudio('microphone capture unavailable; camera may still publish', { error: errorFrom(audio.reason) })
  }
  if (audio.status === 'fulfilled' && audio.value) {
    logInterviewerAudio('mic track ready for publish', {
      source: audio.value.source,
      isMuted: audio.value.isMuted,
      readyState: audio.value.mediaStreamTrack.readyState,
      enabled: audio.value.mediaStreamTrack.enabled,
    })
  }
  return {
    audio: audio.status === 'fulfilled' ? (audio.value as unknown as LocalMediaTrack | null) : null,
    video: video.status === 'fulfilled' ? (video.value as unknown as LocalMediaTrack | null) : null,
    error: failed?.status === 'rejected' ? failed.reason : null,
  }
}

function canShareScreen() {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}

const noopSubscribe = () => () => {}
const initialSnapshot = () => INITIAL_CALL_SNAPSHOT

export type LiveKitCallHandlers = {
  onJoined?: () => void
  onLeft?: () => void
  onAdmissionRequested?: () => void
  onCandidateHandRaised?: () => void
}

/**
 * Joins the LiveKit room for an interview session while mounted and tears the
 * room, camera, microphone and all listeners down on unmount or session change.
 */
export function useLiveKitCall(
  sessionId: string | null,
  handlers: LiveKitCallHandlers = {},
): { snapshot: CallSnapshot; controller: InterviewCallController | null } {
  const [controller, setController] = useState<InterviewCallController | null>(null)
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!sessionId) return
    const next = new InterviewCallController({
      sessionId,
      fetchToken: (id) => requestInterviewToken(id),
      createRoom: createLiveKitRoom,
      createLocalMedia: createLiveKitMedia,
      onJoined: () => handlersRef.current.onJoined?.(),
      onLeft: () => handlersRef.current.onLeft?.(),
      onAdmissionRequested: () => handlersRef.current.onAdmissionRequested?.(),
      canShareScreen,
      onCandidateHandRaised: () => handlersRef.current.onCandidateHandRaised?.(),
    })
    setController(next)
    void next.join()
    return () => {
      next.dispose()
      setController((current) => (current === next ? null : current))
    }
  }, [sessionId])

  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? initialSnapshot,
  )
  return { snapshot, controller }
}
