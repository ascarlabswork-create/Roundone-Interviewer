import { useState } from 'react'
import { AdminPager } from '../../components/admin/AdminPager.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../../components/ui/DataTable.tsx'
import { VerificationBadge } from '../../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../../components/ui/dashboard.tsx'
import { Card, ErrorState, FieldLabel, PageHeader, Skeleton, TextArea, TextInput } from '../../components/ui/primitives.tsx'
import { formatReviewDate } from '../../lib/dates.ts'
import { useAsync } from '../../lib/useAsync.ts'
import {
  listAdminVerifications,
  updateAdminVerification,
  type AdminVerificationStatus,
} from '../../services/adminOperations.ts'
import { useToast } from '../../state/toast.tsx'
import type { VerificationStatus } from '../../types.ts'

const FILTERS: Array<{ id: 'all' | AdminVerificationStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
]

export function AdminVerificationsPage() {
  const { pushToast } = useToast()
  const [status, setStatus] = useState<'all' | AdminVerificationStatus>('pending')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState<string | null>(null)
  const [notesFor, setNotesFor] = useState<{ id: string; next: AdminVerificationStatus } | null>(null)
  const [notes, setNotes] = useState('')
  const state = useAsync(() => listAdminVerifications({ status, search: appliedSearch, page }), [
    status,
    appliedSearch,
    page,
  ])

  async function applyStatus(id: string, next: AdminVerificationStatus, note?: string) {
    setActingId(id)
    try {
      await updateAdminVerification(id, next, note)
      pushToast(next === 'verified' ? 'Verification approved' : next === 'rejected' ? 'Verification rejected' : 'Marked pending')
      setNotesFor(null)
      setNotes('')
      state.reload()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update verification.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviewer verification"
        subtitle="Approve or reject identity, employment, and LinkedIn checks. Document files are not exposed here."
      />
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
          placeholder="Search interviewer name"
        />
        <Button type="submit">Search</Button>
      </form>

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No verification records in this view.</p>
      ) : null}
      {state.status === 'success' && state.data.items.length > 0 ? (
        <>
          <DataTable headers={['Interviewer', 'Kind', 'Status', 'Professional', 'Document', 'Reviewed', '']}>
            {state.data.items.map((row) => (
              <TableRow key={row.id}>
                <Td>
                  <p className="font-medium text-navy-950">{row.interviewerName}</p>
                  <p className="text-xs text-slate-500">{row.headline || row.currentRole}</p>
                </Td>
                <Td className="capitalize">{row.kind}</Td>
                <Td>
                  <VerificationBadge status={row.status as VerificationStatus} />
                </Td>
                <Td>
                  {row.currentRole} · {row.company}
                  {row.experienceYears !== null ? ` · ${row.experienceYears} yrs` : ''}
                </Td>
                <Td>{row.hasDocument ? 'Uploaded' : 'None'}</Td>
                <Td>{row.reviewedAt ? formatReviewDate(row.reviewedAt) : '—'}</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status !== 'verified' ? (
                      <Button size="sm" disabled={actingId !== null} onClick={() => void applyStatus(row.id, 'verified')}>
                        Approve
                      </Button>
                    ) : null}
                    {row.status !== 'rejected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId !== null}
                        onClick={() => {
                          setNotesFor({ id: row.id, next: 'rejected' })
                          setNotes(row.notes ?? '')
                        }}
                      >
                        Reject
                      </Button>
                    ) : null}
                    {row.status !== 'pending' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actingId !== null}
                        onClick={() => {
                          setNotesFor({ id: row.id, next: 'pending' })
                          setNotes(row.notes ?? '')
                        }}
                      >
                        Request changes
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
                    <p className="text-sm text-slate-600">
                      {row.kind} · {row.currentRole} · {row.company}
                    </p>
                  </div>
                  <VerificationBadge status={row.status as VerificationStatus} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Document: {row.hasDocument ? 'Uploaded' : 'None'}
                  {row.reviewedAt ? ` · Reviewed ${formatReviewDate(row.reviewedAt)}` : ''}
                </p>
                {row.notes ? <p className="mt-2 text-sm text-slate-600">{row.notes}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status !== 'verified' ? (
                    <Button size="sm" disabled={actingId !== null} onClick={() => void applyStatus(row.id, 'verified')}>
                      Approve
                    </Button>
                  ) : null}
                  {row.status !== 'rejected' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId !== null}
                      onClick={() => {
                        setNotesFor({ id: row.id, next: 'rejected' })
                        setNotes(row.notes ?? '')
                      }}
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

      <SlideOver
        title={notesFor?.next === 'rejected' ? 'Reject verification' : 'Request changes'}
        open={Boolean(notesFor)}
        onClose={() => {
          if (actingId) return
          setNotesFor(null)
        }}
      >
        <p className="text-sm text-slate-600">Notes are stored on the verification record. This does not change the user’s role.</p>
        <div className="mt-4">
          <FieldLabel htmlFor="verification-notes">Notes (optional)</FieldLabel>
          <TextArea id="verification-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <Button
          className="mt-6"
          fullWidth
          disabled={!notesFor || actingId !== null}
          onClick={() => {
            if (!notesFor) return
            void applyStatus(notesFor.id, notesFor.next, notes)
          }}
        >
          {actingId ? 'Saving…' : 'Save'}
        </Button>
      </SlideOver>
    </div>
  )
}
