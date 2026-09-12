import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { currentInterviewer } from '../data/interviewer.ts'
import type { InterviewerProfile } from '../types.ts'

const SessionContext = createContext<InterviewerProfile | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => currentInterviewer, [])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used within SessionProvider')
  return session
}
