import { seedSchedule } from '../data/availability.ts'
import { seedBookings } from '../data/bookings.ts'
import { getCandidateById, managedCandidates } from '../data/candidates.ts'
import { seedEarnings, seedTransactions } from '../data/earnings.ts'
import { seedInterviewerFeedback } from '../data/feedback.ts'
import { currentInterviewer } from '../data/interviewer.ts'
import { seedNotifications } from '../data/notifications.ts'
import { seedCandidateReviews } from '../data/reviews.ts'
import { seedServices } from '../data/services.ts'
import { canSubmitPrivateFeedback } from '../lib/feedback.ts'
import {
  generateBookableSlots,
  generateUpcomingSlots,
  validateBlockedTime,
  validateCustomSlot,
  validateRecurring,
} from '../lib/slots.ts'
import { readJson, writeJson } from '../lib/storage.ts'
import type {
  AvailabilitySchedule,
  AvailabilitySlot,
  AvailabilitySettings,
  BlockedTime,
  Booking,
  BookingStatus,
  CandidateReview,
  CustomAvailabilitySlot,
  InterviewerFeedback,
  InterviewerProfile,
  RecurringAvailability,
  Service,
  Verification,
} from '../types.ts'
import { ApiError, delay } from './client.ts'

const BOOKINGS_KEY = 'roundone.interviewer.bookings'
const SERVICES_KEY = 'roundone.interviewer.services'
const AVAIL_KEY = 'roundone.interviewer.availability.schedule.v1'
const PROFILE_KEY = 'roundone.interviewer.profile'
const CANDIDATE_REVIEWS_KEY = 'roundone.interviewer.candidate_reviews'
const INTERVIEWER_FEEDBACK_KEY = 'roundone.interviewer.interviewer_feedback'
const VERIFICATION_KEY = 'roundone.interviewer.verification'

function mergeById<T extends { id: string }>(extras: T[], seed: T[]) {
  const extraIds = new Set(extras.map((item) => item.id))
  return [...extras, ...seed.filter((item) => !extraIds.has(item.id))]
}

function allBookings() {
  return mergeById(readJson<Booking[]>(BOOKINGS_KEY, []), seedBookings).map(normalizeBooking)
}

function normalizeBooking(item: Booking): Booking {
  const legacy = item as Booking & { feedbackStatus?: 'pending' | 'ready' | 'none' }
  if (legacy.privateFeedbackStatus) return item
  const mapped: Booking['privateFeedbackStatus'] =
    legacy.feedbackStatus === 'ready' ? 'submitted' : legacy.feedbackStatus === 'pending' ? 'pending' : 'none'
  return { ...item, privateFeedbackStatus: mapped }
}

function saveBookings(items: Booking[]) {
  writeJson(BOOKINGS_KEY, items)
}

function allServices() {
  return mergeById(readJson<Service[]>(SERVICES_KEY, []), seedServices)
}

function saveServices(items: Service[]) {
  writeJson(SERVICES_KEY, items)
}

function getSchedule(): AvailabilitySchedule {
  const stored = readJson<AvailabilitySchedule | null>(AVAIL_KEY, null)
  if (!stored) return structuredClone(seedSchedule)
  return {
    settings: { ...seedSchedule.settings, ...stored.settings, interviewerId: currentInterviewer.id },
    recurring: stored.recurring?.length ? stored.recurring : seedSchedule.recurring,
    customSlots: stored.customSlots ?? seedSchedule.customSlots,
    blockedTimes: stored.blockedTimes ?? seedSchedule.blockedTimes,
  }
}

function saveSchedule(schedule: AvailabilitySchedule) {
  writeJson(AVAIL_KEY, schedule)
}

function allInterviewerFeedback() {
  return mergeById(readJson<InterviewerFeedback[]>(INTERVIEWER_FEEDBACK_KEY, []), seedInterviewerFeedback)
}

