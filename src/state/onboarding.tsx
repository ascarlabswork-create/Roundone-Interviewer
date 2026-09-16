import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readSessionJson, writeSessionJson } from '../lib/storage.ts'
import type { OnboardingDraft } from '../types.ts'

const KEY = 'roundone.interviewer.onboarding.v3'

export const emptyDraft = (): OnboardingDraft => ({
  firstName: '',
  lastName: '',
  fullName: '',
  email: '',
  password: '',
  phone: '',
  company: '',
  role: '',
  experienceYears: '',
  linkedin: '',
  photo: '',
  professionalSummary: '',
  previousCompanies: '',
  skills: [],
  technologies: [],
  industries: [],
  interviewTypes: [],
  candidateLevels: [],
  targetRoles: [],
  firstService: {
    name: '',
    interviewType: '',
    durationMin: '60',
    candidateLevels: [],
    targetRoles: [],
    description: '',
    price: '1000',
    cancellationPolicy: '',
  },
  timezone: 'Asia/Kolkata',
  languages: '',
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
