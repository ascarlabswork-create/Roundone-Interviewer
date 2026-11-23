import { describe, expect, it } from 'vitest'
import {
  isInterviewWelcomePlaceholder,
  landingPathForAccount,
  needsInterviewWelcome,
  welcomeBio,
  welcomeHeadline,
} from './interviewWelcome.ts'

const ready = {
  skills: ['Python'],
  targetRoles: ['Backend Engineer'],
  interviewer: {
    current_role: 'Engineering Manager',
    company: 'Acme',
    welcome_completed_at: '2026-11-01T00:00:00.000Z',
  },
}

describe('needsInterviewWelcome', () => {
  it('requires welcome until welcome_completed_at is set', () => {
    expect(needsInterviewWelcome(ready)).toBe(false)
    expect(
      needsInterviewWelcome({
        ...ready,
        interviewer: { ...ready.interviewer, welcome_completed_at: null },
      }),
    ).toBe(true)
    expect(needsInterviewWelcome({ ...ready, skills: [] })).toBe(true)
    expect(needsInterviewWelcome({ ...ready, targetRoles: [] })).toBe(true)
    expect(
      needsInterviewWelcome({
        ...ready,
        interviewer: { current_role: 'Pending', company: 'Pending', welcome_completed_at: null },
      }),
    ).toBe(true)
    expect(
      needsInterviewWelcome({
        ...ready,
        interviewer: { current_role: 'Deleted', company: 'Deleted', welcome_completed_at: null },
      }),
    ).toBe(true)
  })
})

describe('isInterviewWelcomePlaceholder', () => {
  it('treats Pending and soft-deleted job fields as placeholders', () => {
    expect(isInterviewWelcomePlaceholder('Pending', 'Pending')).toBe(true)
    expect(isInterviewWelcomePlaceholder('Deleted', 'Deleted')).toBe(true)
    expect(isInterviewWelcomePlaceholder('Staff Engineer', 'Acme')).toBe(false)
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
    expect(landingPathForAccount('interviewer', { ...ready, skills: [] }, '/interviewer/profile')).toBe(
      '/interviewer/welcome',
    )
  })

  it('keeps a finished profile on the dashboard and leaves live interview deep links alone', () => {
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
      'Coding, System Design',
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