function allCandidateReviews() {
  return mergeById(readJson<CandidateReview[]>(CANDIDATE_REVIEWS_KEY, []), seedCandidateReviews)
}

function assertBookingOwner(booking: Booking) {
  if (booking.interviewerId !== currentInterviewer.id) {
    throw new ApiError('You do not have access to this booking', 403)
  }
}

export function platformFeeFor(sessionFee: number) {
  return Math.max(40, Math.round(sessionFee * 0.05))
}

export async function getProfile() {
  await delay()
  const stored = readJson<InterviewerProfile | null>(PROFILE_KEY, null)
  const verification = readJson<Verification | null>(VERIFICATION_KEY, null)
  const profile = stored ?? currentInterviewer
  return {
    ...profile,
    services: allServices(),
    verification: verification ?? profile.verification,
  }
}

export async function saveProfile(patch: Partial<InterviewerProfile>) {
  await delay()
  const current = await getProfile()
  const next = { ...current, ...patch, services: allServices() }
  writeJson(PROFILE_KEY, next)
  return next
}

export async function submitVerification() {
  await delay(360)
  const current = await getProfile()
  const verification: Verification = {
    identity: 'verified',
    linkedin: 'verified',
    employment: 'verified',
    professionalEmail: current.verification.professionalEmail === 'action_required' ? 'pending' : 'verified',
  }
  writeJson(VERIFICATION_KEY, verification)
  return verification
}

export async function listBookings(status?: BookingStatus) {
  await delay()
  const items = allBookings().sort((a, b) => +new Date(a.start) - +new Date(b.start))
  return status ? items.filter((item) => item.status === status) : items
}

export async function getBooking(id: string) {
  await delay()
  const booking = allBookings().find((item) => item.id === id)
  if (!booking) throw new ApiError('Booking not found', 404)
  assertBookingOwner(booking)
  return booking
}

export async function completeBooking(id: string) {
  await delay()
  const items = allBookings()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new ApiError('Booking not found', 404)
  assertBookingOwner(items[index])
  if (items[index].status === 'cancelled') {
    throw new ApiError('Cancelled bookings cannot be completed', 400)
  }
  if (items[index].status !== 'completed') {
    items[index] = {
      ...items[index],
      status: 'completed',
      privateFeedbackStatus: items[index].privateFeedbackStatus === 'submitted' ? 'submitted' : 'pending',
    }
    saveBookings(items)
  }
  return items[index]
}

export async function acceptBooking(id: string) {
  await delay(280)
  const items = allBookings()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new ApiError('Booking not found', 404)
  items[index] = { ...items[index], status: 'upcoming' }
  saveBookings(items)
  return items[index]
}

export async function rejectBooking(id: string) {
  await delay(280)
  const items = allBookings()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new ApiError('Booking not found', 404)
  items[index] = { ...items[index], status: 'cancelled' }
  saveBookings(items)
  return items[index]
}

export async function rescheduleBooking(id: string, start: string) {
  await delay(280)
  const items = allBookings()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new ApiError('Booking not found', 404)
  items[index] = { ...items[index], start, status: 'upcoming' }
  saveBookings(items)
  return items[index]
}

export async function getAvailabilitySchedule() {
  await delay()
  return getSchedule()
}

export async function saveRecurringAvailability(recurring: RecurringAvailability[], settings: AvailabilitySettings) {
  await delay()
  if (settings.interviewerId !== currentInterviewer.id) {
    throw new ApiError('You can only update your own availability', 403)
  }
  const errors = validateRecurring(recurring, settings.timezone)
  if (errors.length) throw new ApiError(errors[0], 400)
  const current = getSchedule()
  const next = {
    ...current,
    settings: { ...settings, interviewerId: currentInterviewer.id },
    recurring: recurring.map((item) => ({ ...item, interviewerId: currentInterviewer.id, timezone: settings.timezone })),
    customSlots: current.customSlots.map((item) => ({ ...item, timezone: settings.timezone })),
    blockedTimes: current.blockedTimes.map((item) => ({ ...item, timezone: settings.timezone })),
  }
  saveSchedule(next)
  return next
}

