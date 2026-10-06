import { validateInterviewMessage } from '../lib/interviewRoomExtras.ts'
import { supabase } from '../lib/supabase.ts'
import type { RealtimeClientLike } from './bookingRealtime.ts'
import { TABLES } from './tables.ts'

export type InterviewChatMessage = {
  id: string
  sessionId: string
  senderUserId: string
  message: string
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseInterviewMessage(value: unknown): InterviewChatMessage | null {
  if (!isRecord(value)) return null
  const id = value.id
  const sessionId = value.interview_session_id
  const senderUserId = value.sender_user_id
  const message = value.message
  const createdAt = value.created_at
  if (
    typeof id !== 'string' ||
    typeof sessionId !== 'string' ||
    typeof senderUserId !== 'string' ||
    typeof message !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }
  return { id, sessionId, senderUserId, message, createdAt }
}

export async function listInterviewMessages(sessionId: string): Promise<InterviewChatMessage[]> {
  const { data, error } = await supabase
    .from(TABLES.interviewMessages)
    .select('id, interview_session_id, sender_user_id, message, created_at')
    .eq('interview_session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw new Error('Could not load interview chat.')
  return (data ?? []).map(parseInterviewMessage).filter((row): row is InterviewChatMessage => row !== null)
}

export async function sendInterviewMessage(sessionId: string, raw: string): Promise<InterviewChatMessage> {
  const parsed = validateInterviewMessage(raw)
  if (!parsed.ok) throw new Error(parsed.error)
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('You need to sign in to send a message.')
  const { data, error } = await supabase
    .from(TABLES.interviewMessages)
    .insert({
      interview_session_id: sessionId,
      sender_user_id: userData.user.id,
      message: parsed.message,
    })
    .select('id, interview_session_id, sender_user_id, message, created_at')
    .single()
  if (error) throw new Error('Could not send this message.')
  const row = parseInterviewMessage(data)
  if (!row) throw new Error('Could not send this message.')
  return row
}

export function watchInterviewMessages(
  sessionId: string,
  onMessage: (message: InterviewChatMessage) => void,
  client: RealtimeClientLike = supabase as unknown as RealtimeClientLike,
): { unsubscribe: () => void } {
  let closed = false
  const channel = client
    .channel(`interview-messages:${sessionId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.interviewMessages,
        filter: `interview_session_id=eq.${sessionId}`,
      },
      (payload) => {
        if (closed) return
        const row = parseInterviewMessage(payload.new)
        if (row && row.sessionId === sessionId) onMessage(row)
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
