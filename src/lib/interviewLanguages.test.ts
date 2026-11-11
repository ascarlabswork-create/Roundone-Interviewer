import { describe, expect, it } from 'vitest'
import {
  INTERVIEW_LANGUAGE,
  interviewLanguagesForStorage,
  normalizeInterviewLanguages,
} from './interviewLanguages.ts'

describe('interviewLanguages', () => {
  it('always stores English only', () => {
    expect(interviewLanguagesForStorage()).toEqual([INTERVIEW_LANGUAGE])
    expect(normalizeInterviewLanguages(['Hindi', 'English'])).toEqual([INTERVIEW_LANGUAGE])
    expect(normalizeInterviewLanguages(null)).toEqual([INTERVIEW_LANGUAGE])
  })
})
