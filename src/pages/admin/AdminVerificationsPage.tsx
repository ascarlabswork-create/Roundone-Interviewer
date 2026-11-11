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
  type AdminVerificationRow,
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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-navy-950">{value}</p>
    </div>
  )
}

function InterviewerProfileDetails({ row }: { row: AdminVerificationRow }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-navy-950">{row.interviewerName}</p>
        <p className="text-sm text-slate-600">{row.headline || row.currentRole || 'No headline'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailLine label="Current role" value={row.currentRole || '—'} />
        <DetailLine label="Company" value={row.company || '—'} />
        <DetailLine
          label="Experience"
          value={row.experienceYears !== null ? `${row.experienceYears} years` : '—'}
        />
        <DetailLine label="Timezone" value={row.timezone || '—'} />
        <DetailLine label="Languages" value={row.languages.length ? row.languages.join(', ') : '—'} />
        <DetailLine label="Listed for candidates" value={row.isListed ? 'Yes' : 'No'} />
        <DetailLine label="WhatsApp" value={row.whatsappPhone || '—'} />
        <DetailLine label="Document" value={row.hasDocument ? 'Uploaded' : 'None'} />
      </div>
      {row.bio ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bio</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{row.bio}</p>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Skills</p>
        <p className="mt-1 text-sm text-navy-950">{row.skills.length ? row.skills.join(', ') : '—'}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Target roles</p>
        <p className="mt-1 text-sm text-navy-950">{row.targetRoles.length ? row.targetRoles.join(', ') : '—'}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Candidate levels</p>
        <p className="mt-1 text-sm text-navy-950">
          {row.candidateLevels.length ? row.candidateLevels.join(', ') : '—'}
        </p>
      </div>
      {row.notes ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin notes</p>
          <p className="mt-1 text-sm text-slate-700">{row.notes}</p>
        </div>
      ) : null}
    </div>
  )
}

export function AdminVerificationsPage() {
  const { pushToast } = useToast()
  const [status, setStatus] = useState<'all' | AdminVerificationStatus>('pending')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState<string | null>(null)
  const [notesFor, setNotesFor] = useState<{ id: string; next: AdminVerificationStatus } | null>(null)
  const [notes, setNotes] = useState('')
  const [detailRow, setDetailRow] = useState<AdminVerificationRow | null>(null)
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
      setDetailRow(null)
      state.reload()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update verification.')
    } finally {
      setActingId(null)
    }
  }

  function actionButtons(row: AdminVerificationRow) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={actingId !== null} onClick={() => setDetailRow(row)}>
          View profile
        </Button>
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
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviewer verification"
        subtitle="Review full interviewer profiles, then approve or reject identity and employment."
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
          <DataTable headers={['Interviewer', 'Kind', 'Status', 'Experience', 'Skills', 'Reviewed', '']}>
            {state.data.items.map((row) => (
              <TableRow key={row.id}>
                <Td>
                  <p className="font-medium text-navy-950">{row.interviewerName}</p>
                  <p className="text-xs text-slate-500">
                    {row.currentRole}
                    {row.company ? ` · ${row.company}` : ''}
                  </p>
                  {row.headline ? <p className="mt-0.5 text-xs text-slate-500">{row.headline}</p> : null}
                </Td>
                <Td className="capitalize">{row.kind}</Td>
                <Td>
                  <VerificationBadge status={row.status as VerificationStatus} />
                </Td>
                <Td>
                  {row.experienceYears !== null ? `${row.experienceYears} yrs` : '—'}
                  {row.languages.length ? (
                    <p className="text-xs text-slate-500">{row.languages.join(', ')}</p>
                  ) : null}
                </Td>
                <Td>
                  <p className="max-w-[14rem] truncate text-sm text-slate-700">
                    {row.skills.length ? row.skills.join(', ') : '—'}
                  </p>
                  {row.targetRoles.length ? (
                    <p className="max-w-[14rem] truncate text-xs text-slate-500">{row.targetRoles.join(', ')}</p>
                  ) : null}
                </Td>
                <Td>{row.reviewedAt ? formatReviewDate(row.reviewedAt) : '—'}</Td>
                <Td>{actionButtons(row)}</Td>
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
                      {row.experienceYears !== null ? ` · ${row.experienceYears} yrs` : ''}
                    </p>
                  </div>
                  <VerificationBadge status={row.status as VerificationStatus} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Skills: {row.skills.length ? row.skills.join(', ') : 'None'}
                </p>
                <div className="mt-3">{actionButtons(row)}</div>
              </Card>
            ))}
          </div>
          <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onPage={setPage} />
        </>
      ) : null}

      <SlideOver
        title={detailRow ? `${detailRow.interviewerName} · ${detailRow.kind}` : 'Interviewer profile'}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
      >
        {detailRow ? (
          <div className="space-y-6">
            <InterviewerProfileDetails row={detailRow} />
            <div className="flex flex-col gap-2">
              {detailRow.status !== 'verified' ? (
                <Button
                  fullWidth
                  disabled={actingId !== null}
                  onClick={() => void applyStatus(detailRow.id, 'verified')}
                >
                  Approve {detailRow.kind}
                </Button>
              ) : null}
              {detailRow.status !== 'rejected' ? (
                <Button
                  fullWidth
                  variant="outline"
                  disabled={actingId !== null}
                  onClick={() => {
                    setNotesFor({ id: detailRow.id, next: 'rejected' })
                    setNotes(detailRow.notes ?? '')
                    setDetailRow(null)
                  }}
                >
                  Reject
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SlideOver>

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
