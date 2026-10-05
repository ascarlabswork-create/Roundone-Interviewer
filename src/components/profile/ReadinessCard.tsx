import { Link } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toISODate } from '../../lib/dates.ts'
import { candidateReadiness, READINESS_BLOCKER_TEXT, type ReadinessBlocker } from '../../lib/readiness.ts'
import type { AvailabilityBoard } from '../../services/interviewerAvailability.ts'
import type { InterviewerAccount } from '../../services/interviewerProfile.ts'
import type { InterviewerServiceRecord } from '../../services/interviewerServices.ts'
import { Card } from '../ui/primitives.tsx'

const BLOCKER_LINKS: Record<ReadinessBlocker, string | null> = {
  inactive: null,
  no_service: '/interviewer/services',
  no_availability: '/interviewer/calendar',
  range_ended: '/interviewer/calendar',
  range_not_started: '/interviewer/calendar',
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
  ) : (
    <XCircle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
  )
}

export function ReadinessCard({
  account,
  services,
  board,
}: {
  account: InterviewerAccount
  services: InterviewerServiceRecord[]
  board: AvailabilityBoard
}) {
  const readiness = candidateReadiness({
    isActive: account.profile.is_active,
    skillCount: account.skills.length,
    activeServiceCount: services.filter((item) => item.is_active).length,
    weeklyWindowCount: board.availability.length,
    customSlotCount: board.customSlots.length,
    availableFrom: board.availableFrom,
    availableUntil: board.availableUntil,
    today: toISODate(new Date()),
  })
  const skillCount = account.skills.length

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-navy-950">Candidate visibility</h2>
      <ul className="mt-4 space-y-4 text-sm">
        <li className="flex gap-3">
          <StatusIcon ok={readiness.skillMatched} />
          <div>
            <p className="font-medium text-navy-950">
              Skill matched {readiness.skillMatched ? '✅' : '❌'}
            </p>
            <p className="mt-0.5 text-slate-600">
              {readiness.skillMatched
                ? `Candidate matching can find you on ${skillCount} skill${skillCount === 1 ? '' : 's'}. No service is needed for this.`
                : skillCount === 0
                  ? 'Add at least one skill so candidate matching can find you.'
                  : READINESS_BLOCKER_TEXT.inactive}
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <StatusIcon ok={readiness.bookable} />
          <div>
            <p className="font-medium text-navy-950">
              Ready for booking {readiness.bookable ? '✅' : '❌'}
            </p>
            {readiness.bookable ? (
              <p className="mt-0.5 text-slate-600">Matched candidates can book your available slots.</p>
            ) : null}
            {readiness.blockers.length > 0 ? (
              <ul className="mt-1 space-y-1 text-slate-600">
                {readiness.blockers.map((blocker) => {
                  const href = BLOCKER_LINKS[blocker]
                  return (
                    <li key={blocker}>
                      {READINESS_BLOCKER_TEXT[blocker]}{' '}
                      {href ? (
                        <Link to={href} className="font-medium text-blue-700">
                          Fix
                        </Link>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </li>
      </ul>
    </Card>
  )
}
