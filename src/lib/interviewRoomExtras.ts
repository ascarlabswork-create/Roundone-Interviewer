export const INTERVIEW_MESSAGE_MAX_LENGTH = 2000
export const INTERVIEW_NOTES_MAX_LENGTH = 20_000
export const INTERVIEW_APP_FEEDBACK_MAX_LENGTH = 4000

export function normalizeInterviewMessage(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

export function validateInterviewMessage(value: string) {
  const message = normalizeInterviewMessage(value)
  if (!message) return { ok: false as const, error: 'Message cannot be empty.' }
  if (message.length > INTERVIEW_MESSAGE_MAX_LENGTH) {
    return { ok: false as const, error: `Messages can be at most ${INTERVIEW_MESSAGE_MAX_LENGTH} characters.` }
  }
  return { ok: true as const, message }
}

export function validateInterviewNotes(value: string) {
  if (value.length > INTERVIEW_NOTES_MAX_LENGTH) {
    return { ok: false as const, error: `Notes can be at most ${INTERVIEW_NOTES_MAX_LENGTH} characters.` }
  }
  return { ok: true as const, notes: value }
}

export function validateAppFeedbackInput(input: {
  rating: number | null
  feedback: string
  suggestions: string
}) {
  if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
    return { ok: false as const, error: 'Rating must be between 1 and 5.' }
  }
  const feedback = input.feedback.trim()
  const suggestions = input.suggestions.trim()
  if (feedback.length > INTERVIEW_APP_FEEDBACK_MAX_LENGTH || suggestions.length > INTERVIEW_APP_FEEDBACK_MAX_LENGTH) {
    return { ok: false as const, error: 'Feedback is too long.' }
  }
  if (input.rating === null && !feedback && !suggestions) {
    return { ok: false as const, error: 'Add a rating or a comment before submitting.' }
  }
  return {
    ok: true as const,
    rating: input.rating,
    feedback,
    suggestions,
  }
}

export type InterviewRecordingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'unavailable'

export const ACTIVE_RECORDING_STATUSES: readonly InterviewRecordingStatus[] = ['starting', 'recording', 'stopping']

export function isRecordingActive(status: InterviewRecordingStatus) {
  return ACTIVE_RECORDING_STATUSES.includes(status)
}

export function parseRecordingStatus(value: unknown): InterviewRecordingStatus | null {
  if (typeof value !== 'string') return null
  if (
    value === 'idle' ||
    value === 'starting' ||
    value === 'recording' ||
    value === 'stopping' ||
    value === 'stopped' ||
    value === 'failed' ||
    value === 'unavailable'
  ) {
    return value
  }
  return null
}
