import { describe, expect, it } from 'vitest'
import {
  bookingsForTab,
  canRescheduleBooking,
  parseBooking,
  tabForBooking,
  type InterviewerBooking,
} from './interviewerBookings.ts'

function row(id: string, status: InterviewerBooking['status']) {
  return { id, status } as InterviewerBooking
}

const DB_ROW = {
  id: '7c2e29cb-0f2b-4791-b7e9-f8bda486bd68',
  candidate_profile_id: '1164f563-b0ef-435b-848a-26bd144e4ac8',
  interviewer_profile_id: '45d0e041-3a84-4fa6-8c43-7b7d2febc5c2',
  service_id: null,
  status: 'requested',
  starts_at: '2026-11-04T12:50:00+00',
  ends_at: '2026-11-04T13:35:00+00',
  display_timezone: 'Asia/Kolkata',
  interviewer_timezone: 'Asia/Kolkata',
  duration_min: 45,
  session_fee_paise: 0,
  platform_fee_paise: 4900,
  total_paise: 4900,
  currency: 'INR',
  mode: 'video',
  created_at: '2026-11-04T12:38:10Z',
  updated_at: '2026-11-04T12:38:19Z',
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

describe('parseBooking', () => {
  it('keeps a booking that has no service_id so it still shows for the interviewer', () => {
    const booking = parseBooking(DB_ROW)
    expect(booking).not.toBeNull()
    expect(booking?.serviceId).toBe('')
    expect(booking?.status).toBe('requested')
    expect(booking?.durationMin).toBe(45)
    expect(booking?.serviceName).toBe('Interview')
  })

  it('does not offer reschedule when the booking has no service', () => {
    const booking = parseBooking(DB_ROW)
    expect(booking && canRescheduleBooking(booking)).toBe(false)
  })

  it('still rejects rows missing required identifiers', () => {
    expect(parseBooking({ ...DB_ROW, id: null })).toBeNull()
    expect(parseBooking({ ...DB_ROW, interviewer_profile_id: null })).toBeNull()
  })
})
