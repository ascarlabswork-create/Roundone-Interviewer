export const API_ENDPOINTS = {
  profile: '/api/interviewer/profile',
  verification: '/api/interviewer/verification',
  bookings: '/api/interviewer/bookings',
  acceptBooking: (id: string) => `/api/interviewer/bookings/${id}/accept`,
  rejectBooking: (id: string) => `/api/interviewer/bookings/${id}/reject`,
  rescheduleBooking: (id: string) => `/api/interviewer/bookings/${id}/reschedule`,
  customSlots: '/api/interviewer/custom-slots',
  blockedTimes: '/api/interviewer/blocked-times',
  blockedTime: (id: string) => `/api/interviewer/blocked-times/${id}`,
  availableSlots: (id: string) => `/api/interviewers/${id}/available-slots`,
  availabilityItem: (id: string) => `/api/interviewer/availability/${id}`,
  services: '/api/interviewer/services',
  service: (id: string) => `/api/interviewer/services/${id}`,
  candidates: '/api/interviewer/candidates',
  candidate: (id: string) => `/api/interviewer/candidates/${id}`,
  interviewerReviews: (id: string) => `/api/interviewers/${id}/reviews`,
  bookingFeedback: (bookingId: string) => `/api/bookings/${bookingId}/feedback`,
  submittedFeedback: '/api/interviewer/feedback/submitted',
  earnings: '/api/interviewer/earnings',
  availability: '/api/interviewer/availability',
} as const

const DEFAULT_DELAY = 220

export function delay(ms = DEFAULT_DELAY) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
