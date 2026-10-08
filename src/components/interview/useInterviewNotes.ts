import { useCallback, useEffect, useRef, useState } from 'react'
import { SaveCancelledError, saveTextToComputer } from '../../lib/saveToComputer.ts'
import { getMyInterviewNotes, saveMyInterviewNotes } from '../../services/interviewNotes.ts'

export type NotesSaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useInterviewNotes(sessionId: string) {
  const [value, setValue] = useState('')
  const [saveState, setSaveState] = useState<NotesSaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const loadedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void getMyInterviewNotes(sessionId)
      .then((row) => {
        if (cancelled) return
        setValue(row?.notes ?? '')
        loadedRef.current = true
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load your notes.')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const save = useCallback(
    async (next?: string) => {
      const notes = next ?? value
      setSaveState('saving')
      setError(null)
      try {
        const row = await saveMyInterviewNotes(sessionId, notes)
        setValue(row.notes)
        setSaveState('saved')
      } catch (caught: unknown) {
        setSaveState('error')
        setError(caught instanceof Error ? caught.message : 'Could not save your notes.')
      }
    },
    [sessionId, value],
  )
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const update = useCallback((next: string) => {
    setValue(next)
    setSaveState('idle')
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (!loadedRef.current) return
      void saveRef.current(next)
    }, 1500)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const saveToComputer = useCallback(async (fileName: string) => {
    if (!value.trim()) return
    setExporting(true)
    setError(null)
    try {
      await saveTextToComputer(value, fileName)
    } catch (caught: unknown) {
      if (caught instanceof SaveCancelledError) return
      setError(caught instanceof Error ? caught.message : 'Could not save notes to this computer.')
    } finally {
      setExporting(false)
    }
  }, [value])

  return { value, saveState, error, exporting, update, save, saveToComputer }
}
