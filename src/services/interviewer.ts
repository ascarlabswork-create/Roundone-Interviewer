import { getInterviewerProfile, type InterviewerAccount } from './interviewerProfile.ts'

export type { InterviewerAccount } from './interviewerProfile.ts'

export async function getCurrentInterviewer(options?: { retries?: number }): Promise<InterviewerAccount> {
  return getInterviewerProfile(options)
}
