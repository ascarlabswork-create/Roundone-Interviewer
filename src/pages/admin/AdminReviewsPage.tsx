import { useState } from 'react'
import { AdminPager } from '../../components/admin/AdminPager.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../../components/ui/DataTable.tsx'
import { Tabs } from '../../components/ui/dashboard.tsx'
import { StarRating } from '../../components/ui/identity.tsx'
import { Badge, Card, ErrorState, PageHeader, Skeleton, TextInput } from '../../components/ui/primitives.tsx'
import { VisibilityLabel } from '../../components/ui/VisibilityLabel.tsx'
import { formatReviewDate } from '../../lib/dates.ts'
import { useAsync } from '../../lib/useAsync.ts'
import {
  listAdminReviews,
  moderateAdminReview,
  type AdminModerationStatus,
} from '../../services/adminOperations.ts'
import { useToast } from '../../state/toast.tsx'

const FILTERS: Array<{ id: 'all' | AdminModerationStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

function toneFor(status: AdminModerationStatus): 'amber' | 'green' | 'red' {
  if (status === 'approved') return 'green'
  if (status === 'rejected') return 'red'
  return 'amber'
}

export function AdminReviewsPage() {
  const { pushToast } = useToast()
  const [status, setStatus] = useState<'all' | AdminModerationStatus>('pending')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState<string | null>(null)
  const state = useAsync(() => listAdminReviews({ status, search: appliedSearch, page }), [status, appliedSearch, page])

  async function moderate(id: string, next: 'approved' | 'rejected') {
    setActingId(id)
    try {
      await moderateAdminReview(id, next)
      pushToast(next === 'approved' ? 'Review approved' : 'Review rejected')
      state.reload()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not moderate this review.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review moderation"
        subtitle="Only approved reviews appear in candidate_reviews_public. Private feedback is not shown here."
      />
      <VisibilityLabel visibility="public" topic="Candidate Review" />
      <Tabs
        items={FILTERS}
        value={status}
        onChange={(id) => {
          setStatus(id as typeof status)
          setPage(1)
        }}
      />
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          setAppliedSearch(search)
          setPage(1)
        }}
      >
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search interviewer or public display name"
        />
        <Button type="submit">Search</Button>
      </form>

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No reviews in this view.</p>
      ) : null}
      {state.status === 'success' && state.data.items.length > 0 ? (
        <>
          <DataTable headers={['Interviewer', 'Public identity', 'Rating', 'Review', 'Submitted', 'Status', '']}>
            {state.data.items.map((row) => (
              <TableRow key={row.id}>
                <Td>{row.interviewerName}</Td>
                <Td>{row.displayName}</Td>
                <Td>
                  <StarRating value={row.overallRating} />
                </Td>
                <Td>
                  <p className="max-w-sm text-sm text-slate-600">{row.writtenReview || '—'}</p>
                </Td>
                <Td>{formatReviewDate(row.createdAt)}</Td>
                <Td>
                  <Badge tone={toneFor(row.moderationStatus)}>{row.moderationStatus}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    {row.moderationStatus !== 'approved' ? (
                      <Button size="sm" disabled={actingId !== null} onClick={() => void moderate(row.id, 'approved')}>
                        Approve
                      </Button>
                    ) : null}
                    {row.moderationStatus !== 'rejected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId !== null}
                        onClick={() => void moderate(row.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </TableRow>
            ))}
          </DataTable>
          <div className="space-y-3 lg:hidden">
            {state.data.items.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy-950">{row.interviewerName}</p>
                    <p className="text-xs text-slate-500">{row.displayName}</p>
                  </div>
                  <Badge tone={toneFor(row.moderationStatus)}>{row.moderationStatus}</Badge>
                </div>
                <div className="mt-2">
                  <StarRating value={row.overallRating} />
                </div>
                {row.writtenReview ? <p className="mt-2 text-sm text-slate-600">{row.writtenReview}</p> : null}
                <p className="mt-2 text-xs text-slate-500">{formatReviewDate(row.createdAt)}</p>
                <div className="mt-3 flex gap-2">
                  {row.moderationStatus !== 'approved' ? (
                    <Button size="sm" disabled={actingId !== null} onClick={() => void moderate(row.id, 'approved')}>
                      Approve
                    </Button>
                  ) : null}
                  {row.moderationStatus !== 'rejected' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId !== null}
                      onClick={() => void moderate(row.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
          <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onPage={setPage} />
        </>
      ) : null}
    </div>
  )
}
