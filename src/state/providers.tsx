import type { ReactNode } from 'react'
import { OnboardingProvider } from './onboarding.tsx'
import { SessionProvider } from './session.tsx'
import { ToastProvider } from './toast.tsx'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingProvider>
        <ToastProvider>{children}</ToastProvider>
      </OnboardingProvider>
    </SessionProvider>
  )
}
