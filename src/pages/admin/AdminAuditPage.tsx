import { useState } from 'react'
import { AdminPager } from '../../components/admin/AdminPager.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, TableRow, Td } from '../../components/ui/DataTable.tsx'
import { Card, ErrorState, FieldLabel, PageHeader, Skeleton, SelectInput, TextInput } from '../../components/ui/primitives.tsx'
import { formatReviewDate } from '../../lib/dates.ts'
import { useAsync } from '../../lib/useAsync.ts'
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_TYPES,
  auditDetails,
  listAdminAuditLogs,
  type AdminAuditAction,
  type AdminAuditEntityType,
} from '../../services/adminOperations.ts'

export function AdminAuditPage() {
  const [action, setAction] = useState<AdminAuditAction | 'all'>('all')
  const [entityType, setEntityType] = useState<AdminAuditEntityType | 'all'>('all')
  const [adminSearch, setAdminSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [applied, setApplied] = useState({
    action: 'all' as AdminAuditAction | 'all',
    entityType: 'all' as AdminAuditEntityType | 'all',
    adminSearch: '',
    fromDate: '',
    toDate: '',
  })
  const [page, setPage] = useState(1)
  const state = useAsync(
    () =>
      listAdminAuditLogs({
        action: applied.action,
        entityType: applied.entityType,
        adminSearch: applied.adminSearch,
        fromDate: applied.fromDate,
        toDate: applied.toDate,
        page,
      }),
    [applied, page],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Admin mutations are recorded by the database in the same transaction as the change. History cannot be edited here."
      />

      <form
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault()
          setApplied({ action, entityType, adminSearch, fromDate, toDate })
          setPage(1)
        }}
      >
        <div>
          <FieldLabel htmlFor="audit-action">Action</FieldLabel>
          <SelectInput
            id="audit-action"
            value={action}
            onChange={(event) => setAction(event.target.value as AdminAuditAction | 'all')}
          >
            <option value="all">All actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {AUDIT_ACTION_LABELS[item]}
              </option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel htmlFor="audit-entity">Entity</FieldLabel>
          <SelectInput
            id="audit-entity"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value as AdminAuditEntityType | 'all')}
          >
            <option value="all">All entities</option>
            {AUDIT_ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {AUDIT_ENTITY_LABELS[item]}
              </option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel htmlFor="audit-from">From</FieldLabel>
          <TextInput id="audit-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="audit-to">To</FieldLabel>
          <TextInput id="audit-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="audit-admin">Admin</FieldLabel>
          <div className="flex gap-2">
            <TextInput
              id="audit-admin"
              value={adminSearch}
              onChange={(event) => setAdminSearch(event.target.value)}
              placeholder="Admin name"
            />
            <Button type="submit">Filter</Button>
          </div>
        </div>
      </form>

      {state.status === 'loading' ? <Skeleton className="h-64" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No audit records in this view.</p>
      ) : null}
      {state.status === 'success' && state.data.items.length > 0 ? (
        <>
          <DataTable headers={['Timestamp', 'Admin', 'Action', 'Entity', 'Entity ID', 'Details']}>
            {state.data.items.map((row) => (
              <TableRow key={row.id}>
                <Td>{formatReviewDate(row.createdAt)}</Td>
                <Td>{row.adminName}</Td>
                <Td>{AUDIT_ACTION_LABELS[row.action]}</Td>
                <Td>{AUDIT_ENTITY_LABELS[row.entityType]}</Td>
                <Td>
                  <span className="font-mono text-xs">{row.entityId.slice(0, 8)}</span>
                </Td>
                <Td>{auditDetails(row)}</Td>
              </TableRow>
            ))}
          </DataTable>
          <div className="space-y-3 lg:hidden">
            {state.data.items.map((row) => (
              <Card key={row.id} className="p-4">
                <p className="text-xs text-slate-500">{formatReviewDate(row.createdAt)}</p>
                <p className="mt-1 font-semibold text-navy-950">
                  {row.adminName} · {AUDIT_ACTION_LABELS[row.action]} {AUDIT_ENTITY_LABELS[row.entityType]}
                </p>
                <p className="mt-1 text-sm text-slate-600">{auditDetails(row)}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{row.entityId}</p>
              </Card>
            ))}
          </div>
          <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onPage={setPage} />
        </>
      ) : null}
    </div>
  )
}
