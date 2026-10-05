/**
 * Interviewer-side status labels. Candidate matching itself runs in the
 * database (match_interviewers_by_skills / match_interviewers_for_job): an
 * active interviewer with at least one skill is matchable, with or without a
 * service. These helpers only describe that state; they do not rank or match.
 */

export type ReadinessInput = {
  isActive: boolean
  skillCount: number
  activeServiceCount: number
  weeklyWindowCount: number
  customSlotCount: number
  availableFrom: string | null
  availableUntil: string | null
  /** Interviewer-local YYYY-MM-DD. */
  today: string
}

export type ReadinessBlocker = 'inactive' | 'no_service' | 'no_availability' | 'range_ended' | 'range_not_started'

export type CandidateReadiness = {
  skillMatched: boolean
  bookable: boolean
  blockers: ReadinessBlocker[]
}

export const READINESS_BLOCKER_TEXT: Record<ReadinessBlocker, string> = {
  inactive: 'Your account is inactive.',
  no_service: 'Add or activate a service (duration and price) so matched candidates can book you.',
  no_availability: 'Add weekly hours or custom slots.',
  range_ended: 'Your available date range has ended. Extend the end date.',
  range_not_started: 'Your available date range has not started yet.',
}

export function candidateReadiness(input: ReadinessInput): CandidateReadiness {
  const blockers: ReadinessBlocker[] = []
  if (!input.isActive) blockers.push('inactive')
  if (input.activeServiceCount === 0) blockers.push('no_service')
  if (input.weeklyWindowCount === 0 && input.customSlotCount === 0) blockers.push('no_availability')
  if (input.availableUntil && input.availableUntil < input.today) blockers.push('range_ended')
  else if (input.availableFrom && input.availableFrom > input.today) blockers.push('range_not_started')

  return {
    skillMatched: input.isActive && input.skillCount > 0,
    bookable: blockers.every((item) => item === 'range_not_started'),
    blockers,
  }
}
