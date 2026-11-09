import { describe, expect, it } from 'vitest'
import { verificationKindsRequested } from './verificationFlow.ts'

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
