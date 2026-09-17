import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Card, ErrorState, FieldLabel, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { SuggestionChips } from '../components/ui/suggestions.tsx'
import { IMPROVEMENT_TAGS, STRENGTH_TAGS } from '../data/catalogs.ts'
import { formatDateLongInZone, formatTimeInZone, timezoneLabel } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { cn } from '../lib/cn.ts'
import { getMyBooking } from '../services/interviewerBookings.ts'
import {
  FEEDBACK_ALREADY_SUBMITTED,
  READINESS_LABELS,
  READINESS_LEVELS,
  canSubmitInterviewerFeedback,
  getMyFeedbackForBooking,
  submitInterviewerFeedback,
  validateFeedbackInput,
  type InterviewerFeedbackRecord,
  type ReadinessLevel,
} from '../services/interviewerFeedback.ts'
import { useToast } from '../state/toast.tsx'

type ScoreKey = 'overall' | 'technicalSkills' | 'problemSolving' | 'communication' | 'systemDesign' | 'coding' | 'behavioral'

const requiredScores: Array<{ key: ScoreKey; label: string }> = [
  { key: 'overall', label: 'Overall performance' },
  { key: 'technicalSkills', label: 'Technical knowledge' },
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'communication', label: 'Communication' },
]

const optionalScores: Array<{ key: ScoreKey; label: string }> = [
  { key: 'systemDesign', label: 'System design' },
  { key: 'coding', label: 'Coding' },
  { key: 'behavioral', label: 'Behavioral' },
]

export function FeedbackPage() {
  const { bookingId = '' } = useParams()
  const { pushToast } = useToast()
  const bookingState = useAsync(() => getMyBooking(bookingId), [bookingId])
  const existing = useAsync(() => getMyFeedbackForBooking(bookingId), [bookingId])
  const [scores, setScores] = useState<Record<ScoreKey, number | null>>({
    overall: null,
    technicalSkills: null,
    problemSolving: null,
    communication: null,
    systemDesign: null,
    coding: null,
    behavioral: null,
  })
  const [strengths, setStrengths] = useState<string[]>([])
  const [improvements, setImprovements] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [readiness, setReadiness] = useState<ReadinessLevel | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [saved, setSaved] = useState<InterviewerFeedbackRecord | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (bookingState.status !== 'success') return
    if (saved || (existing.status === 'success' && existing.data)) {
      setFormError(FEEDBACK_ALREADY_SUBMITTED)
      return
    }

    if (!readiness) {
      setFormError('Please select a readiness level.')
      return
    }

    const payload = {
      bookingId: bookingState.data.id,
      technicalSkills: scores.technicalSkills ?? 0,
      problemSolving: scores.problemSolving ?? 0,
      communication: scores.communication ?? 0,
      overall: scores.overall ?? 0,
      strengths,
      improvements,
      summary,
      readiness,
      systemDesign: scores.systemDesign,
      coding: scores.coding,
      behavioral: scores.behavioral,
      internalNotes,
    }
    const invalid = validateFeedbackInput(payload)
    if (invalid) {
      setFormError(invalid)
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      const savedReport = await submitInterviewerFeedback(payload)
      setSaved(savedReport)
      setJustSubmitted(true)
      pushToast('Feedback submitted successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit feedback. Please try again.'
      setFormError(message)
      pushToast(message)
      if (message === FEEDBACK_ALREADY_SUBMITTED) existing.reload()
    } finally {
      setSubmitting(false)
    }
  }

  if (bookingState.status === 'loading' || (existing.status === 'loading' && !saved)) {
    return <Skeleton className="h-96" />
  }
  if (bookingState.status === 'error') {
    return <ErrorState body={bookingState.error} />
  }
  if (existing.status === 'error' && !saved) {
    return <ErrorState body={existing.error} onRetry={existing.reload} />
  }

  const booking = bookingState.data
  const already = saved ?? (existing.status === 'success' ? existing.data : null)
  const allowed = canSubmitInterviewerFeedback(booking.status, Boolean(already))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-950">Interview Feedback</h1>
        <p className="mt-2 text-sm text-slate-600">
          Private performance feedback for this candidate. Internal notes stay with you.
        </p>
        <div className="mt-3">
          <VisibilityLabel visibility="private" topic="Candidate Performance Feedback" />
        </div>
      </div>

      <Card className="grid gap-3 p-5 text-sm sm:grid-cols-2">
        <SummaryField label="Candidate" value={booking.candidate.name} />
        <SummaryField label="Target role" value={booking.candidate.targetRole || '—'} />
        <SummaryField label="Interview type" value={booking.interviewType} />
        <SummaryField label="Service" value={booking.serviceName} />
        <SummaryField
          label="Interview date"
          value={`${formatDateLongInZone(booking.startsAtUtc, booking.displayTimezone)} · ${formatTimeInZone(booking.startsAtUtc, booking.displayTimezone)} (${timezoneLabel(booking.displayTimezone)})`}
        />
      </Card>

      {justSubmitted ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">Feedback submitted successfully</p>
        </Card>
      ) : null}

      {already ? <SubmittedFeedback report={already} /> : null}

      {!already && !allowed ? (
        <Card className="p-5">
          <p className="text-sm text-slate-600">
            Feedback can only be submitted after a completed interview that you own, and only once.
          </p>
          <Link to="/interviewer/bookings" className="mt-4 inline-block">
            <Button variant="outline">Back to bookings</Button>
          </Link>
        </Card>
      ) : null}

      {allowed ? (
        <form className="space-y-6" onSubmit={onSubmit}>
          {formError ? (
            <Card className="border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{formError}</p>
            </Card>
          ) : null}

          <Card className="space-y-5 p-5">
            <div>
              <h2 className="font-semibold text-navy-950">1. Performance</h2>
              <p className="mt-1 text-sm text-slate-500">
                Candidate-visible scores, 1–5. Optional dimensions can be left unassessed.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {requiredScores.map((item) => (
                <ScoreField
                  key={item.key}
                  label={item.label}
                  required
                  value={scores[item.key]}
                  onChange={(value) => setScores({ ...scores, [item.key]: value })}
                />
              ))}
              {optionalScores.map((item) => (
                <ScoreField
                  key={item.key}
                  label={item.label}
                  value={scores[item.key]}
                  onChange={(value) => setScores({ ...scores, [item.key]: value })}
                />
              ))}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">
                Interview readiness <span className="text-red-600">*</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {READINESS_LEVELS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setReadiness(item)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium',
                      readiness === item ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {READINESS_LABELS[item]}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-navy-950">2. Strengths</h2>
            <p className="mt-1 text-sm text-slate-500">Visible to the candidate.</p>
            <div className="mt-4">
              <SuggestionChips
                id="custom-strength"
                suggestions={STRENGTH_TAGS}
                value={strengths}
                onChange={setStrengths}
                placeholder="Type to add a strength"
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-navy-950">3. Areas for Improvement</h2>
            <p className="mt-1 text-sm text-slate-500">Visible to the candidate.</p>
            <div className="mt-4">
              <SuggestionChips
                id="custom-improvement"
                suggestions={IMPROVEMENT_TAGS}
                value={improvements}
                onChange={setImprovements}
                placeholder="Type to add an area to improve"
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-navy-950">4. Summary</h2>
            <p className="mt-1 text-sm text-slate-500">Visible to the candidate.</p>
            <div className="mt-4">
              <FieldLabel htmlFor="summary">Candidate summary</FieldLabel>
              <TextArea
                id="summary"
                required
                className="min-h-40"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
          </Card>

          <Card className="border-slate-300 bg-slate-50 p-5">
            <VisibilityLabel visibility="private" topic="Interviewer-only" />
            <h2 className="mt-3 font-semibold text-navy-950">5. Internal Notes</h2>
            <p className="mt-1 text-sm text-slate-600">
              Only you can see this. The candidate will never see these notes.
            </p>
            <div className="mt-4">
              <FieldLabel htmlFor="internal-notes">Internal notes</FieldLabel>
              <TextArea
                id="internal-notes"
                className="min-h-32 bg-white"
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Private observations, calibration notes, or follow-up reminders."
              />
            </div>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to="/interviewer/bookings">
              <Button type="button" variant="outline" fullWidth className="sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting} className="sm:min-w-44">
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}</span>
      <br />
      <span className="font-medium text-navy-950">{value}</span>
    </p>
  )
}

