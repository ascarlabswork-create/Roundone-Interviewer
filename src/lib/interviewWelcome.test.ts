import { describe, expect, it } from 'vitest'
import { landingPathForAccount, needsInterviewWelcome, welcomeBio, welcomeHeadline } from './interviewWelcome.ts'

const ready = {
  skills: ['Python'],
  targetRoles: ['Backend Engineer'],
  interviewer: { current_role: 'Engineering Manager', company: 'Acme' },
}

describe('needsInterviewWelcome', () => {
  it('asks when skills, roles, or a real job are still missing', () => {
    expect(needsInterviewWelcome(ready)).toBe(false)
    expect(needsInterviewWelcome({ ...ready, skills: [] })).toBe(true)
    expect(needsInterviewWelcome({ ...ready, targetRoles: [] })).toBe(true)
    expect(
      needsInterviewWelcome({
        ...ready,
        interviewer: { current_role: 'Pending', company: 'Pending' },
      }),
    ).toBe(true)
  })
})

describe('landingPathForAccount', () => {
  it('sends a new interviewer to the welcome page instead of the dashboard', () => {
    expect(landingPathForAccount('interviewer', { ...ready, skills: [] }, '/interviewer/dashboard')).toBe(
      '/interviewer/welcome',
    )
    expect(landingPathForAccount('interviewer', { ...ready, skills: [] }, '/interviewer/setup?step=professional')).toBe(
      '/interviewer/welcome',
    )
  })

  it('keeps a finished profile on the dashboard and leaves deep links alone', () => {
    expect(landingPathForAccount('interviewer', ready, '/interviewer/dashboard')).toBe('/interviewer/dashboard')
    expect(landingPathForAccount('interviewer', { ...ready, skills: [] }, '/interviewer/interview/abc')).toBe(
      '/interviewer/interview/abc',
    )
  })

  it('does not send admins to the interviewer welcome page', () => {
    expect(landingPathForAccount('admin', { ...ready, skills: [] }, '/interviewer/dashboard')).toBe('/admin/dashboard')
  })
})

describe('welcome copy', () => {
  it('builds a headline and bio from the interview focus when the profile is still empty', () => {
    expect(welcomeHeadline('Staff Engineer', ['Coding', 'System Design'], 'Staff Engineer')).toBe(
      'Staff Engineer · Coding, System Design',
    )
    expect(welcomeHeadline('Staff Engineer', ['Coding'], 'I interview backend candidates')).toBe(
      'I interview backend candidates',
    )
    expect(welcomeBio(['Coding'], '')).toBe('I interview candidates on Coding.')
    expect(welcomeBio(['Coding'], 'Ten years of hiring loops.')).toBe(
      'I interview candidates on Coding. Ten years of hiring loops.',
    )
  })
})
