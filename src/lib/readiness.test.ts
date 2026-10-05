import { describe, expect, it } from 'vitest'
import { candidateReadiness, type ReadinessInput } from './readiness.ts'

const base: ReadinessInput = {
  isActive: true,
  skillCount: 3,
  activeServiceCount: 0,
  weeklyWindowCount: 0,
  customSlotCount: 0,
  availableFrom: null,
  availableUntil: null,
  today: '2026-10-05',
}

describe('candidateReadiness', () => {
  it('is skill matched with skills and no service, but not ready for booking', () => {
    const readiness = candidateReadiness(base)
    expect(readiness.skillMatched).toBe(true)
    expect(readiness.bookable).toBe(false)
    expect(readiness.blockers).toEqual(['no_service', 'no_availability'])
  })

  it('stays skill matched after a service is added and becomes bookable with availability', () => {
    const readiness = candidateReadiness({ ...base, activeServiceCount: 1, weeklyWindowCount: 2 })
    expect(readiness.skillMatched).toBe(true)
    expect(readiness.bookable).toBe(true)
    expect(readiness.blockers).toEqual([])
  })

  it('stays skill matched after the service is deleted', () => {
    expect(candidateReadiness({ ...base, activeServiceCount: 0, weeklyWindowCount: 2 }).skillMatched).toBe(true)
  })

  it('is not skill matched without skills even when bookable pieces exist', () => {
    const readiness = candidateReadiness({ ...base, skillCount: 0, activeServiceCount: 1, customSlotCount: 1 })
    expect(readiness.skillMatched).toBe(false)
    expect(readiness.bookable).toBe(true)
  })

  it('is not bookable once the available date range has ended', () => {
    const readiness = candidateReadiness({
      ...base,
      activeServiceCount: 1,
      weeklyWindowCount: 1,
      availableFrom: '2026-09-01',
      availableUntil: '2026-10-01',
    })
    expect(readiness.bookable).toBe(false)
    expect(readiness.blockers).toEqual(['range_ended'])
  })

  it('stays bookable when the range starts in the future', () => {
    const readiness = candidateReadiness({
      ...base,
      activeServiceCount: 1,
      weeklyWindowCount: 1,
      availableFrom: '2026-10-10',
      availableUntil: '2026-12-31',
    })
    expect(readiness.bookable).toBe(true)
    expect(readiness.blockers).toEqual(['range_not_started'])
  })

  it('hides an inactive account from both matching and booking', () => {
    const readiness = candidateReadiness({ ...base, isActive: false, activeServiceCount: 1, weeklyWindowCount: 1 })
    expect(readiness.skillMatched).toBe(false)
    expect(readiness.bookable).toBe(false)
  })
})
