import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { LiveBookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Badge, Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { formatDateShortInZone, formatTimeInZone } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { READINESS_LABELS } from '../services/interviewerFeedback.ts'
import { getMyCandidate } from '../services/interviewerCandidates.ts'

export function CandidateDetailPage() {
  const { id = '' } = useParams()
  const state = useAsync(() => getMyCandidate(id), [id])

  if (state.status === 'loading') return <Skeleton className="h-96" />
  if (state.status === 'error') return <ErrorState body={state.error} onRetry={state.reload} />

  const { candidate, bookings, latestFeedback } = state.data

  return (
    <div className="space-y-6">
      <Link to="/interviewer/candidates" className="text-sm font-medium text-blue-700">
        Back to candidates
      </Link>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-navy-950">{candidate.name}</h1>
        <p className="mt-1 text-slate-600">
          {[candidate.targetRole, candidate.candidateLevel].filter(Boolean).join(' · ') || 'No role details provided'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidate.skills.map((skill) => (
            <Badge key={skill}>{skill}</Badge>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
        <h2 className="mt-3 font-semibold text-navy-950">Latest private feedback</h2>
        {latestFeedback ? (
          <div className="mt-3 text-sm text-slate-600">
            <p>
              Overall {latestFeedback.overall}/5 · {READINESS_LABELS[latestFeedback.readiness]}
            </p>
            <p className="mt-2">{latestFeedback.summary}</p>
            {latestFeedback.internalNotes ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                Internal notes stay on this interviewer account only.
              </p>
            ) : null}
            <Link to={`/interviewer/feedback/${latestFeedback.bookingId}`} className="mt-4 inline-block">
              <Button size="sm" variant="outline">
                View Submitted Feedback
              </Button>
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No private feedback submitted yet for this candidate.</p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-navy-950">Interview history</h2>
        <div className="mt-4 space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-navy-950">{booking.serviceName}</p>
                <p className="text-sm text-slate-600">
                  {formatDateShortInZone(booking.startsAtUtc, booking.displayTimezone)} ·{' '}
                  {formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)}
                </p>
              </div>
              <LiveBookingStatusBadge status={booking.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
