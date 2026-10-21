import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import {
  OAUTH_CALLBACK_PATH,
  PASSWORD_RESET_PATH,
  buildAppUrl,
  buildEmailAuthRedirect,
  interpretSignUpResponse,
} from './auth.ts'

describe('buildAppUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses VITE_PUBLIC_APP_URL for email and reset links', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://experts.jobround.ai')
    expect(buildAppUrl(PASSWORD_RESET_PATH)).toBe('https://experts.jobround.ai/interviewer/reset-password')
    expect(buildAppUrl(OAUTH_CALLBACK_PATH, { next: '/interviewer/setup' })).toBe(
      'https://experts.jobround.ai/interviewer/auth/callback?next=%2Finterviewer%2Fsetup',
    )
  })
})

describe('buildEmailAuthRedirect', () => {
  it('uses the browser origin when available', () => {
    vi.stubGlobal('window', { location: { origin: 'https://experts.jobround.ai' } })
    expect(buildEmailAuthRedirect('/interviewer/setup')).toBe(
      'https://experts.jobround.ai/interviewer/auth/callback?next=%2Finterviewer%2Fsetup',
    )
    vi.unstubAllGlobals()
  })
})

describe('interpretSignUpResponse', () => {
  const baseUser = { id: 'u1', email: 'a@example.com' } as User

  it('treats an existing email signup as an error instead of a fake confirmation', () => {
    expect(() => interpretSignUpResponse({ user: { ...baseUser, identities: [] }, session: null })).toThrow(
      /already exists/i,
    )
  })

  it('requires confirmation when identities exist and there is no session', () => {
    const result = interpretSignUpResponse({
      user: { ...baseUser, identities: [{ id: 'id1' }] as User['identities'] },
      session: null,
    })
    expect(result.needsEmailConfirmation).toBe(true)
  })
})
