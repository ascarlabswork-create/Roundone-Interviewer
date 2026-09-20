import { useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { SlideOver } from '../components/ui/dashboard.tsx'
import { StarRating } from '../components/ui/identity.tsx'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { REVIEW_DIMENSIONS } from '../data/catalogs.ts'
import { formatCount } from '../lib/format.ts'
import { formatReviewDate } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { loadMyPublicReviewSummary, listMyPublicReviews, type PublicReviewRecord } from '../services/interviewerReviews.ts'

export function ReviewsPage() {
  const summary = useAsync(() => loadMyPublicReviewSummary(), [])
  const state = useAsync(() => listMyPublicReviews(), [])
  const [viewing, setViewing] = useState<PublicReviewRecord | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews & Reputation"
        subtitle="Only approved public candidate reviews appear here. Private performance feedback is never shown."
      />
      <VisibilityLabel visibility="public" topic="Candidate Review" />

      {summary.status === 'loading' ? <Skeleton className="h-28" /> : null}
      {summary.status === 'error' ? <ErrorState body={summary.error} onRetry={summary.reload} /> : null}
      {summary.status === 'success' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm text-slate-500">Overall Rating</p>
              <p className="mt-2 text-3xl font-semibold text-navy-950">
                {summary.data.averageRating ? `${summary.data.averageRating.toFixed(1)} / 5` : '—'}
              </p>
              {summary.data.averageRating ? (
                <div className="mt-2">
                  <StarRating value={Math.round(summary.data.averageRating)} size="md" />
                </div>
              ) : null}
            </Card>
            <Metric label="Public reviews" value={formatCount(summary.data.count)} />
            <Metric
              label="Source"
              value="Approved only"
            />
          </div>

          <Card className="p-5">
            <h2 className="font-semibold text-navy-950">Rating breakdown</h2>
            <div className="mt-4 space-y-3">
              {REVIEW_DIMENSIONS.map((item) => {
                const value = summary.data.dimensionAverages?.[item.key] ?? 0
                return (
                  <div key={item.key}>
                    <div className="flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-medium text-navy-950">{value ? value.toFixed(1) : '—'}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-50">
                      <div className="h-2 rounded-full bg-navy-950" style={{ width: `${(value / 5) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-navy-950">Recent public candidate reviews</h2>
        <p className="mt-1 text-sm text-slate-500">You cannot edit a candidate’s rating, review, date, or name.</p>
      </div>

      {state.status === 'loading' ? <Skeleton className="h-48" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.length === 0 ? (
        <EmptyState
          title="No public reviews yet"
          body="Approved candidate reviews will appear here after moderation."
        />
      ) : null}
      {state.status === 'success' && state.data.length > 0 ? (
        <div className="grid gap-4">
          {state.data.map((review) => (
            <Card key={review.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <VisibilityLabel visibility="public" topic="Candidate Review" />
                <StarRating value={review.overallRating} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {review.writtenReview ? `“${review.writtenReview}”` : 'No written comments.'}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Candidate: {review.displayName}
                <span className="mx-2">·</span>
                Date: {formatReviewDate(review.createdAt)}
              </p>
              <div className="mt-4">
                <Button size="sm" variant="outline" onClick={() => setViewing(review)}>
                  View Review
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
            <StarRating value={viewing.overallRating} size="md" />
            <p className="text-sm leading-6 text-slate-700">
              {viewing.writtenReview ? `“${viewing.writtenReview}”` : 'No written comments.'}
            </p>
            <dl className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <dt>Candidate</dt>
                <dd className="font-medium text-navy-950">{viewing.displayName}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Date</dt>
                <dd>{formatReviewDate(viewing.createdAt)}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500">Rating, review text, date, and author cannot be edited.</p>
          </div>
        ) : null}
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
