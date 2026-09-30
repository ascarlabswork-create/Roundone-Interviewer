import { Room } from 'livekit-client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { requestInterviewToken } from '../../services/interviewCall.ts'
import {
  INITIAL_CALL_SNAPSHOT,
  InterviewCallController,
  type CallRoom,
  type CallSnapshot,
} from '../../services/interviewCallController.ts'

function createLiveKitRoom(): CallRoom {
  return new Room({ adaptiveStream: true, dynacast: true }) as unknown as CallRoom
}

const noopSubscribe = () => () => {}
const initialSnapshot = () => INITIAL_CALL_SNAPSHOT

export type LiveKitCallHandlers = {
  onJoined?: () => void
  onLeft?: () => void
}

/**
 * Joins the LiveKit room for an interview session while mounted and tears the
 * room and all listeners down on unmount or when the session changes.
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
      onJoined: () => handlersRef.current.onJoined?.(),
      onLeft: () => handlersRef.current.onLeft?.(),
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
