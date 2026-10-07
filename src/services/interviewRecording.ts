import { isRecordingActive, parseRecordingStatus, type InterviewRecordingStatus } from '../lib/interviewRoomExtras.ts'
import { supabase } from '../lib/supabase.ts'
import type { RealtimeClientLike } from './bookingRealtime.ts'
import { TABLES } from './tables.ts'

export const CONTROL_INTERVIEW_RECORDING_FUNCTION = 'interview-recording'

export type InterviewRecordingState = {
  recordingId: string | null
  status: InterviewRecordingStatus
  startedAt: string | null
  endedAt: string | null
  unconfigured: boolean
}

function readTimestamp(value: unknown) {
  return typeof value === 'string' ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseInterviewRecordingRow(value: unknown): InterviewRecordingState | null {
  if (!isRecord(value)) return null
  const status = parseRecordingStatus(value.status)
  if (!status || status === 'idle') return null
  return {
    recordingId: typeof value.id === 'string' ? value.id : null,
    status,
    startedAt: readTimestamp(value.started_at),
    endedAt: readTimestamp(value.stopped_at) ?? readTimestamp(value.ended_at),
    unconfigured: status === 'unavailable',
  }
}

export async function getLatestInterviewRecording(sessionId: string): Promise<InterviewRecordingState> {
  const { data, error } = await supabase
    .from(TABLES.interviewRecordings)
    .select('id, status, started_at, stopped_at')
    .eq('interview_session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Could not load recording status.')
  return parseInterviewRecordingRow(data) ?? { recordingId: null, status: 'idle', startedAt: null, endedAt: null, unconfigured: false }
}

async function invokeRecording(sessionId: string, action: 'start' | 'stop'): Promise<InterviewRecordingState> {
  const { data, error } = await supabase.functions.invoke(CONTROL_INTERVIEW_RECORDING_FUNCTION, {
    body: { interview_session_id: sessionId, action },
  })
  if (error) {
    const context = error as { context?: Response }
    let code = ''
    try {
      const body = context.context ? await context.context.clone().json() : null
      code = isRecord(body) && typeof body.error === 'string' ? body.error : ''
    } catch {
      code = ''
    }
    if (code === 'unconfigured' || code === 'recording_unconfigured' || error.message?.includes('503')) {
      return { recordingId: null, status: 'unavailable', startedAt: null, endedAt: null, unconfigured: true }
    }
    if (code === 'not_authorized') throw new Error('You are not allowed to control recording for this interview.')
    if (code === 'recording_not_active' || code === 'not_recording') throw new Error('Recording is not active.')
    throw new Error('Could not update recording.')
  }
  const status = parseRecordingStatus(isRecord(data) ? data.status : null) ?? 'idle'
  return {
    recordingId: isRecord(data) && typeof data.recording_id === 'string' ? data.recording_id : null,
    status,
    startedAt: isRecord(data) ? readTimestamp(data.started_at) : null,
    endedAt: isRecord(data) ? (readTimestamp(data.stopped_at) ?? readTimestamp(data.ended_at)) : null,
    unconfigured: status === 'unavailable',
  }
}

export async function startInterviewRecording(sessionId: string) {
  return invokeRecording(sessionId, 'start')
}

export async function stopInterviewRecording(sessionId: string) {
  return invokeRecording(sessionId, 'stop')
}

export function watchInterviewRecording(
  sessionId: string,
  onChange: (state: InterviewRecordingState) => void,
  client: RealtimeClientLike = supabase as unknown as RealtimeClientLike,
): { unsubscribe: () => void } {
  let closed = false
  const channel = client
    .channel(`interview-recording:${sessionId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLES.interviewRecordings, filter: `interview_session_id=eq.${sessionId}` },
      (payload) => {
        if (closed) return
        const next = parseInterviewRecordingRow(payload.new)
        if (next) onChange(next)
      },
    )
  channel.subscribe(() => {})
  return {
    unsubscribe: () => {
      if (closed) return
      closed = true
      void client.removeChannel(channel)
    },
  }
}

export { isRecordingActive }
