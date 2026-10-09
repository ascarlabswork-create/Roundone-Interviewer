import { isRecordingActive, parseRecordingStatus, type InterviewRecordingStatus } from '../lib/interviewRoomExtras.ts'
import { createComputerSaveTarget, SaveCancelledError } from '../lib/saveToComputer.ts'
import { supabase } from '../lib/supabase.ts'
import type { RealtimeClientLike } from './bookingRealtime.ts'
import { TABLES } from './tables.ts'

export const CONTROL_INTERVIEW_RECORDING_FUNCTION = 'interview-recording'

export type InterviewRecordingState = {
  recordingId: string | null
  status: InterviewRecordingStatus
  startedAt: string | null
  endedAt: string | null
  storagePath: string | null
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
    storagePath: typeof value.storage_path === 'string' ? value.storage_path : null,
    unconfigured: status === 'unavailable',
  }
}

const IDLE_RECORDING: InterviewRecordingState = {
  recordingId: null,
  status: 'idle',
  startedAt: null,
  endedAt: null,
  storagePath: null,
  unconfigured: false,
}

export async function getLatestInterviewRecording(sessionId: string): Promise<InterviewRecordingState> {
  const { data, error } = await supabase
    .from(TABLES.interviewRecordings)
    .select('id, status, started_at, stopped_at, storage_path')
    .eq('interview_session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Could not load recording status.')
  return parseInterviewRecordingRow(data) ?? IDLE_RECORDING
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
      return { ...IDLE_RECORDING, status: 'unavailable', unconfigured: true }
    }
    if (code === 'not_authorized') throw new Error('You are not allowed to control recording for this interview.')
    if (code === 'recording_not_active' || code === 'not_recording') throw new Error('Recording is not active.')
    if (code === 'recording_not_saved') throw new Error('No recording file is available to save yet.')
    throw new Error('Could not update recording.')
  }
  const status = parseRecordingStatus(isRecord(data) ? data.status : null) ?? 'idle'
  return {
    recordingId: isRecord(data) && typeof data.recording_id === 'string' ? data.recording_id : null,
    status,
    startedAt: isRecord(data) ? readTimestamp(data.started_at) : null,
    endedAt: isRecord(data) ? (readTimestamp(data.stopped_at) ?? readTimestamp(data.ended_at)) : null,
    storagePath: isRecord(data) && typeof data.storage_path === 'string' ? data.storage_path : null,
    unconfigured: status === 'unavailable',
  }
}

export async function startInterviewRecording(sessionId: string) {
  return invokeRecording(sessionId, 'start')
}

export async function stopInterviewRecording(sessionId: string) {
  return invokeRecording(sessionId, 'stop')
}

const NOT_READY_MESSAGE = 'No recording file is available to save yet. Stop recording, wait a few seconds, then try again.'
const READY_POLL_MS = 3000

export class RecordingNotReadyError extends Error {
  constructor() {
    super(NOT_READY_MESSAGE)
    this.name = 'RecordingNotReadyError'
  }
}

async function requestRecordingUrl(sessionId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke(CONTROL_INTERVIEW_RECORDING_FUNCTION, {
    body: { interview_session_id: sessionId, action: 'save' },
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
    if (code === 'recording_not_saved' || code === 'recording_processing' || error.message?.includes('404') || error.message?.includes('409')) {
      throw new RecordingNotReadyError()
    }
    if (code === 'not_authorized') throw new Error('You are not allowed to save this recording.')
    throw new Error('Could not save this recording.')
  }
  const url =
    (isRecord(data) && typeof data.url === 'string' && data.url) ||
    (isRecord(data) && typeof data.download_url === 'string' && data.download_url) ||
    ''
  if (!url) throw new RecordingNotReadyError()
  return url
}

type SaveTarget = { write(blob: Blob): Promise<void> }

/** Writes the stored recording to a location the user already chose, optionally waiting for the file to finish processing. */
export async function writeInterviewRecording(sessionId: string, target: SaveTarget, waitMs = 0) {
  const deadline = Date.now() + waitMs
  let url = ''
  for (;;) {
    try {
      url = await requestRecordingUrl(sessionId)
      break
    } catch (error) {
      if (!(error instanceof RecordingNotReadyError) || Date.now() >= deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS))
    }
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not download this recording.')
  await target.write(await response.blob())
}

export function chooseRecordingSaveLocation(suggestedName = 'interview-recording.mp4') {
  return createComputerSaveTarget(suggestedName, 'video/mp4')
}

export async function saveInterviewRecording(sessionId: string, suggestedName = 'interview-recording.mp4') {
  const target = await chooseRecordingSaveLocation(suggestedName)
  await writeInterviewRecording(sessionId, target)
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

export { isRecordingActive, SaveCancelledError }
