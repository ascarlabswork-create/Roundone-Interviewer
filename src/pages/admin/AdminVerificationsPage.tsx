import { useMemo, useState } from 'react'
import { AdminPager } from '../../components/admin/AdminPager.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { VerificationBadge } from '../../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../../components/ui/dashboard.tsx'
import { Badge, Card, ErrorState, FieldLabel, PageHeader, Skeleton, TextArea, TextInput } from '../../components/ui/primitives.tsx'
import { formatReviewDate } from '../../lib/dates.ts'
import { formatINR } from '../../lib/format.ts'
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

type InterviewerGroup = {
  interviewerProfileId: string
  profile: AdminVerificationRow
  checks: AdminVerificationRow[]
}

function Chip({ children }: { children: string }) {
  return <Badge tone="slate">{children}</Badge>
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-navy-950">{value}</p>
    </div>
  )
}

function InterviewerProfilePanel({ row }: { row: AdminVerificationRow }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-navy-950">{row.interviewerName}</p>
        <p className="text-sm text-slate-600">{row.headline || row.currentRole || 'No headline'}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailLine label="Current role" value={row.currentRole || '—'} />
        <DetailLine label="Company" value={row.company || '—'} />
        <DetailLine
          label="Years of experience"
          value={row.experienceYears !== null ? `${row.experienceYears} years` : '—'}
        />
        <DetailLine label="Timezone" value={row.timezone || '—'} />
        <DetailLine label="Languages" value={row.languages.length ? row.languages.join(', ') : '—'} />
        <DetailLine label="Listed for candidates" value={row.isListed ? 'Yes' : 'No'} />
        <DetailLine label="WhatsApp" value={row.whatsappPhone || '—'} />
        <DetailLine label="ID document" value={row.hasDocument ? 'Uploaded' : 'None'} />
      </div>

      {row.bio ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bio / summary</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{row.bio}</p>
        </div>
      ) : (
        <DetailLine label="Bio / summary" value="—" />
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Skills</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.skills.length ? row.skills.map((skill) => <Chip key={skill}>{skill}</Chip>) : <span className="text-sm text-slate-500">—</span>}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Target roles they interview for</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.targetRoles.length ? (
            row.targetRoles.map((role) => <Chip key={role}>{role}</Chip>)
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Candidate levels</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.candidateLevels.length ? (
            row.candidateLevels.map((level) => <Chip key={level}>{level}</Chip>)
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Services offered</p>
        {row.services.length ? (
          <ul className="mt-2 space-y-2">
            {row.services.map((service) => (
              <li key={`${service.name}-${service.interviewType}-${service.durationMin}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-navy-950">
                  {service.name}
                  {!service.isActive ? <span className="ml-2 text-xs font-normal text-slate-500">(inactive)</span> : null}
                </p>
                <p className="text-xs text-slate-600">
                  {service.interviewType} · {service.durationMin} min
                  {service.pricePaise !== null ? ` · ${formatINR(service.pricePaise / 100)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No services yet</p>
        )}
      </div>
    </div>
  )
}

function groupByInterviewer(items: AdminVerificationRow[]): InterviewerGroup[] {
  const map = new Map<string, InterviewerGroup>()
  for (const row of items) {
    const existing = map.get(row.interviewerProfileId)
    if (existing) {
      existing.checks.push(row)
      continue
    }
    map.set(row.interviewerProfileId, {
      interviewerProfileId: row.interviewerProfileId,
      profile: row,
      checks: [row],
    })
  }
  return [...map.values()]
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
  const state = useAsync(() => listAdminVerifications({ status, search: appliedSearch, page }), [
    status,
    appliedSearch,
    page,
  ])

  const groups = useMemo(
    () => (state.status === 'success' ? groupByInterviewer(state.data.items) : []),
    [state],
  )

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
        subtitle="Each card shows the interviewer’s full profile (skills, experience, services). Approve identity and employment after review."
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
      {state.status === 'success' && groups.length === 0 ? (
        <p className="text-sm text-slate-500">No verification records in this view.</p>
      ) : null}

      {groups.map((group) => (
        <Card key={group.interviewerProfileId} className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Interviewer profile</p>
            <div className="mt-3">
              <InterviewerProfilePanel row={group.profile} />
            </div>
          </div>

          <div className="space-y-3 px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-navy-950">Verification checks</p>
            {group.checks.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium capitalize text-navy-950">{row.kind}</p>
                    <VerificationBadge status={row.status as VerificationStatus} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Document: {row.hasDocument ? 'Uploaded' : 'None'}
                    {row.reviewedAt ? ` · Reviewed ${formatReviewDate(row.reviewedAt)}` : ''}
                  </p>
                  {row.notes ? <p className="mt-1 text-sm text-slate-600">{row.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
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
              </div>
            ))}
          </div>
        </Card>
      ))}

      {state.status === 'success' && state.data.items.length > 0 ? (
        <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onPage={setPage} />
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
