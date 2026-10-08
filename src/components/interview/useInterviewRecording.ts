import { useCallback, useEffect, useRef, useState } from 'react'
import { isRecordingActive } from '../../lib/interviewRoomExtras.ts'
import {
  getLatestInterviewRecording,
  saveInterviewRecording,
  SaveCancelledError,
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
  storagePath: null,
  unconfigured: false,
}

export function useInterviewRecording(sessionId: string | null) {
  const [state, setState] = useState<InterviewRecordingState>(IDLE)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (!sessionId) return
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
    if (!sessionId) return
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
    if (!sessionId) return
    setBusy(true)
    setError(null)
    try {
      const next = await stopInterviewRecording(sessionId)
      setState(next)
      if (next.status === 'failed') setError('Recording stopped, but the file could not be saved. Try recording again.')
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not stop recording.')
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  const save = useCallback(async (suggestedName?: string) => {
    if (!sessionId) return
    setSaving(true)
    setError(null)
    try {
      await saveInterviewRecording(sessionId, suggestedName)
    } catch (caught: unknown) {
      if (caught instanceof SaveCancelledError) return
      setError(caught instanceof Error ? caught.message : 'Could not save this recording.')
    } finally {
      setSaving(false)
    }
  }, [sessionId])

  return {
    state,
    error,
    busy,
    saving,
    active: isRecordingActive(state.status),
    canSave: state.status === 'stopped' && Boolean(state.storagePath),
    start,
    stop,
    save,
  }
}
