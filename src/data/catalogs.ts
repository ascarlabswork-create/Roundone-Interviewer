import { getTimezoneOptions } from '../lib/timezones.ts'

export const INTERVIEW_TYPES = [
  'Coding',
  'System Design',
  'Behavioral',
  'Machine Learning',
  'Product',
  'Data Science',
  'Technical Round',
] as const

export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const CANDIDATE_LEVELS = [
  'Intern',
  'New Grad',
  'Junior',
  'SDE 1',
  'SDE 2',
  'SDE 3',
  'Senior',
  'Staff',
  'Senior Staff',
  'Principal',
  'Lead',
  'Engineering Manager',
] as const

export type CandidateLevel = (typeof CANDIDATE_LEVELS)[number]

export const TARGET_ROLES = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Mobile Engineer',
  'iOS Engineer',
  'Android Engineer',
  'DevOps Engineer',
  'Site Reliability Engineer',
  'Data Engineer',
  'ML Engineer',
  'AI Engineer',
  'Data Scientist',
  'Data Analyst',
  'Security Engineer',
  'QA Engineer',
  'Cloud Engineer',
  'Solutions Architect',
  'Product Manager',
  'Engineering Manager',
  'Technical Program Manager',
  'UX Designer',
] as const

/** Curated chips shown on welcome / expertise forms (same spirit as the candidate site). */
export const QUICK_ROLES = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Data Scientist',
  'ML Engineer',
  'DevOps Engineer',
  'Product Manager',
] as const

export const QUICK_SKILLS = ['Python', 'Java', 'SQL', 'React', 'Machine Learning', 'System Design'] as const

/** Software / Internet / AI browse groups for role pickers. */
export const SOFTWARE_ROLE_GROUPS = [
  {
    title: 'Software Engineering',
    roles: [
      'Software Engineer',
      'Backend Engineer',
      'Frontend Engineer',
      'Full Stack Engineer',
      'Mobile Engineer',
      'iOS Engineer',
      'Android Engineer',
      'QA Engineer',
    ],
  },
  {
    title: 'Data & Analytics',
    roles: ['Data Analyst', 'Data Scientist', 'Data Engineer'],
  },
  {
    title: 'Machine Learning & AI',
    roles: ['ML Engineer', 'AI Engineer'],
  },
  {
    title: 'Infrastructure & Cloud',
    roles: [
      'DevOps Engineer',
      'Site Reliability Engineer',
      'Cloud Engineer',
      'Security Engineer',
      'Solutions Architect',
    ],
  },
  {
    title: 'Product & Leadership',
    roles: ['Product Manager', 'Engineering Manager', 'Technical Program Manager'],
  },
] as const

export const COMPANIES = [
  'Google',
  'Amazon',
  'Microsoft',
  'Meta',
  'Apple',
  'Netflix',
  'Stripe',
  'Uber',
  'OpenAI',
  'Atlassian',
  'Adobe',
  'Salesforce',
  'Oracle',
  'IBM',
  'LinkedIn',
  'Airbnb',
  'Nvidia',
  'Intel',
  'Cisco',
  'PayPal',
  'Goldman Sachs',
  'JPMorgan',
  'Walmart',
  'Tesla',
  'Snowflake',
  'Databricks',
  'Flipkart',
  'Swiggy',
  'Zomato',
  'Razorpay',
  'Paytm',
  'PhonePe',
  'Zoho',
  'Freshworks',
  'TCS',
  'Infosys',
  'Wipro',
  'Accenture',
] as const

/** Grouped the way candidates list skills on their profiles and resumes. */
export const SKILL_GROUPS = [
  { label: 'Programming', skills: ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'Go', 'SQL'] },
  {
    label: 'Data & Analytics',
    skills: ['Data Analysis', 'Excel', 'Power BI', 'Tableau', 'Pandas', 'NumPy', 'Statistics', 'Data Visualization'],
  },
  {
    label: 'Machine Learning & AI',
    skills: ['Machine Learning', 'Deep Learning', 'Scikit-learn', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision'],
  },
  { label: 'Web & Frontend', skills: ['React', 'Node.js', 'HTML/CSS', 'REST APIs', 'Full-stack Development'] },
  {
    label: 'Backend & Systems',
    skills: ['System Design', 'Backend', 'Distributed Systems', 'Microservices', 'Databases'],
  },
  { label: 'Cloud & DevOps', skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'] },
  { label: 'Core CS', skills: ['DSA', 'OOP'] },
  { label: 'Professional', skills: ['Communication', 'Leadership', 'Product Sense', 'Stakeholder Management'] },
] as const

export const SKILLS: readonly string[] = SKILL_GROUPS.flatMap((group) => group.skills)

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

/** Full IANA list (popular zones first). Used for labels and validation, not a picker. */
export const TIMEZONES = getTimezoneOptions()

export const BUFFER_OPTIONS = [0, 10, 15, 30] as const

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
