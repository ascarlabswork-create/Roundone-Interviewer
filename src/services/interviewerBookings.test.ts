import { describe, expect, it } from 'vitest'
import { bookingsForTab, tabForBooking, type InterviewerBooking } from './interviewerBookings.ts'

function row(id: string, status: InterviewerBooking['status']) {
  return { id, status } as InterviewerBooking
}

describe('tabForBooking', () => {
  it('puts unpaid and requested bookings on pending', () => {
    expect(tabForBooking('pending_payment')).toBe('pending')
    expect(tabForBooking('requested')).toBe('pending')
  })

  it('keeps confirmed sessions on upcoming', () => {
    expect(tabForBooking('confirmed')).toBe('upcoming')
    expect(tabForBooking('in_progress')).toBe('upcoming')
  })
})

describe('bookingsForTab', () => {
  it('includes payment-hold rows in pending', () => {
    const rows = [row('a', 'pending_payment'), row('b', 'requested'), row('c', 'confirmed')]
    expect(bookingsForTab(rows, 'pending').map((item) => item.id)).toEqual(['a', 'b'])
  })
})
