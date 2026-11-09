import { describe, expect, it } from 'vitest'
import {
  verificationFullyVerified,
  verificationKindsRequested,
  verificationProfileReady,
  verificationProfileChecks,
} from './verificationFlow.ts'

const account = {
  profile: { full_name: 'Ada Lovelace', is_active: true, id: 'p1', role: 'interviewer' as const, avatar_url: null, timezone: 'UTC' },
  interviewer: {
    id: 'i1',
    profile_id: 'p1',
    headline: 'Engineer',
    bio: 'Summary',
    current_role: 'Staff Engineer',
    company: 'Acme',
    experience_years: 5,
    timezone: 'UTC',
    languages: [],
    is_listed: false,
    whatsapp_phone: null,
  },
  skills: ['Python'],
  targetRoles: ['Backend Engineer'],
  candidateLevels: [],
  verifications: [],
  userId: 'u1',
  email: 'a@example.com',
  linkedin: '',
  phone: '',
}

describe('verificationKindsRequested', () => {
  it('is true only when identity and employment rows exist in the database', () => {
    expect(
      verificationKindsRequested([
        { kind: 'identity', status: 'pending', id: 'a' },
        { kind: 'employment', status: 'pending', id: 'b' },
      ]),
    ).toBe(true)
    expect(
      verificationKindsRequested([
        { kind: 'identity', status: 'pending', id: null },
        { kind: 'employment', status: 'pending', id: 'b' },
      ]),
    ).toBe(false)
  })
})

describe('verificationFullyVerified', () => {
  it('requires identity and employment verified', () => {
    expect(
      verificationFullyVerified([
        { kind: 'identity', status: 'verified', id: '1' },
        { kind: 'employment', status: 'verified', id: '2' },
      ]),
    ).toBe(true)
    expect(
      verificationFullyVerified([
        { kind: 'identity', status: 'pending', id: '1' },
        { kind: 'employment', status: 'verified', id: '2' },
      ]),
    ).toBe(false)
  })
})

describe('verificationProfileChecks', () => {
  it('marks profile ready when checklist items are filled', () => {
    expect(verificationProfileChecks(account).every((row) => row.done)).toBe(true)
    expect(verificationProfileReady(account)).toBe(true)
    expect(verificationProfileReady({ ...account, skills: [] })).toBe(false)
  })
})
