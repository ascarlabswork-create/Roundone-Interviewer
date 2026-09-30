import { supabase } from '../lib/supabase.ts'
import type { RealtimeClientLike } from './bookingRealtime.ts'
import type { ServerAdmissionStatus } from './interviewCallController.ts'
import { TABLES } from './tables.ts'

const ADMISSION_STATUSES: readonly ServerAdmissionStatus[] = ['waiting', 'admitted', 'denied']

export function parseAdmissionStatus(value: unknown): ServerAdmissionStatus | null {
  return typeof value === 'string' && (ADMISSION_STATUSES as readonly string[]).includes(value)
    ? (value as ServerAdmissionStatus)
    : null
}

export async function getInterviewAdmission(sessionId: string): Promise<ServerAdmissionStatus | null> {
  const { data, error } = await supabase
    .from(TABLES.interviewAdmissions)
    .select('status')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error('Could not load the admission status for this call.')
  return parseAdmissionStatus((data as { status?: unknown } | null)?.status)
}

/** Records the interviewer's admit/decline decision for the candidate. */
export async function decideInterviewAdmission(sessionId: string, admit: boolean): Promise<void> {
  const { error } = await supabase.rpc('decide_interview_admission', { p_session_id: sessionId, p_admit: admit })
  if (!error) return
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase()
  if (text.includes('session_expired')) throw new Error('This interview session has ended.')
  if (text.includes('not_authorized') || error.code === '42501') {
    throw new Error('You can only admit candidates to your own interviews.')
  }
  throw new Error('Could not save your admission decision. Try again.')
}

/**
 * Streams the stored admission status for a session (the candidate's knock and
 * any decision), starting with the current value once the channel is live.
 * RLS limits events to the booking's own parties.
 */
export function watchInterviewAdmission(
  sessionId: string,
  onStatus: (status: ServerAdmissionStatus) => void,
  deps: {
    client?: RealtimeClientLike
    load?: (sessionId: string) => Promise<ServerAdmissionStatus | null>
  } = {},
): { unsubscribe: () => void } {
  const client = deps.client ?? (supabase as unknown as RealtimeClientLike)
  const load = deps.load ?? getInterviewAdmission
  let closed = false
  const emit = (status: ServerAdmissionStatus | null) => {
    if (!closed && status) onStatus(status)
  }

  const channel = client
    .channel(`interview-admission:${sessionId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLES.interviewAdmissions, filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const row = payload.new as { session_id?: unknown; status?: unknown } | undefined
        if (row?.session_id === sessionId) emit(parseAdmissionStatus(row.status))
      },
    )
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void load(sessionId).then(emit, () => {})
  })

  return {
    unsubscribe: () => {
      if (closed) return
      closed = true
      void client.removeChannel(channel)
    },
  }
}
