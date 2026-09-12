import { Link, useParams } from 'react-router-dom'
import { getCandidate } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { BookingStatusBadge } from '../components/ui/StatusBadge.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Avatar } from '../components/ui/identity.tsx'
import { Badge, Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { formatDateShort, formatTime } from '../lib/dates.ts'
import { isPrivateFeedbackPending, isPrivateFeedbackSubmitted } from '../lib/feedback.ts'
import { useAsync } from '../lib/useAsync.ts'

export function CandidateDetailPage() {
  const { id = '' } = useParams()
  const state = useAsync(() => getCandidate(id), [id])

  if (state.status === 'loading') return <Skeleton className="h-96" />
  if (state.status === 'error') return <ErrorState body={state.error} onRetry={state.reload} />

  const { candidate, history, submittedFeedback } = state.data
  const latest = submittedFeedback[0]

  return (
    <div className="space-y-6">
      <Link to="/interviewer/candidates" className="text-sm font-medium text-blue-700">
        Back to candidates
      </Link>
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar src={candidate.photo} name={candidate.name} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold text-navy-950">{candidate.name}</h1>
            <p className="mt-1 text-slate-600">
              {candidate.targetRole} · {candidate.experience}
            </p>
            <p className="mt-1 text-sm text-slate-500">Preparing for {candidate.targetCompany}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-navy-950">Current preparation areas</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {candidate.preparationAreas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
          <h2 className="mt-3 font-semibold text-navy-950">Latest private feedback</h2>
          {latest ? (
            <div className="mt-3 text-sm text-slate-600">
              <p>
                Overall Performance {latest.scores.overallPerformance}/10 · {latest.readiness}
              </p>
              <p className="mt-2">{latest.detailedFeedback}</p>
              <Link to={`/interviewer/feedback/${latest.bookingId}`} className="mt-4 inline-block">
                <Button size="sm" variant="outline">
                  View Submitted Feedback
                </Button>
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No private feedback submitted yet for this candidate.</p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-navy-950">Interview history</h2>
        <div className="mt-4 space-y-3">
          {history.map((booking) => (
            <div
              key={booking.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-navy-950">{booking.serviceName}</p>
                <p className="text-sm text-slate-600">
                  {formatDateShort(booking.start)} · {formatTime(booking.start)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BookingStatusBadge status={booking.status} />
                {booking.status === 'upcoming' ? (
                  <Link to={`/interviewer/interview/${booking.id}`}>
                    <Button size="sm">Join</Button>
                  </Link>
                ) : null}
                {isPrivateFeedbackPending(booking) ? (
                  <Link to={`/interviewer/feedback/${booking.id}`}>
                    <Button size="sm">Give Feedback</Button>
                  </Link>
                ) : null}
                {isPrivateFeedbackSubmitted(booking) ? (
                  <Link to={`/interviewer/feedback/${booking.id}`}>
                    <Button size="sm" variant="outline">
                      View Submitted Feedback
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
