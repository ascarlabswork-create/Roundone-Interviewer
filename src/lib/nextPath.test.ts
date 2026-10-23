import { describe, expect, it } from 'vitest'
import { destinationForRole, safeNextPath } from './nextPath.ts'

describe('safeNextPath', () => {
  it('keeps interviewer routes', () => {
    expect(safeNextPath('/interviewer/setup?step=professional')).toBe('/interviewer/setup?step=professional')
    expect(safeNextPath('/interviewer/dashboard')).toBe('/interviewer/dashboard')
  })

  it('rejects candidate website paths', () => {
    expect(safeNextPath('/candidate/login')).toBe('/interviewer/dashboard')
    expect(safeNextPath('/candidate/auth/callback')).toBe('/interviewer/dashboard')
    expect(safeNextPath('/')).toBe('/interviewer/dashboard')
  })
})

describe('destinationForRole', () => {
  it('never sends an interviewer to a candidate route', () => {
    expect(destinationForRole('interviewer', '/candidate/login')).toBe('/interviewer/dashboard')
    expect(destinationForRole('interviewer', '/interviewer/setup?step=professional')).toBe(
      '/interviewer/setup?step=professional',
    )
  })
})
