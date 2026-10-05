import { describe, expect, it } from 'vitest'
import { NETWORK_ERROR_MESSAGE, toDisplayError } from './networkError.ts'

describe('toDisplayError', () => {
  it('replaces timeouts, dropped connections and gateway pages with a readable message', () => {
    expect(toDisplayError('TimeoutError: signal timed out')).toBe(NETWORK_ERROR_MESSAGE)
    expect(toDisplayError('TypeError: Failed to fetch')).toBe(NETWORK_ERROR_MESSAGE)
    expect(toDisplayError('AuthRetryableFetchError: Failed to fetch')).toBe(NETWORK_ERROR_MESSAGE)
    expect(toDisplayError('<!DOCTYPE html><html><title>522: Connection timed out</title>')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('keeps app messages as they are', () => {
    expect(toDisplayError('Service not found.')).toBe('Service not found.')
    expect(toDisplayError('This date is outside your available date range.')).toBe(
      'This date is outside your available date range.',
    )
  })
})
