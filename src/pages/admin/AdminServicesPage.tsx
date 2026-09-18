import { useState } from 'react'
import { AdminPager } from '../../components/admin/AdminPager.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../../components/ui/DataTable.tsx'
import { Tabs } from '../../components/ui/dashboard.tsx'
import { Badge, Card, ErrorState, PageHeader, Skeleton, TextInput } from '../../components/ui/primitives.tsx'
import { useAsync } from '../../lib/useAsync.ts'
import { listAdminServices, setAdminServiceActive } from '../../services/adminOperations.ts'
import { useToast } from '../../state/toast.tsx'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
] as const

export function AdminServicesPage() {
  const { pushToast } = useToast()
  const [active, setActive] = useState<(typeof FILTERS)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState<string | null>(null)
  const state = useAsync(() => listAdminServices({ active, search: appliedSearch, page }), [active, appliedSearch, page])

  async function toggle(id: string, isActive: boolean) {
    setActingId(id)
    try {
      await setAdminServiceActive(id, isActive)
      pushToast(isActive ? 'Service activated' : 'Service deactivated')
      state.reload()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update that service.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        subtitle="Inspect interviewer services and turn them on or off. Pricing and duration cannot be changed here."
      />
      <Tabs
        items={[...FILTERS]}
        value={active}
        onChange={(id) => {
          setActive(id as typeof active)
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
          placeholder="Search interviewer or service name"
        />
        <Button type="submit">Search</Button>
      </form>

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No services in this view.</p>
      ) : null}
      {state.status === 'success' && state.data.items.length > 0 ? (
        <>
          <DataTable headers={['Interviewer', 'Service', 'Type', 'Duration', 'Status', '']}>
            {state.data.items.map((row) => (
              <TableRow key={row.id}>
                <Td>{row.interviewerName}</Td>
                <Td>{row.name}</Td>
                <Td>{row.interviewType}</Td>
                <Td>{row.durationMin} min</Td>
                <Td>
                  <Badge tone={row.isActive ? 'green' : 'slate'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={row.isActive ? 'outline' : 'primary'}
                      disabled={actingId !== null}
                      onClick={() => void toggle(row.id, !row.isActive)}
                    >
                      {actingId === row.id ? 'Saving…' : row.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
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
                    <p className="font-semibold text-navy-950">{row.name}</p>
                    <p className="text-sm text-slate-600">
                      {row.interviewerName} · {row.interviewType} · {row.durationMin} min
                    </p>
                  </div>
                  <Badge tone={row.isActive ? 'green' : 'slate'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant={row.isActive ? 'outline' : 'primary'}
                    disabled={actingId !== null}
                    onClick={() => void toggle(row.id, !row.isActive)}
                  >
                    {actingId === row.id ? 'Saving…' : row.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
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
