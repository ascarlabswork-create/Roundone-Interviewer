import { describe, expect, it } from 'vitest'
import { SERVICE_HAS_BOOKINGS, paiseToRupees, rupeesToPaise, serviceDeleteErrorMessage } from './interviewerServices.ts'

describe('service deletion errors', () => {
  it('explains that a booked service must be deactivated instead of deleted', () => {
    expect(
      serviceDeleteErrorMessage({
        code: '23503',
        message: 'update or delete on table "interviewer_services" violates foreign key constraint "bookings_service_id_fkey"',
      }),
    ).toBe(SERVICE_HAS_BOOKINGS)
  })

  it('falls back to a friendly message for other failures', () => {
    expect(serviceDeleteErrorMessage({ code: '42501', message: 'permission denied' })).toBe(
      'Could not delete the service. Try again.',
    )
  })
})

describe('service pricing', () => {
  it('round-trips whole rupees through paise', () => {
    expect(rupeesToPaise(1500)).toBe(150000)
    expect(paiseToRupees(150000)).toBe(1500)
    expect(() => rupeesToPaise(10.5)).toThrow()
  })
})
