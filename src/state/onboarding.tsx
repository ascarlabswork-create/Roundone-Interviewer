import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { currentInterviewer } from '../data/interviewer.ts'
import { readSessionJson, writeSessionJson } from '../lib/storage.ts'
import type { OnboardingDraft } from '../types.ts'

const KEY = 'roundone.interviewer.onboarding'

export const emptyDraft = (): OnboardingDraft => ({
  fullName: currentInterviewer.name,
  email: 'rahul.sharma@email.com',
  password: '',
  phone: currentInterviewer.phone,
  company: currentInterviewer.company,
  role: currentInterviewer.currentRole,
  experienceYears: String(currentInterviewer.experienceYears),
  linkedin: currentInterviewer.linkedin,
  photo: currentInterviewer.photo,
  professionalSummary: currentInterviewer.professionalSummary,
  previousCompanies: currentInterviewer.previousCompanies.join(', '),
  skills: [...currentInterviewer.skills],
  technologies: [...currentInterviewer.technologies],
  industries: [...currentInterviewer.industries],
  interviewTypes: [...currentInterviewer.interviewTypes],
  candidateLevels: [...currentInterviewer.candidateLevels],
  targetRoles: [...currentInterviewer.targetRoles],
  firstService: {
    name: 'Coding Mock',
    interviewType: 'Coding',
    durationMin: '60',
    candidateLevels: ['SDE 2', 'Senior'],
    targetRoles: ['Software Engineer'],
    description: 'DSA round with follow-ups on complexity and trade-offs.',
    price: '1000',
    cancellationPolicy: 'Full refund if cancelled 24 hours before the session.',
  },
  timezone: 'Asia/Kolkata',
  saturdayHours: ['18:00', '19:00', '20:00'],
})

type OnboardingContextValue = {
  draft: OnboardingDraft
  update: (patch: Partial<OnboardingDraft>) => void
  reset: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(() => readSessionJson(KEY, emptyDraft()))

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch }
      writeSessionJson(KEY, next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const next = emptyDraft()
    writeSessionJson(KEY, next)
    setDraft(next)
  }, [])

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset])
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}
