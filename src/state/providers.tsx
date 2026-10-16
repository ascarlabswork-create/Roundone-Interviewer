import type { ReactNode } from 'react'
import { CookieConsentProvider } from './cookieConsent.tsx'
import { OnboardingProvider } from './onboarding.tsx'
import { SessionProvider } from './session.tsx'
import { ToastProvider } from './toast.tsx'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider>
      <SessionProvider>
        <OnboardingProvider>
          <ToastProvider>{children}</ToastProvider>
        </OnboardingProvider>
      </SessionProvider>
    </CookieConsentProvider>
  )
}
