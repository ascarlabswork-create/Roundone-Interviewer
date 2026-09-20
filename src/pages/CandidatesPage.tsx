import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { formatDateShortInZone } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { listMyCandidates } from '../services/interviewerCandidates.ts'

export function CandidatesPage() {
  const state = useAsync(() => listMyCandidates(), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="People who have booked or requested a session with you. Only booking-safe summary fields are shown."
      />
      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.length === 0 ? (
        <EmptyState title="No candidates yet" body="Candidates appear here after they book one of your services." />
      ) : null}
      {state.status === 'success' && state.data.length > 0 ? (
        <>
          <DataTable headers={['Candidate', 'Target role', 'Level', 'Skills', 'Sessions', '']}>
            {state.data.map((row) => {
              const latest = row.bookings[0]
              return (
                <TableRow key={row.candidate.candidateProfileId}>
                  <Td>
                    <p className="font-medium text-navy-950">{row.candidate.name}</p>
                    {latest ? (
                      <p className="text-xs text-slate-500">
                        Latest {formatDateShortInZone(latest.startsAtUtc, latest.displayTimezone)}
                      </p>
                    ) : null}
                  </Td>
                  <Td>{row.candidate.targetRole || '—'}</Td>
                  <Td>{row.candidate.candidateLevel || '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {row.candidate.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill}>{skill}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>{row.bookings.length}</Td>
                  <Td>
                    <Link to={`/interviewer/candidates/${row.candidate.candidateProfileId}`}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  </Td>
                </TableRow>
              )
            })}
          </DataTable>
          <div className="space-y-3 lg:hidden">
            {state.data.map((row) => (
              <Card key={row.candidate.candidateProfileId} className="p-4">
                <p className="font-semibold text-navy-950">{row.candidate.name}</p>
                <p className="text-sm text-slate-600">
                  {[row.candidate.targetRole, row.candidate.candidateLevel].filter(Boolean).join(' · ') ||
                    'No role details'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {row.candidate.skills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
                <Link to={`/interviewer/candidates/${row.candidate.candidateProfileId}`} className="mt-4 block">
                  <Button size="sm" variant="outline" fullWidth>
                    View history
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
