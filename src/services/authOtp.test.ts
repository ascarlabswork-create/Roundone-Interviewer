import { describe, expect, it } from 'vitest'
import { maskEmailAddress, parseAuthRateLimitSeconds } from './auth.ts'

describe('maskEmailAddress', () => {
  it('masks local and host parts', () => {
    expect(maskEmailAddress('srimadhanduddelly@gmail.com')).toMatch(/^s\*+y@g\*l\.com$/)
  })
})

describe('parseAuthRateLimitSeconds', () => {
  it('reads wait seconds from Supabase rate-limit messages', () => {
    expect(parseAuthRateLimitSeconds('For security purposes, you can only request this after 42 seconds.')).toBe(42)
    expect(parseAuthRateLimitSeconds('Something else')).toBeNull()
  })
})
