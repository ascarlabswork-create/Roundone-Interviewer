import { describe, expect, it } from 'vitest'
import { headlineCoversRole, professionalTitleLines } from './professionalTitle.ts'

describe('professionalTitleLines', () => {
  it('does not repeat the role when headline already starts with it', () => {
    expect(
      professionalTitleLines({
        headline: 'software Engineer · System Design',
        currentRole: 'software Engineer',
        company: 'asc',
      }),
    ).toEqual({
      headline: 'software Engineer · System Design',
      detail: '',
    })
  })

  it('hides headline when it only duplicates the role and never shows company', () => {
    expect(
      professionalTitleLines({
        headline: 'Software Engineer',
        currentRole: 'software engineer',
        company: 'Acme',
      }),
    ).toEqual({
      headline: '',
      detail: 'software engineer',
    })
  })

  it('keeps both lines when headline is unrelated to the role', () => {
    expect(
      professionalTitleLines({
        headline: 'Helping teams hire better',
        currentRole: 'Staff Engineer',
        company: 'Acme',
      }),
    ).toEqual({
      headline: 'Helping teams hire better',
      detail: 'Staff Engineer',
    })
  })

  it('keeps a role@company headline as-is and still omits a company detail line', () => {
    expect(
      professionalTitleLines({
        headline: 'Engineer @ Asc Labs',
        currentRole: 'Engineer',
        company: 'Asc Labs',
      }),
    ).toEqual({
      headline: 'Engineer @ Asc Labs',
      detail: '',
    })
  })
})

describe('headlineCoversRole', () => {
  it('matches common separators after the role', () => {
    expect(headlineCoversRole('Software Engineer · System Design', 'Software Engineer')).toBe(true)
    expect(headlineCoversRole('Software Engineer - Backend', 'Software Engineer')).toBe(true)
    expect(headlineCoversRole('software Engineer·System Design', 'software Engineer')).toBe(true)
    expect(headlineCoversRole('Product Manager', 'Software Engineer')).toBe(false)
  })
})
