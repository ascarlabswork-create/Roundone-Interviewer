import type { InterviewTiming } from '../services/interviewSessions.ts'

export type CheckState = 'checking' | 'ok' | 'warn' | 'fail'
export type DeviceCheck = { state: CheckState; detail: string }

export function networkCheck(online: boolean, latencyMs: number | null): DeviceCheck {
  if (!online) return { state: 'fail', detail: 'You are offline. Reconnect to the internet before the interview.' }
  if (latencyMs === null) return { state: 'checking', detail: 'Measuring connection…' }
  if (latencyMs < 300) return { state: 'ok', detail: `Good connection (${latencyMs} ms)` }
  if (latencyMs < 800) return { state: 'warn', detail: `Fair connection (${latencyMs} ms). Video may be lower quality.` }
  return { state: 'warn', detail: `Slow connection (${latencyMs} ms). Move closer to your router or use a wired connection.` }
}

export function candidateStatusCopy(
  timing: Pick<InterviewTiming, 'candidatePresence' | 'candidateInLobby'>,
  candidateName: string,
) {
  if (timing.candidatePresence === 'in_call') return `${candidateName} is in the interview room`
  if (timing.candidatePresence === 'left') return `${candidateName} joined earlier and left`
  if (timing.candidateInLobby) return `${candidateName} is in the lobby`
  return 'Waiting for candidate'
}
