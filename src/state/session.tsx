import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getCurrentUser, onAuthStateChange, signOut as signOutRequest } from '../services/auth.ts'
import { getCurrentInterviewer, type InterviewerAccount } from '../services/interviewer.ts'
import {
  getMyProfile,
  hydrateInterviewerSignupFromMetadata,
  type ProfileRole,
} from '../services/interviewerProfile.ts'

type SessionStatus = 'loading' | 'anonymous' | 'authenticated'

export type SessionProfile = {
  id: string
  role: ProfileRole
  full_name: string
}

type SessionContextValue = {
  status: SessionStatus
  user: User | null
  profile: SessionProfile | null
  account: InterviewerAccount | null
  error: string | null
  refreshAccount: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SessionProfile | null>(null)
  const [account, setAccount] = useState<InterviewerAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyUser = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setUser(null)
      setProfile(null)
      setAccount(null)
      setError(null)
      setStatus('anonymous')
      return
    }

    setUser(nextUser)
    setStatus('authenticated')
    try {
      const nextProfile = await getMyProfile()
      setProfile(nextProfile)

      if (nextProfile.role === 'admin') {
        setAccount(null)
        setError(null)
        return
      }

      if (nextProfile.role !== 'interviewer') {
        setAccount(null)
        setError('This Interviewer app only supports interviewer accounts.')
        return
      }

      const nextAccount = await getCurrentInterviewer({ retries: 6 })
      let hydrated = nextAccount
      try {
        hydrated = await hydrateInterviewerSignupFromMetadata(nextAccount)
      } catch {
        hydrated = nextAccount
      }
      setAccount(hydrated)
      setError(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load your profile.'
      setProfile(null)
      setAccount(null)
      setError(message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void getCurrentUser()
      .then((current) => {
        if (!cancelled) return applyUser(current)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setStatus('anonymous')
        setError(caught instanceof Error ? caught.message : 'Could not restore your session.')
      })

    const unsubscribe = onAuthStateChange((nextUser) => {
      if (!cancelled) void applyUser(nextUser)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applyUser])

  const refreshAccount = useCallback(async () => {
    const current = await getCurrentUser()
    await applyUser(current)
  }, [applyUser])

  const signOut = useCallback(async () => {
    await signOutRequest()
    setUser(null)
    setProfile(null)
    setAccount(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, profile, account, error, refreshAccount, signOut }),
    [status, user, profile, account, error, refreshAccount, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used within SessionProvider')
  return session
}
