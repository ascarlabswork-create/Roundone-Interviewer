import { Link } from 'react-router-dom'
import { listCandidates } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../components/ui/DataTable.tsx'
import { Avatar } from '../components/ui/identity.tsx'
import { Badge, Card, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'

export function CandidatesPage() {
  const state = useAsync(() => listCandidates(), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="People who have booked or requested a session with you. Contact details stay private."
      />
      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' ? (
        <>
          <DataTable headers={['Candidate Name', 'Target Role', 'Experience', 'Target Company', 'Interview Type', 'Skills', '']}>
            {state.data.map((candidate) => (
              <TableRow key={candidate.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar src={candidate.photo} name={candidate.name} size="sm" />
                    <span className="font-medium text-navy-950">{candidate.name}</span>
                  </div>
                </Td>
                <Td>{candidate.targetRole}</Td>
                <Td>{candidate.experience}</Td>
                <Td>{candidate.targetCompany}</Td>
                <Td>{candidate.interviewType}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills.slice(0, 3).map((skill) => (
                      <Badge key={skill}>{skill}</Badge>
                    ))}
                  </div>
                </Td>
                <Td>
                  <Link to={`/interviewer/candidates/${candidate.id}`}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                </Td>
              </TableRow>
            ))}
          </DataTable>
          <div className="space-y-3 lg:hidden">
            {state.data.map((candidate) => (
              <Card key={candidate.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={candidate.photo} name={candidate.name} size="sm" />
                  <div>
                    <p className="font-semibold text-navy-950">{candidate.name}</p>
                    <p className="text-sm text-slate-600">
                      {candidate.targetRole} · {candidate.targetCompany}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{candidate.experience}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
                <Link to={`/interviewer/candidates/${candidate.id}`} className="mt-4 block">
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
