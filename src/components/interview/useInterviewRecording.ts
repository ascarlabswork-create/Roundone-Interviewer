import { useCallback, useEffect, useRef, useState } from 'react'
import { isRecordingActive } from '../../lib/interviewRoomExtras.ts'
import {
  getLatestInterviewRecording,
  startInterviewRecording,
  stopInterviewRecording,
  watchInterviewRecording,
  type InterviewRecordingState,
} from '../../services/interviewRecording.ts'

const IDLE: InterviewRecordingState = {
  recordingId: null,
  status: 'idle',
  startedAt: null,
  endedAt: null,
  unconfigured: false,
}

export function useInterviewRecording(sessionId: string) {
  const [state, setState] = useState<InterviewRecordingState>(IDLE)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    void getLatestInterviewRecording(sessionId)
      .then((next) => {
        if (mounted.current) setState(next)
      })
      .catch((caught: unknown) => {
        if (mounted.current) setError(caught instanceof Error ? caught.message : 'Could not load recording status.')
      })
    const watch = watchInterviewRecording(sessionId, (next) => {
      if (mounted.current) setState(next)
    })
    return () => {
      mounted.current = false
      watch.unsubscribe()
    }
  }, [sessionId])

  const start = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await startInterviewRecording(sessionId)
      setState(next)
      if (next.unconfigured) setError('Server-side recording is not configured yet.')
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not start recording.')
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  const stop = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setState(await stopInterviewRecording(sessionId))
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not stop recording.')
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  return { state, error, busy, active: isRecordingActive(state.status), start, stop }
}
