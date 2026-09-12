export const INTERVIEW_TYPES = [
  'Coding',
  'System Design',
  'Behavioral',
  'Machine Learning',
  'Product',
  'Data Science',
] as const

export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const CANDIDATE_LEVELS = [
  'Intern',
  'New Grad',
  'SDE 1',
  'SDE 2',
  'Senior',
  'Staff',
] as const

export type CandidateLevel = (typeof CANDIDATE_LEVELS)[number]

export const TARGET_ROLES = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Data Scientist',
  'ML Engineer',
  'Product Manager',
] as const

export const INDUSTRIES = [
  'Cloud Infrastructure',
  'Consumer Internet',
  'Fintech',
  'Marketplace',
  'Developer Tools',
  'AI / ML',
] as const

export const SKILLS = [
  'System Design',
  'Backend',
  'Distributed Systems',
  'Microservices',
  'DSA',
  'Leadership',
  'Communication',
] as const

export const TECHNOLOGIES = [
  'Java',
  'AWS',
  'Kubernetes',
  'Go',
  'Python',
  'TypeScript',
  'SQL',
] as const

export const ONBOARDING_STEPS = [
  { id: 'account', label: 'Account' },
  { id: 'professional', label: 'Professional Information' },
  { id: 'expertise', label: 'Expertise' },
  { id: 'services', label: 'Services' },
  { id: 'availability', label: 'Availability' },
  { id: 'review', label: 'Review' },
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id']

export const STRENGTH_TAGS = [
  'Strong problem solving',
  'Clear communication',
  'Good technical fundamentals',
  'Strong coding approach',
  'Good system design structure',
] as const

export const IMPROVEMENT_TAGS = [
  'Scalability',
  'Trade-offs',
  'Complexity analysis',
  'Communication',
  'Testing',
  'System design depth',
  'Time management',
] as const

export const REVIEW_DIMENSIONS = [
  { key: 'technicalExpertise', label: 'Technical Expertise' },
  { key: 'communication', label: 'Communication' },
  { key: 'interviewRealism', label: 'Interview Realism' },
  { key: 'feedbackQuality', label: 'Feedback Quality' },
  { key: 'professionalism', label: 'Professionalism' },
] as const

export const TIMEZONES = [
  { id: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { id: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { id: 'America/New_York', label: 'America/New_York (ET)' },
  { id: 'Europe/London', label: 'Europe/London' },
  { id: 'Asia/Singapore', label: 'Asia/Singapore' },
] as const

export const BUFFER_OPTIONS = [0, 10, 15, 30] as const

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
