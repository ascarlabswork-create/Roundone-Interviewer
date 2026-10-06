import { validateInterviewNotes } from '../lib/interviewRoomExtras.ts'
import { supabase } from '../lib/supabase.ts'
import { TABLES } from './tables.ts'

export type InterviewNotesRecord = {
  id: string
  sessionId: string
  notes: string
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseInterviewNotes(value: unknown): InterviewNotesRecord | null {
  if (!isRecord(value)) return null
  const id = value.id
  const sessionId = value.interview_session_id
  const notes = value.notes
  const updatedAt = value.updated_at
  if (typeof id !== 'string' || typeof sessionId !== 'string' || typeof notes !== 'string' || typeof updatedAt !== 'string') {
    return null
  }
  return { id, sessionId, notes, updatedAt }
}

export async function getMyInterviewNotes(sessionId: string): Promise<InterviewNotesRecord | null> {
  const { data, error } = await supabase
    .from(TABLES.interviewNotes)
    .select('id, interview_session_id, notes, updated_at')
    .eq('interview_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error('Could not load your interview notes.')
  return parseInterviewNotes(data)
}

export async function saveMyInterviewNotes(sessionId: string, raw: string): Promise<InterviewNotesRecord> {
  const parsed = validateInterviewNotes(raw)
  if (!parsed.ok) throw new Error(parsed.error)
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('You need to sign in to save notes.')
  const { data, error } = await supabase
    .from(TABLES.interviewNotes)
    .upsert(
      { interview_session_id: sessionId, user_id: userData.user.id, notes: parsed.notes },
      { onConflict: 'interview_session_id,user_id' },
    )
    .select('id, interview_session_id, notes, updated_at')
    .single()
  if (error) throw new Error('Could not save your notes.')
  const row = parseInterviewNotes(data)
  if (!row) throw new Error('Could not save your notes.')
  return row
}
