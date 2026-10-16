import type { ReactNode } from 'react'
import { CookieConsentUI } from '../components/consent/CookieConsentUI.tsx'
import { CookieConsentProvider } from './cookieConsent.tsx'
import { OnboardingProvider } from './onboarding.tsx'
import { SessionProvider } from './session.tsx'
import { ToastProvider } from './toast.tsx'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider>
      <SessionProvider>
        <OnboardingProvider>
          <ToastProvider>
            {children}
            <CookieConsentUI />
          </ToastProvider>
        </OnboardingProvider>
      </SessionProvider>
    </CookieConsentProvider>
  )
}
