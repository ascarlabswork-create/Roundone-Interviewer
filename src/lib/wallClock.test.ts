import { describe, expect, it } from 'vitest'
import { clock24hFromParts, clockPartsFrom24h } from './dates.ts'

describe('wall clock conversion', () => {
  it.each([
    ['00:00', 12, 0, 'AM', '00:00'],
    ['00:30', 12, 30, 'AM', '00:30'],
    ['09:15', 9, 15, 'AM', '09:15'],
    ['11:59', 11, 59, 'AM', '11:59'],
    ['12:00', 12, 0, 'PM', '12:00'],
    ['13:00', 1, 0, 'PM', '13:00'],
    ['18:30', 6, 30, 'PM', '18:30'],
    ['23:00', 11, 0, 'PM', '23:00'],
  ] as const)('round-trips %s as %s %s:%s', (stored, hour12, minute, period, back) => {
    expect(clockPartsFrom24h(stored)).toEqual({ hour12, minute, period })
    expect(clock24hFromParts(hour12, minute, period)).toBe(back)
  })
})