function ScoreField({
  label,
  required,
  value,
  onChange,
}: {
  label: string
  required?: boolean
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="text-red-600"> *</span> : <span className="font-normal text-slate-500"> (optional)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {required ? null : (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              value === null ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700',
            )}
          >
            Not assessed
          </button>
        )}
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={cn(
              'h-9 w-9 rounded-full text-sm font-semibold',
              value === score ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700',
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function SubmittedFeedback({ report }: { report: InterviewerFeedbackRecord }) {
  const scoreRows: Array<{ label: string; value: number | null }> = [
    { label: 'Overall performance', value: report.overall },
    { label: 'Technical knowledge', value: report.technicalSkills },
    { label: 'Problem solving', value: report.problemSolving },
    { label: 'Communication', value: report.communication },
    { label: 'System design', value: report.systemDesign },
    { label: 'Coding', value: report.coding },
    { label: 'Behavioral', value: report.behavioral },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="font-semibold text-emerald-800">Feedback Submitted</p>
        <p className="mt-1 text-sm text-slate-500">Candidate-visible feedback. Internal notes are listed separately below.</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {scoreRows.map((row) => (
            <div key={row.label}>
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="font-medium text-navy-950">{row.value == null ? 'Not assessed' : `${row.value}/5`}</dd>
            </div>
          ))}
          <div>
            <dt className="text-slate-500">Readiness</dt>
            <dd className="font-medium text-navy-950">{READINESS_LABELS[report.readiness]}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600">{report.summary}</p>
        {report.strengths.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {report.strengths.map((item) => (
              <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {report.improvements.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {report.improvements.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </Card>
      <Card className="border-slate-300 bg-slate-50 p-5">
        <VisibilityLabel visibility="private" topic="Interviewer-only" />
        <h2 className="mt-3 font-semibold text-navy-950">Internal Notes</h2>
        <p className="mt-2 text-sm text-slate-600">{report.internalNotes?.trim() || 'No internal notes.'}</p>
      </Card>
      <Link to="/interviewer/bookings" className="inline-block">
        <Button variant="outline">Back to bookings</Button>
      </Link>
    </div>
  )
}