export async function addCustomSlot(slot: Omit<CustomAvailabilitySlot, 'id' | 'interviewerId'>) {
  await delay()
  const current = getSchedule()
  const errors = validateCustomSlot(slot, current.customSlots)
  if (errors.length) throw new ApiError(errors[0], 400)
  const nextSlot: CustomAvailabilitySlot = {
    ...slot,
    id: `custom-${Date.now()}`,
    interviewerId: currentInterviewer.id,
    timezone: current.settings.timezone,
  }
  const next = { ...current, customSlots: [nextSlot, ...current.customSlots] }
  saveSchedule(next)
  return nextSlot
}

export async function deleteCustomSlot(id: string) {
  await delay()
  const current = getSchedule()
  const target = current.customSlots.find((item) => item.id === id)
  if (!target) throw new ApiError('Custom slot not found', 404)
  if (target.interviewerId !== currentInterviewer.id) throw new ApiError('You can only update your own availability', 403)
  saveSchedule({ ...current, customSlots: current.customSlots.filter((item) => item.id !== id) })
}

export async function addBlockedTime(item: Omit<BlockedTime, 'id' | 'interviewerId' | 'timezone'>) {
  await delay()
  const current = getSchedule()
  const errors = validateBlockedTime({
    date: item.date,
    allDay: item.allDay,
    startTime: item.startTime ?? '00:00',
    endTime: item.endTime ?? '23:59',
  })
  if (errors.length) throw new ApiError(errors[0], 400)
  const nextItem: BlockedTime = {
    ...item,
    id: `block-${Date.now()}`,
    interviewerId: currentInterviewer.id,
    timezone: current.settings.timezone,
  }
  const next = { ...current, blockedTimes: [nextItem, ...current.blockedTimes] }
  saveSchedule(next)
  return nextItem
}

export async function deleteBlockedTime(id: string) {
  await delay()
  const current = getSchedule()
  const target = current.blockedTimes.find((item) => item.id === id)
  if (!target) throw new ApiError('Blocked time not found', 404)
  if (target.interviewerId !== currentInterviewer.id) throw new ApiError('You can only update your own availability', 403)
  saveSchedule({ ...current, blockedTimes: current.blockedTimes.filter((item) => item.id !== id) })
}

export async function listAvailableSlots(date: string, durationMin: number, serviceId?: string | null) {
  await delay()
  return generateBookableSlots({
    schedule: getSchedule(),
    bookings: allBookings(),
    date,
    durationMin,
    serviceId,
  })
}

export async function getAvailabilitySummary() {
  await delay()
  const schedule = getSchedule()
  const bookings = allBookings()
  const slots = generateUpcomingSlots(schedule, bookings, schedule.settings.defaultDurationMin)
  return { schedule, bookings, slots }
}

/** Candidate-visible upcoming slots. Never returns blocked/private schedule details. */
export async function listAvailability(): Promise<AvailabilitySlot[]> {
  await delay()
  const schedule = getSchedule()
  return generateUpcomingSlots(schedule, allBookings(), schedule.settings.defaultDurationMin, 14).map((slot) => ({
    id: slot.id,
    start: slot.start,
    end: slot.end,
    durationMin: slot.durationMin,
    state: 'available' as const,
    source: slot.source,
  }))
}

export async function listServices() {
  await delay()
  return allServices()
}

export async function saveService(service: Service) {
  await delay()
  const items = allServices()
  const index = items.findIndex((item) => item.id === service.id)
  if (index >= 0) items[index] = service
  else items.unshift(service)
  saveServices(items)
  return service
}

