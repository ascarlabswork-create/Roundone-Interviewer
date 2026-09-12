import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getBooking, getBookingFeedback, submitBookingFeedback } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Card, Chip, ErrorState, FieldLabel, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { IMPROVEMENT_TAGS, STRENGTH_TAGS } from '../data/catalogs.ts'
import { getCandidateById } from '../data/candidates.ts'
import { canSubmitPrivateFeedback } from '../lib/feedback.ts'
import { useAsync } from '../lib/useAsync.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import type { FeedbackScores, InterviewerFeedback, Readiness } from '../types.ts'

const dimensions: Array<{ key: keyof FeedbackScores; label: string }> = [
  { key: 'technicalSkills', label: 'Technical Skills' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'systemDesign', label: 'System Design' },
  { key: 'coding', label: 'Coding' },
  { key: 'behavioral', label: 'Behavioral' },
  { key: 'overallPerformance', label: 'Overall Performance' },
]

const defaultScores: FeedbackScores = {
  technicalSkills: 7,
  problemSolving: 7,
  communication: 7,
  systemDesign: 7,
  coding: 7,
  behavioral: 7,
  overallPerformance: 7,
}

export function FeedbackPage() {
  const { bookingId = '' } = useParams()
  const navigate = useNavigate()
  const interviewer = useSession()
  const { pushToast } = useToast()
  const bookingState = useAsync(() => getBooking(bookingId), [bookingId])
  const existing = useAsync(() => getBookingFeedback(bookingId), [bookingId])
  const [scores, setScores] = useState<FeedbackScores>(defaultScores)
  const [strengths, setStrengths] = useState<string[]>([])
  const [improvements, setImprovements] = useState<string[]>([])
  const [detailed, setDetailed] = useState('')
  const [nextSteps, setNextSteps] = useState('')
  const [readiness, setReadiness] = useState<Readiness>('Almost Ready')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (bookingState.status !== 'success') return
    setSubmitting(true)
    try {
      await submitBookingFeedback(bookingId, {
        candidateId: bookingState.data.candidateId,
        scores,
        strengths,
        improvements,
        detailedFeedback: detailed,
        nextSteps,
        readiness,
      })
      pushToast('Private candidate feedback submitted')
      navigate('/interviewer/dashboard')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (bookingState.status === 'loading' || existing.status === 'loading') {
    return <Skeleton className="h-96" />
  }
  if (bookingState.status === 'error') {
    return <ErrorState body={bookingState.error} />
  }

  const booking = bookingState.data
  const candidate = getCandidateById(booking.candidateId)
  const already = existing.status === 'success' ? existing.data : null
  const allowed = canSubmitPrivateFeedback(booking, interviewer.id, Boolean(already))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-950">Candidate Interview Feedback</h1>
        <p className="mt-2 text-sm text-slate-600">
          This feedback is private and is visible only to the candidate and authorized RoundOne staff.
        </p>
        <div className="mt-3">
          <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {candidate?.name} · {booking.serviceName}
        </p>
      </div>

      {already ? <SubmittedFeedback report={already} /> : null}

      {!already && !allowed ? (
        <Card className="p-5">
          <p className="text-sm text-slate-600">
            Final private feedback can only be submitted after a completed interview that you own, and only once.
            This booking is currently <strong>{booking.status}</strong>.
          </p>
          <Link to="/interviewer/bookings" className="mt-4 inline-block">
            <Button variant="outline">Back to bookings</Button>
          </Link>
        </Card>
      ) : null}

      {allowed ? (
        <form className="space-y-6" onSubmit={onSubmit}>
          <Card className="p-5">
            <h2 className="font-semibold text-navy-950">Evaluation</h2>
            <p className="mt-1 text-sm text-slate-500">1–10 scale. This scorecard is never shown on your public profile.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {dimensions.map((item) => (
                <label key={item.key} className="block text-sm">
                  <span className="font-medium text-slate-800">{item.label}</span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores[item.key]}
                      onChange={(event) => setScores({ ...scores, [item.key]: Number(event.target.value) })}
                      className="w-full accent-navy-950"
                    />
                    <span className="w-8 text-right font-semibold text-navy-950">{scores[item.key]}</span>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="grid gap-5 p-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">Strengths</legend>
              <div className="flex flex-wrap gap-2">
                {STRENGTH_TAGS.map((tag) => (
                  <Chip key={tag} active={strengths.includes(tag)} onClick={() => setStrengths(toggle(strengths, tag))}>
                    {tag}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">Areas to Improve</legend>
              <div className="flex flex-wrap gap-2">
                {IMPROVEMENT_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    active={improvements.includes(tag)}
                    onClick={() => setImprovements(toggle(improvements, tag))}
                  >
                    {tag}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div>
              <FieldLabel htmlFor="detail">Detailed Feedback</FieldLabel>
              <TextArea
                id="detail"
                required
                className="min-h-40"
                value={detailed}
                onChange={(event) => setDetailed(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="next">Recommended Next Steps</FieldLabel>
              <TextArea id="next" required value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">Interview Readiness</legend>
              <div className="flex flex-wrap gap-2">
                {(['Ready', 'Almost Ready', 'Needs More Practice'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setReadiness(item)}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                      readiness === item ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <div className="sticky bottom-4">
            <Button type="submit" disabled={submitting} fullWidth>
              Submit Private Feedback
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function SubmittedFeedback({ report }: { report: InterviewerFeedback }) {
  return (
    <Card className="p-5">
      <p className="font-semibold text-emerald-800">Feedback Submitted ✓</p>
      <p className="mt-2 text-sm text-slate-600">
        Overall Performance {report.scores.overallPerformance}/10 · {report.readiness}
      </p>
      <p className="mt-3 text-sm text-slate-600">{report.detailedFeedback}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {report.strengths.map((item) => (
          <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            {item}
          </span>
        ))}
        {report.improvements.map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {item}
          </span>
        ))}
      </div>
      <Link to="/interviewer/bookings" className="mt-4 inline-block">
        <Button variant="outline">Back to bookings</Button>
      </Link>
    </Card>
  )
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
