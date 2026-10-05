import { useCallback, useEffect, useState } from 'react'
import { canEnterCall, interviewPhase } from '../../lib/interviewTiming.ts'
import { getInterviewTiming, type InterviewTiming, type InterviewTimingPhase } from '../../services/interviewSessions.ts'

const POLL_MS = 15_000

export type InterviewClock = {
  timing: InterviewTiming | null
  error: string | null
  /** Current time on the server clock (local clock + measured offset). */
  serverNow: number | null
  phase: InterviewTimingPhase | null
  canJoin: boolean
  reload: () => Promise<void>
}

/**
 * Loads the server-clock schedule for a session and ticks every second. Phases are derived
 * from the server clock, so a wrong or changed browser clock cannot open the call early;
 * the server re-checks every call entry anyway.
 */
export function useInterviewTiming(sessionId: string, refreshKey: unknown): InterviewClock {
  const [timing, setTiming] = useState<InterviewTiming | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localNow, setLocalNow] = useState(() => Date.now())

  const reload = useCallback(async () => {
    try {
      setTiming(await getInterviewTiming(sessionId))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the interview schedule.')
    }
  }, [sessionId])

  useEffect(() => {
    void reload()
    const poll = window.setInterval(() => void reload(), POLL_MS)
    return () => window.clearInterval(poll)
  }, [reload, refreshKey])

  useEffect(() => {
    const tick = window.setInterval(() => setLocalNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  if (!timing) return { timing, error, serverNow: null, phase: null, canJoin: false, reload }

  const serverNow = localNow + timing.serverOffsetMs
  const phase: InterviewTimingPhase =
    timing.phase === 'closed' ? 'closed' : timing.sessionEnded ? 'ended' : interviewPhase(timing.schedule, serverNow)
  const canJoin =
    (phase === 'lobby' || phase === 'live') && canEnterCall(timing.schedule, serverNow, timing.hasJoined)
  return { timing, error, serverNow, phase, canJoin, reload }
}
