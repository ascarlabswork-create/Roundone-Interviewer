import { afterEach, describe, expect, it, vi } from 'vitest'
import { OAUTH_CALLBACK_PATH, PASSWORD_RESET_PATH, buildAppUrl } from './auth.ts'

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
