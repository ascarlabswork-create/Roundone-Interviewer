import type { Booking } from '../types.ts'

export function isPrivateFeedbackPending(booking: Booking) {
  return booking.status === 'completed' && booking.privateFeedbackStatus === 'pending'
}

export function isPrivateFeedbackSubmitted(booking: Booking) {
  return booking.status === 'completed' && booking.privateFeedbackStatus === 'submitted'
}

export function canSubmitPrivateFeedback(booking: Booking, currentUserId: string, alreadySubmitted: boolean) {
  return (
    booking.status === 'completed' &&
    booking.interviewerId === currentUserId &&
    !alreadySubmitted &&
    booking.privateFeedbackStatus !== 'submitted'
  )
}
