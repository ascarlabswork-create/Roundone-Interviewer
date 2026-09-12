import { useState } from 'react'
import { listInterviewerReviews, respondToReview } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { SlideOver } from '../components/ui/dashboard.tsx'
import { StarRating } from '../components/ui/identity.tsx'
import { Card, ErrorState, PageHeader, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { REVIEW_DIMENSIONS } from '../data/catalogs.ts'
import { currentInterviewer } from '../data/interviewer.ts'
import { formatCount } from '../lib/format.ts'
import { formatReviewDate } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { useToast } from '../state/toast.tsx'
import type { CandidateReview } from '../types.ts'

export function ReviewsPage() {
  const state = useAsync(() => listInterviewerReviews(currentInterviewer.id), [])
  const { pushToast } = useToast()
  const [viewing, setViewing] = useState<CandidateReview | null>(null)
  const [responding, setResponding] = useState<CandidateReview | null>(null)
  const [text, setText] = useState('')

  const averages =
    state.status === 'success'
      ? REVIEW_DIMENSIONS.map((item) => ({
          ...item,
          value:
            state.data.reduce((sum, review) => sum + review.dimensions[item.key], 0) / Math.max(state.data.length, 1),
        }))
      : []

  async function onRespond() {
    if (!responding || !text.trim()) return
    await respondToReview(responding.id, text.trim())
    pushToast('Response saved. It will appear with this public candidate review.')
    setResponding(null)
    setText('')
    state.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews & Reputation"
        subtitle="Public ratings candidates leave about you. This is not private performance feedback."
      />
      <VisibilityLabel visibility="public" topic="Candidate Review" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5 sm:col-span-2 xl:col-span-1">
          <p className="text-sm text-slate-500">Overall Rating</p>
          <p className="mt-2 text-3xl font-semibold text-navy-950">{currentInterviewer.rating} / 5</p>
          <div className="mt-2">
            <StarRating value={currentInterviewer.rating} size="md" />
          </div>
        </Card>
        <Metric label="Total Reviews" value={formatCount(currentInterviewer.reviewCount)} />
        <Metric label="Completed Interviews" value={formatCount(currentInterviewer.completedInterviews)} />
        <Metric label="Candidate Satisfaction" value={`${currentInterviewer.satisfactionRate}%`} />
        <Metric label="Completion Rate" value={`${currentInterviewer.completionRate}%`} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-navy-950">Rating breakdown</h2>
        <div className="mt-4 space-y-3">
          {averages.map((item) => (
            <div key={item.key}>
              <div className="flex justify-between text-sm">
                <span>{item.label}</span>
                <span className="font-medium text-navy-950">{item.value.toFixed(1)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-50">
                <div className="h-2 rounded-full bg-navy-950" style={{ width: `${(item.value / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-navy-950">Recent public candidate reviews</h2>
        <p className="mt-1 text-sm text-slate-500">You cannot edit a candidate’s rating, review, date, or name.</p>
      </div>

      {state.status === 'loading' ? <Skeleton className="h-48" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' ? (
        <div className="grid gap-4">
          {state.data.map((review) => (
            <Card key={review.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <VisibilityLabel visibility="public" topic="Candidate Review" />
                <StarRating value={review.rating} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">“{review.text}”</p>
              <p className="mt-3 text-sm text-slate-500">
                Candidate: {review.publicDisplayName}
                <span className="mx-2">·</span>
                Date: {formatReviewDate(review.date)}
              </p>
              {review.response ? (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="font-medium text-navy-950">Your response · </span>
                  {review.response}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewing(review)}>
                  View Review
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResponding(review)
                    setText(review.response ?? '')
                  }}
                >
                  Respond to Review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <SlideOver title="Public candidate review" open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="space-y-4">
            <VisibilityLabel visibility="public" topic="Candidate Review" />
            <StarRating value={viewing.rating} size="md" />
            <p className="text-sm leading-6 text-slate-700">“{viewing.text}”</p>
            <dl className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <dt>Candidate</dt>
                <dd className="font-medium text-navy-950">{viewing.publicDisplayName}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Date</dt>
                <dd>{formatReviewDate(viewing.date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Interview type</dt>
                <dd>{viewing.interviewType}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500">Rating, review text, date, and author cannot be edited.</p>
          </div>
        ) : null}
      </SlideOver>

      <SlideOver title="Respond to review" open={Boolean(responding)} onClose={() => setResponding(null)}>
        <VisibilityLabel visibility="public" topic="Candidate Review" />
        <p className="mt-3 text-sm text-slate-500">
          Future-ready: this response will sit next to the public review. It does not change the candidate’s rating.
        </p>
        <TextArea className="mt-4" value={text} onChange={(event) => setText(event.target.value)} />
        <Button className="mt-4" fullWidth onClick={onRespond}>
          Save response
        </Button>
      </SlideOver>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy-950">{value}</p>
    </Card>
  )
}
