import type { CandidateLevel, InterviewType } from './data/catalogs.ts'

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'action_required'

export type VerificationKey = 'identity' | 'employment' | 'professionalEmail'

export type Verification = Record<VerificationKey, VerificationStatus>

export type SlotState = 'available' | 'booked' | 'blocked'

/** Generated candidate-visible slot (RoundOne calculates these). */
export type AvailabilitySlot = {
  id: string
  start: string
  end?: string
  durationMin: number
  state: SlotState
  source?: 'recurring' | 'custom'
}

export type BufferMinutes = 0 | 10 | 15 | 30

/** Maps to future `interviewer_availability`. Global plus optional serviceId. */
export type RecurringAvailability = {
  id: string
  interviewerId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  timezone: string
  isActive: boolean
  serviceId?: string | null
}

/** Maps to future `interviewer_custom_slots`. */
export type CustomAvailabilitySlot = {
  id: string
  interviewerId: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  note?: string
  serviceId?: string | null
}

/** Maps to future `interviewer_blocked_times`. */
export type BlockedTime = {
  id: string
  interviewerId: string
  date: string
  startTime: string | null
  endTime: string | null
  allDay: boolean
  reason: string
  timezone: string
}

export type AvailabilitySettings = {
  interviewerId: string
  timezone: string
  defaultDurationMin: number
  bufferMin: BufferMinutes
}

export type AvailabilitySchedule = {
  settings: AvailabilitySettings
  recurring: RecurringAvailability[]
  customSlots: CustomAvailabilitySlot[]
  blockedTimes: BlockedTime[]
}

export type CalendarPeriod = {
  startMin: number
  endMin: number
  state: SlotState
  label?: string
}

export type BookableSlot = {
  id: string
  date: string
  startTime: string
  endTime: string
  start: string
  end: string
  durationMin: number
  source: 'recurring' | 'custom'
}

export type Service = {
  id: string
  name: string
  interviewType: InterviewType
  durationMin: number
  price: number
  description: string
  candidateLevels: CandidateLevel[]
  targetRoles: string[]
  cancellationPolicy: string
  isActive: boolean
}

export type InterviewerProfile = {
  id: string
  name: string
  email: string
  phone: string
  photo: string
  currentRole: string
  company: string
  experienceYears: number
  professionalSummary: string
  skills: string[]
  technologies: string[]
  industries: string[]
  interviewTypes: InterviewType[]
  candidateLevels: CandidateLevel[]
  targetRoles: string[]
  rating: number
  reviewCount: number
  completedInterviews: number
  completionRate: number
  satisfactionRate: number
  currency: 'INR'
  services: Service[]
  timezone: string
  languages: string[]
  previousCompanies: string[]
  verification: Verification
  bio: string
  linkedin: string
  profileCompleteness: number
}

export type ManagedCandidate = {
  id: string
  name: string
  photo: string
  targetRole: string
  experience: string
  targetCompany: string
  interviewType: InterviewType
  skills: string[]
  preparationAreas: string[]
}

export type BookingStatus = 'pending' | 'upcoming' | 'completed' | 'cancelled'

export type Booking = {
  id: string
  interviewerId: string
  candidateId: string
  serviceId: string
  serviceName: string
  interviewType: InterviewType
  durationMin: number
  sessionFee: number
  platformFee: number
  netEarnings: number
  start: string
  timezone: string
  status: BookingStatus
  /** PRIVATE interviewer → candidate feedback for this booking. */
  privateFeedbackStatus: 'pending' | 'submitted' | 'none'
  createdAt: string
}

/** PUBLIC candidate → interviewer reputation. Never mix with private evaluations. */
export type CandidateReview = {
  id: string
  interviewerId: string
  bookingId?: string
  candidateId?: string
  publicDisplayName: string
  rating: number
  date: string
  interviewType: InterviewType
  text: string
  visibility: 'public'
  dimensions: {
    technicalExpertise: number
    communication: number
    interviewRealism: number
    feedbackQuality: number
    professionalism: number
  }
  response?: string
}

export type Readiness = 'Ready' | 'Almost Ready' | 'Needs More Practice'

export type FeedbackScores = {
  technicalSkills: number
  problemSolving: number
  communication: number
  systemDesign: number
  coding: number
  behavioral: number
  overallPerformance: number
}

/** PRIVATE interviewer → candidate evaluation. Never shown on public profiles. */
export type InterviewerFeedback = {
  id: string
  bookingId: string
  interviewerId: string
  candidateId: string
  visibility: 'private'
  scores: FeedbackScores
  strengths: string[]
  improvements: string[]
  detailedFeedback: string
  nextSteps: string
  readiness: Readiness
  submittedAt: string
}

export type PayoutStatus = 'pending' | 'completed'

export type Transaction = {
  id: string
  date: string
  bookingId: string
  candidateId: string
  serviceName: string
  amount: number
  platformFee: number
  netEarnings: number
  payoutStatus: PayoutStatus
}

export type EarningsSummary = {
  today: number
  thisWeek: number
  thisMonth: number
  total: number
  weekly: Array<{ label: string; amount: number }>
}

export type AppNotification = {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  to: string
}

export type OnboardingDraft = {
  firstName: string
  lastName: string
  fullName: string
  email: string
  password: string
  phone: string
  company: string
  role: string
  experienceYears: string
  linkedin: string
  photo: string
  professionalSummary: string
  previousCompanies: string
  skills: string[]
  technologies: string[]
  industries: string[]
  interviewTypes: string[]
  candidateLevels: string[]
  targetRoles: string[]
  firstService: {
    name: string
    interviewType: string
    durationMin: string
    candidateLevels: string[]
    targetRoles: string[]
    description: string
    price: string
    cancellationPolicy: string
  }
  timezone: string
  languages: string
  saturdayHours: string[]
}

export type SettingsDraft = {
  email: string
  phone: string
  timezone: string
  notifyBookings: boolean
  notifyReviews: boolean
  notifyPayouts: boolean
  payoutMethod: 'upi' | 'bank'
  payoutDetail: string
  publicProfile: boolean
}
