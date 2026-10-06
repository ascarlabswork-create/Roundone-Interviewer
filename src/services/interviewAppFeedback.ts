import { validateAppFeedbackInput } from '../lib/interviewRoomExtras.ts'
import { supabase } from '../lib/supabase.ts'
import { TABLES } from './tables.ts'

export type InterviewAppFeedbackRecord = {
  id: string
  sessionId: string
  rating: number | null
  feedback: string | null
  suggestions: string | null
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseInterviewAppFeedback(value: unknown): InterviewAppFeedbackRecord | null {
  if (!isRecord(value)) return null
  const id = value.id
  const sessionId = value.interview_session_id
  const rating = value.rating
  const feedback = value.feedback
  const suggestions = value.suggestions
  const updatedAt = value.updated_at
  if (typeof id !== 'string' || typeof sessionId !== 'string' || typeof updatedAt !== 'string') return null
  return {
    id,
    sessionId,
    rating: typeof rating === 'number' ? rating : null,
    feedback: typeof feedback === 'string' ? feedback : null,
    suggestions: typeof suggestions === 'string' ? suggestions : null,
    updatedAt,
  }
}

export async function getMyInterviewAppFeedback(sessionId: string): Promise<InterviewAppFeedbackRecord | null> {
  const { data, error } = await supabase
    .from(TABLES.interviewAppFeedback)
    .select('id, interview_session_id, rating, feedback, suggestions, updated_at')
    .eq('interview_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error('Could not load your RoundOne feedback.')
  return parseInterviewAppFeedback(data)
}

export async function saveMyInterviewAppFeedback(
  sessionId: string,
  input: { rating: number | null; feedback: string; suggestions: string },
): Promise<InterviewAppFeedbackRecord> {
  const parsed = validateAppFeedbackInput(input)
  if (!parsed.ok) throw new Error(parsed.error)
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('You need to sign in to save RoundOne feedback.')
  const { data, error } = await supabase
    .from(TABLES.interviewAppFeedback)
    .upsert(
      {
        interview_session_id: sessionId,
        user_id: userData.user.id,
        participant_role: 'interviewer',
        rating: parsed.rating,
        feedback: parsed.feedback,
        suggestions: parsed.suggestions,
      },
      { onConflict: 'interview_session_id,user_id' },
    )
    .select('id, interview_session_id, rating, feedback, suggestions, updated_at')
    .single()
  if (error) throw new Error('Could not save your RoundOne feedback.')
  const row = parseInterviewAppFeedback(data)
  if (!row) throw new Error('Could not save your RoundOne feedback.')
  return row
}
