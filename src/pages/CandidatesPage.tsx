import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CandidateMatchCard } from '../components/candidates/CandidateMatchCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Badge, Card, EmptyState, ErrorState, PageHeader, SelectInput, Skeleton, TextInput } from '../components/ui/primitives.tsx'
import { formatCount } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { discoverCandidates, type CandidateDiscoverySort } from '../services/candidateDiscovery.ts'

const SEARCH_DEBOUNCE_MS = 300

export function CandidatesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<CandidateDiscoverySort>('match')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const state = useAsync(() => discoverCandidates({ page, search, sort }), [page, search, sort])

  const data = state.status === 'success' ? state.data : null
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1
  const hasInterviewerSkills = (data?.interviewerSkills.length ?? 0) > 0
  const firstIndex = data ? (data.page - 1) * data.pageSize : 0

  function changePage(next: number) {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Candidates"
        subtitle="Every active candidate on RoundOne, ranked by how well their skills match yours. Low or zero matches are still listed."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="candidate-search" className="sr-only">
              Search candidates
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <TextInput
                id="candidate-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name, role, or skill"
                className="pl-9"
                maxLength={100}
              />
            </div>
          </div>
          <div className="sm:w-56">
            <label htmlFor="candidate-sort" className="mb-1.5 block text-xs font-medium text-slate-600">
              Sort
            </label>
            <SelectInput
              id="candidate-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value === 'name' ? 'name' : 'match')
                setPage(1)
              }}
            >
              <option value="match">Best skill match</option>
              <option value="name">Name</option>
            </SelectInput>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
          <span className="font-medium text-navy-950" aria-live="polite">
            {data
              ? `${formatCount(data.totalCount)} ${data.totalCount === 1 ? 'candidate' : 'candidates'}${search ? ` matching “${search}”` : ''}`
              : 'Loading candidates…'}
          </span>
          {hasInterviewerSkills ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500">Matched against your skills:</span>
              {data?.interviewerSkills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </span>
          ) : null}
        </div>
      </Card>

      {data && !hasInterviewerSkills ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add skills to your profile to see match percentages. All candidates are still listed below.{' '}
          <Link to="/interviewer/profile" className="font-semibold underline">
            Add skills
          </Link>
        </div>
      ) : null}

      {state.status === 'loading' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}

      {data && data.candidates.length === 0 ? (
        search ? (
          <EmptyState
            title="No candidates found"
            body={`No candidates match “${search}”. Try a different name, role, or skill.`}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearchInput('')}>
                Clear search
              </Button>
            }
          />
        ) : data.totalCount > 0 ? (
          <EmptyState
            title="No candidates on this page"
            body="This page is past the end of the list."
            action={
              <Button variant="outline" size="sm" onClick={() => changePage(1)}>
                Back to first page
              </Button>
            }
          />
        ) : (
          <EmptyState title="No candidates yet" body="Active candidates will appear here as they join RoundOne." />
        )
      ) : null}

      {data && data.candidates.length > 0 ? (
        <>
          <ol className="grid gap-4 lg:grid-cols-2" aria-label="Candidates">
            {data.candidates.map((candidate, index) => (
              <li key={candidate.candidateProfileId} className="min-w-0">
                <CandidateMatchCard
                  candidate={candidate}
                  rank={firstIndex + index + 1}
                  hasInterviewerSkills={hasInterviewerSkills}
                />
              </li>
            ))}
          </ol>

          <nav
            className="flex flex-col items-center justify-between gap-3 sm:flex-row"
            aria-label="Candidate pages"
          >
            <p className="text-sm text-slate-600">
              Showing {formatCount(firstIndex + 1)}–{formatCount(firstIndex + data.candidates.length)} of{' '}
              {formatCount(data.totalCount)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => changePage(data.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </Button>
              <span className="px-2 text-sm text-slate-600">
                Page {data.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= totalPages}
                onClick={() => changePage(data.page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  )
}
