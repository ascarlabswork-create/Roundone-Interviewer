import { describe, expect, it } from 'vitest'
import {
  clearPasswordRecoveryPending,
  isAuthRecoveryUrl,
  isInPasswordRecoveryFlow,
  isPasswordRecoveryPending,
  markPasswordRecoveryPending,
} from './authRecovery.ts'

describe('isAuthRecoveryUrl', () => {
  it('detects recovery in the URL hash', () => {
    expect(
      isAuthRecoveryUrl(
        'https://experts.jobround.ai/interviewer/auth/callback#access_token=abc&type=recovery&expires_in=3600',
      ),
    ).toBe(true)
  })

  it('detects recovery in the query string', () => {
    expect(isAuthRecoveryUrl('https://experts.jobround.ai/interviewer/reset-password?type=recovery&code=xyz')).toBe(true)
  })

  it('returns false for ordinary sign-in redirects', () => {
    expect(isAuthRecoveryUrl('https://experts.jobround.ai/interviewer/auth/callback?code=oauth')).toBe(false)
  })
})

describe('password recovery session flag', () => {
  it('tracks recovery after the URL hash is cleared', () => {
    clearPasswordRecoveryPending()
    expect(isPasswordRecoveryPending()).toBe(false)
    markPasswordRecoveryPending()
    expect(isInPasswordRecoveryFlow()).toBe(true)
    clearPasswordRecoveryPending()
    expect(isInPasswordRecoveryFlow()).toBe(false)
  })
})
