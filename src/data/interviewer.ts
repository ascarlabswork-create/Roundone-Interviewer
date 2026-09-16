import type { InterviewerProfile } from '../types.ts'
import { seedServices } from './services.ts'

export const CURRENT_INTERVIEWER_ID = 'rahul-sharma'

export const currentInterviewer: InterviewerProfile = {
  id: CURRENT_INTERVIEWER_ID,
  name: 'Rahul Sharma',
  email: 'rahul.sharma@google.com',
  phone: '+91 98765 43210',
  photo: '/avatars/rahul.svg',
  currentRole: 'Staff Software Engineer',
  company: 'Google',
  experienceYears: 8,
  professionalSummary:
    'Staff engineer on Google Cloud storage. Rahul has run 400+ mock interviews for SDE 2 through Staff candidates, with a focus on realistic system design loops used at Google, Amazon, and Uber.',
  skills: ['System Design', 'Backend', 'Distributed Systems', 'Microservices'],
  technologies: ['Java', 'AWS', 'Kubernetes', 'Go'],
  industries: ['Cloud Infrastructure', 'Developer Tools'],
  interviewTypes: ['System Design', 'Coding', 'Behavioral'],
  candidateLevels: ['SDE 2', 'Senior', 'Staff'],
  targetRoles: ['Software Engineer', 'Backend Engineer'],
  rating: 4.9,
  reviewCount: 234,
  completedInterviews: 428,
  completionRate: 98,
  satisfactionRate: 97,
  currency: 'INR',
  services: seedServices,
  timezone: 'Asia/Kolkata',
  languages: ['English', 'Hindi'],
  previousCompanies: ['Amazon', 'Microsoft'],
  verification: {
    identity: 'verified',
    employment: 'verified',
    professionalEmail: 'pending',
  },
  bio: 'Staff engineer on Google Cloud storage. Sessions end with a written scorecard and a recommended practice plan.',
  linkedin: 'https://linkedin.com/in/rahul-sharma',
  profileCompleteness: 92,
}

export function isFullyVerified(profile: InterviewerProfile) {
  return (
    profile.verification.identity === 'verified' &&
    profile.verification.employment === 'verified'
  )
}