export async function duplicateService(id: string) {
  await delay()
  const items = allServices()
  const source = items.find((item) => item.id === id)
  if (!source) throw new ApiError('Service not found', 404)
  const copy: Service = {
    ...source,
    id: `${source.id}-copy-${Date.now()}`,
    name: `${source.name} (Copy)`,
    isActive: false,
  }
  saveServices([copy, ...items])
  return copy
}

export async function deactivateService(id: string) {
  await delay()
  const items = allServices()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new ApiError('Service not found', 404)
  items[index] = { ...items[index], isActive: !items[index].isActive }
  saveServices(items)
  return items[index]
}

export async function listCandidates() {
  await delay()
  return managedCandidates
}

export async function getCandidate(id: string) {
  await delay()
  const candidate = getCandidateById(id)
  if (!candidate) throw new ApiError('Candidate not found', 404)
  const history = allBookings()
    .filter((item) => item.candidateId === id)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))
  const submittedFeedback = allInterviewerFeedback().filter(
    (item) => item.candidateId === id && item.interviewerId === currentInterviewer.id && item.visibility === 'private',
  )
  return { candidate, history, submittedFeedback }
}

export async function getBookingFeedback(bookingId: string) {
  await delay()
  const booking = allBookings().find((item) => item.id === bookingId)
  if (!booking) throw new ApiError('Booking not found', 404)
  assertBookingOwner(booking)
  return (
    allInterviewerFeedback().find(
      (item) => item.bookingId === bookingId && item.interviewerId === currentInterviewer.id && item.visibility === 'private',
    ) ?? null
  )
}

export async function submitBookingFeedback(
  bookingId: string,
  report: Omit<InterviewerFeedback, 'id' | 'interviewerId' | 'bookingId' | 'visibility' | 'submittedAt'>,
) {
  await delay(360)
  const booking = allBookings().find((item) => item.id === bookingId)
  if (!booking) throw new ApiError('Booking not found', 404)
  assertBookingOwner(booking)

  const existing = allInterviewerFeedback().find((item) => item.bookingId === bookingId)
  if (!canSubmitPrivateFeedback(booking, currentInterviewer.id, Boolean(existing))) {
    throw new ApiError('Private feedback can only be submitted once after a completed interview you own', 403)
  }

  const saved: InterviewerFeedback = {
    ...report,
    id: `fb-${Date.now()}`,
    bookingId,
    interviewerId: currentInterviewer.id,
    visibility: 'private',
    submittedAt: new Date().toISOString(),
  }
  writeJson(INTERVIEWER_FEEDBACK_KEY, [saved, ...allInterviewerFeedback()])
  const items = allBookings()
  const index = items.findIndex((item) => item.id === bookingId)
  if (index >= 0) {
    items[index] = { ...items[index], privateFeedbackStatus: 'submitted', status: 'completed' }
    saveBookings(items)
  }
  return saved
}

export async function listSubmittedFeedback() {
  await delay()
  return allInterviewerFeedback()
    .filter((item) => item.interviewerId === currentInterviewer.id && item.visibility === 'private')
    .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))
}

export async function listInterviewerReviews(interviewerId: string) {
  await delay()
  return allCandidateReviews()
    .filter((item) => item.interviewerId === interviewerId && item.visibility === 'public')
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
}

export async function respondToReview(id: string, response: string) {
  await delay()
  const items = allCandidateReviews()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new ApiError('Review not found', 404)
  if (items[index].interviewerId !== currentInterviewer.id) {
    throw new ApiError('You can only respond to reviews on your profile', 403)
  }
  items[index] = { ...items[index], response }
  writeJson(CANDIDATE_REVIEWS_KEY, items)
  return items[index]
}

export async function getEarnings() {
  await delay()
  return {
    summary: seedEarnings,
    transactions: seedTransactions,
  }
}

export async function listNotifications() {
  await delay(80)
  return seedNotifications
}

export { API_ENDPOINTS } from './client.ts'
