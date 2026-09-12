import type { InterviewerFeedback } from '../types.ts'
import { CURRENT_INTERVIEWER_ID } from './interviewer.ts'

export const seedInterviewerFeedback: InterviewerFeedback[] = [
  {
    id: 'fb-aditi',
    bookingId: 'bk-completed-aditi',
    interviewerId: CURRENT_INTERVIEWER_ID,
    candidateId: 'cand-aditi',
    visibility: 'private',
    scores: {
      technicalSkills: 8,
      problemSolving: 8,
      communication: 7,
      systemDesign: 6,
      coding: 8,
      behavioral: 7,
      overallPerformance: 8,
    },
    strengths: ['Strong coding approach', 'Good technical fundamentals'],
    improvements: ['Complexity analysis', 'System design depth'],
    detailedFeedback:
      'Coding is at the SDE 2 bar. System design is the remaining gap. Keep coding sharp and schedule a dedicated design interview next.',
    nextSteps:
      'Two graph problems a day for 10 days, then a 60-minute system design mock focused on estimates.',
    readiness: 'Almost Ready',
    submittedAt: '2026-09-01T13:00:00.000Z',
  },
  {
    id: 'fb-meera',
    bookingId: 'bk-completed-meera',
    interviewerId: CURRENT_INTERVIEWER_ID,
    candidateId: 'cand-meera',
    visibility: 'private',
    scores: {
      technicalSkills: 8,
      problemSolving: 7,
      communication: 8,
      systemDesign: 7,
      coding: 7,
      behavioral: 7,
      overallPerformance: 8,
    },
    strengths: ['Clear communication', 'Good system design structure'],
    improvements: ['Scalability', 'Trade-offs'],
    detailedFeedback:
      'The skeleton of the design was sound, but estimates arrived late. Another focused system design mock should lock this in.',
    nextSteps: 'Practice URL shortener and news feed with a 4-minute estimate block at the start.',
    readiness: 'Almost Ready',
    submittedAt: '2026-08-22T12:30:00.000Z',
  },
]
