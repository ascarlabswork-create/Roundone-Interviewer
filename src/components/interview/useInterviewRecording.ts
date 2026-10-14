import { useCallback, useEffect, useRef, useState } from 'react'
import { isRecordingActive } from '../../lib/interviewRoomExtras.ts'
import {
  chooseRecordingSaveLocation,
  getLatestInterviewRecording,
  saveInterviewRecording,
  SaveCancelledError,
  startInterviewRecording,
  stopInterviewRecording,
  watchInterviewRecording,
  writeInterviewRecording,
  type InterviewRecordingState,
} from '../../services/interviewRecording.ts'

const FILE_READY_WAIT_MS = 3 * 60 * 1000

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
  const [savedCopy, setSavedCopy] = useState(false)
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

  /**
   * Stops recording and asks where to save it in the same click, because browsers only
   * open the save dialog during a user action. The file is written once processing finishes.
   * Cancelling the dialog still stops recording; the copy can be saved later.
   */
  const stopAndSave = useCallback(
    async (suggestedName: string) => {
      if (!sessionId) return
      setBusy(true)
      setError(null)
      setSavedCopy(false)
      const stopping = stopInterviewRecording(sessionId).then(
        (next) => ({ next, failure: null as unknown }),
        (failure: unknown) => ({ next: null, failure }),
      )
      const target = await chooseRecordingSaveLocation(suggestedName).catch(() => null)
      const { next, failure } = await stopping
      if (!mounted.current) return
      setBusy(false)
      if (!next) {
        setError(failure instanceof Error ? failure.message : 'Could not stop recording.')
        return
      }
      setState(next)
      if (next.status === 'failed') {
        setError('Recording stopped, but the file could not be saved. Try recording again.')
        return
      }
      if (!target) return
      setSaving(true)
      try {
        await writeInterviewRecording(sessionId, target, FILE_READY_WAIT_MS)
        if (mounted.current) setSavedCopy(true)
      } catch (caught: unknown) {
        if (mounted.current) setError(caught instanceof Error ? caught.message : 'Could not save this recording.')
      } finally {
        if (mounted.current) setSaving(false)
      }
    },
    [sessionId],
  )

  const save = useCallback(async (suggestedName?: string) => {
    if (!sessionId) return
    setSaving(true)
    setError(null)
    try {
      await saveInterviewRecording(sessionId, suggestedName)
      setSavedCopy(true)
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
    savedCopy,
    active: isRecordingActive(state.status),
    canSave: state.status === 'stopped' && Boolean(state.storagePath),
    start,
    stop,
    stopAndSave,
    save,
  }
}
