import { getMyFeedbackForBooking, type InterviewerFeedbackRecord } from './interviewerFeedback.ts'
import { getMyBookings, type InterviewerBooking, type InterviewerBookingCandidate } from './interviewerBookings.ts'

export type InterviewerCandidateHistory = {
  candidate: InterviewerBookingCandidate
  bookings: InterviewerBooking[]
  latestFeedback: InterviewerFeedbackRecord | null
}

function latestBooking(bookings: InterviewerBooking[]) {
  return [...bookings].sort((a, b) => Date.parse(b.startsAtUtc) - Date.parse(a.startsAtUtc))[0]
}

export async function listMyCandidates(): Promise<InterviewerCandidateHistory[]> {
  const bookings = await getMyBookings()
  const byCandidate = new Map<string, InterviewerBooking[]>()
  for (const booking of bookings) {
    const current = byCandidate.get(booking.candidateProfileId) ?? []
    current.push(booking)
    byCandidate.set(booking.candidateProfileId, current)
  }

  return [...byCandidate.values()]
    .map((items): InterviewerCandidateHistory | null => {
      const newest = latestBooking(items)
      if (!newest) return null
      return {
        candidate: newest.candidate,
        bookings: [...items].sort((a, b) => Date.parse(b.startsAtUtc) - Date.parse(a.startsAtUtc)),
        latestFeedback: null,
      }
    })
    .filter((item): item is InterviewerCandidateHistory => item !== null)
    .sort((a, b) => Date.parse(b.bookings[0]?.startsAtUtc ?? '') - Date.parse(a.bookings[0]?.startsAtUtc ?? ''))
}

export async function getMyCandidate(candidateProfileId: string): Promise<InterviewerCandidateHistory> {
  const grouped = await listMyCandidates()
  const match = grouped.find((item) => item.candidate.candidateProfileId === candidateProfileId)
  if (!match) throw new Error('Candidate not found among your bookings.')
  const completed = match.bookings.find((item) => item.status === 'completed')
  const latestFeedback = completed ? await getMyFeedbackForBooking(completed.id) : null
  return { ...match, latestFeedback }
}
