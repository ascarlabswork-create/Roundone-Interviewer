import { describe, expect, it } from 'vitest'
import {
  notificationDisplay,
  notificationHref,
  type InterviewerNotification,
} from './interviewerNotifications.ts'
import type { InterviewerBooking } from './interviewerBookings.ts'

const candidateSideRequest: InterviewerNotification = {
  id: 'n1',
  kind: 'booking_requested',
  title: 'Booking request submitted',
  body: 'Your booking request was sent. The interviewer will confirm or decline it.',
  payload: { booking_id: 'fcbfc77c-2d34-4046-b4d0-c4ba463052ab' },
  readAt: null,
  createdAt: '2026-11-10T10:28:54.146Z',
}

const ownedBooking = {
  id: 'fcbfc77c-2d34-4046-b4d0-c4ba463052ab',
  status: 'requested',
  candidate: { name: 'Duddelly Srimadhan' },
  serviceName: 'Mock interview',
  startsAtUtc: '2026-11-11T11:30:00.000Z',
  displayTimezone: 'Asia/Kolkata',
} as InterviewerBooking

describe('notificationDisplay booking_requested', () => {
  it('does not offer Review Booking for candidate-side notifications without an owned booking', () => {
    const display = notificationDisplay(candidateSideRequest, null)
    expect(display.title).toBe('Booking request submitted')
    expect(display.actionLabel).toBeNull()
    expect(display.body).toContain('Your booking request was sent')
  })

  it('offers Review Booking when the booking belongs to this interviewer', () => {
    const display = notificationDisplay(candidateSideRequest, ownedBooking)
    expect(display.title).toBe('New Interview Request')
    expect(display.actionLabel).toBe('Review Booking')
    expect(display.body).toContain('Duddelly Srimadhan')
  })
})

describe('notificationHref booking_requested', () => {
  it('does not deep-link a booking the interviewer does not own', () => {
    expect(notificationHref(candidateSideRequest, null)).toBe('/interviewer/bookings?tab=pending')
  })

  it('deep-links owned pending requests for review', () => {
    expect(notificationHref(candidateSideRequest, ownedBooking)).toBe(
      '/interviewer/bookings?tab=pending&booking=fcbfc77c-2d34-4046-b4d0-c4ba463052ab',
    )
  })
})
