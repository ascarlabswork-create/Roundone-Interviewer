/** Shared Roundone tables used by the Interviewer app. */
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
  sessionEvents: 'session_events',
  interviewerFeedback: 'interviewer_feedback',
  candidateReviews: 'candidate_reviews',
  candidateReviewsPublic: 'candidate_reviews_public',
  notifications: 'notifications',
  notificationPreferences: 'notification_preferences',
  payments: 'payments',
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]
