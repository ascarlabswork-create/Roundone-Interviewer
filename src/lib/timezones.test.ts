import { describe, expect, it } from 'vitest'
import {
  effectiveSchedulingTimezone,
  formatTimezoneLabel,
  getTimezoneOptions,
  isValidTimezone,
  normalizeTimezoneId,
} from './timezones.ts'

describe('timezones', () => {
  it('accepts common IANA ids including CST and IST', () => {
    expect(isValidTimezone('America/Chicago')).toBe(true)
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
    expect(isValidTimezone('Not/AZone')).toBe(false)
  })

  it('normalizes legacy Calcutta to Kolkata', () => {
    expect(normalizeTimezoneId('Asia/Calcutta')).toBe('Asia/Kolkata')
    expect(isValidTimezone('Asia/Calcutta')).toBe(true)
  })

  it('prefers interviewer timezone for scheduling display', () => {
    expect(effectiveSchedulingTimezone('Asia/Kolkata', 'America/Chicago')).toBe('America/Chicago')
    expect(effectiveSchedulingTimezone('', 'America/Chicago')).toBe('America/Chicago')
  })

  it('lists popular zones before the long tail', () => {
    const options = getTimezoneOptions(Date.parse('2026-06-01T12:00:00Z'))
    const kolkata = options.findIndex((zone) => zone.id === 'Asia/Kolkata')
    const chicago = options.findIndex((zone) => zone.id === 'America/Chicago')
    expect(kolkata).toBeGreaterThanOrEqual(0)
    expect(chicago).toBeGreaterThanOrEqual(0)
    expect(kolkata).toBeLessThan(20)
    expect(chicago).toBeLessThan(20)
    expect(options.length).toBeGreaterThan(50)
  })

  it('formats labels with a UTC offset', () => {
    const label = formatTimezoneLabel('America/Chicago', Date.parse('2026-01-15T18:00:00Z'))
    expect(label).toContain('America/Chicago')
    expect(label).toMatch(/GMT[+-]\d/)
  })
})
