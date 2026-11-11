/** Sessions on jobround.ai are conducted in English only. */
export const INTERVIEW_LANGUAGE = 'English'

export const INTERVIEW_LANGUAGES = [INTERVIEW_LANGUAGE] as const

export function interviewLanguagesForStorage(): string[] {
  return [...INTERVIEW_LANGUAGES]
}

export function normalizeInterviewLanguages(_languages?: string[] | null): string[] {
  return interviewLanguagesForStorage()
}
