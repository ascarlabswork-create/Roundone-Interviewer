import { describe, expect, it } from 'vitest'
import { isPaidBooking, netEarningsPaise } from './interviewerEarnings.ts'

describe('isPaidBooking', () => {
  it('excludes free bookings so no earnings show before a real payment', () => {
    expect(isPaidBooking({ sessionFeePaise: 0 })).toBe(false)
  })

  it('includes bookings that actually charged a session fee', () => {
    expect(isPaidBooking({ sessionFeePaise: 150000 })).toBe(true)
  })
})

describe('netEarningsPaise', () => {
  it('is the session fee minus the platform fee', () => {
    expect(netEarningsPaise(150000, 4900)).toBe(145100)
  })

  it('a free booking would be negative, which is why it is filtered out', () => {
    expect(netEarningsPaise(0, 4900)).toBe(-4900)
  })
})
