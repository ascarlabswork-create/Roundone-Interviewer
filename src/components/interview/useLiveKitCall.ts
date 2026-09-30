import { Room, VideoPresets, createLocalAudioTrack, createLocalVideoTrack } from 'livekit-client'
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

function createLiveKitRoom(): CallRoom {
  return new Room({ adaptiveStream: true, dynacast: true }) as unknown as CallRoom
}

async function createLiveKitMedia(want: { audio: boolean; video: boolean }): Promise<LocalMedia> {
  const [audio, video] = await Promise.allSettled([
    want.audio
      ? createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })
      : Promise.resolve(null),
    want.video ? createLocalVideoTrack({ resolution: VideoPresets.h720.resolution }) : Promise.resolve(null),
  ])
  const failed = [audio, video].find((result) => result.status === 'rejected')
  return {
    audio: audio.status === 'fulfilled' ? (audio.value as unknown as LocalMediaTrack | null) : null,
    video: video.status === 'fulfilled' ? (video.value as unknown as LocalMediaTrack | null) : null,
    error: failed?.status === 'rejected' ? failed.reason : null,
  }
}

const noopSubscribe = () => () => {}
const initialSnapshot = () => INITIAL_CALL_SNAPSHOT

export type LiveKitCallHandlers = {
  onJoined?: () => void
  onLeft?: () => void
  onAdmissionRequested?: () => void
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
