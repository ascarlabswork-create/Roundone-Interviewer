/** Future Supabase table names for the Interviewer app. Do not query from UI yet. */
export const TABLES = {
  profiles: 'profiles',
  interviewerProfiles: 'interviewer_profiles',
  interviewerSkills: 'interviewer_skills',
  interviewerRoles: 'interviewer_roles',
  interviewerServices: 'interviewer_services',
  interviewerAvailability: 'interviewer_availability',
  interviewerCustomSlots: 'interviewer_custom_slots',
  interviewerBlockedTimes: 'interviewer_blocked_times',
  interviewerVerifications: 'interviewer_verifications',
  bookings: 'bookings',
  bookingCandidateSummary: 'booking_candidate_summary',
  interviewSessions: 'interview_sessions',
  interviewerFeedback: 'interviewer_feedback',
  candidateReviews: 'candidate_reviews',
  notifications: 'notifications',
  payments: 'payments',
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]
