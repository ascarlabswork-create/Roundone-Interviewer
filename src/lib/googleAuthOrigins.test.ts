import { describe, expect, it } from 'vitest'
import { googleOAuthOriginAllowlist, isGoogleIdentityOriginAllowed } from './googleAuthOrigins.ts'

describe('googleOAuthOriginAllowlist', () => {
  it('includes local dev and production interviewer origins', () => {
    const list = googleOAuthOriginAllowlist()
    expect(list).toContain('http://localhost:5174')
    expect(list).toContain('https://experts.jobround.ai')
  })
})

describe('isGoogleIdentityOriginAllowed', () => {
  it('allows built-in production origin', () => {
    expect(isGoogleIdentityOriginAllowed('https://experts.jobround.ai')).toBe(true)
  })

  it('blocks unregistered preview origins until configured', () => {
    expect(isGoogleIdentityOriginAllowed('https://roundone-interviewer-git-main.vercel.app')).toBe(false)
  })
})
