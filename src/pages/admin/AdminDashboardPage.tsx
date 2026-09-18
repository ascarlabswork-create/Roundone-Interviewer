import { CalendarCheck, Shield, Star, Users, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../../components/ui/dashboard.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card, ErrorState, PageHeader, Skeleton } from '../../components/ui/primitives.tsx'
import { formatReviewDate } from '../../lib/dates.ts'
import { formatCount } from '../../lib/format.ts'
import { useAsync } from '../../lib/useAsync.ts'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  auditDetails,
  listAdminAuditLogs,
  loadAdminDashboardMetrics,
} from '../../services/adminOperations.ts'

export function AdminDashboardPage() {
  const metrics = useAsync(() => loadAdminDashboardMetrics(), [])
  const recent = useAsync(
    () =>
      listAdminAuditLogs({
        action: 'all',
        entityType: 'all',
        adminSearch: '',
        fromDate: '',
        toDate: '',
        page: 1,
        pageSize: 5,
      }),
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations overview"
        subtitle="Counts come from live RoundOne tables. No estimated or AI-generated scores."
      />

      {metrics.status === 'loading' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}
      {metrics.status === 'error' ? <ErrorState body={metrics.error} onRetry={metrics.reload} /> : null}
      {metrics.status === 'success' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Total interviewers"
              value={formatCount(metrics.data.interviewerCount)}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              label="Pending verifications"
              value={formatCount(metrics.data.pendingVerificationCount)}
              icon={<Shield className="h-4 w-4" />}
            />
            <MetricCard
              label="Total candidates"
              value={formatCount(metrics.data.candidateCount)}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              label="Pending review moderation"
              value={formatCount(metrics.data.pendingReviewCount)}
              icon={<Star className="h-4 w-4" />}
            />
            <MetricCard
              label="Upcoming bookings"
              value={formatCount(metrics.data.upcomingBookingCount)}
              hint="Confirmed or in progress, starting now or later"
              icon={<Video className="h-4 w-4" />}
            />
            <MetricCard
              label="Recently completed interviews"
              value={formatCount(metrics.data.recentCompletedCount)}
              hint="Completed in the last 7 days"
              icon={<CalendarCheck className="h-4 w-4" />}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/verifications">
              <Button variant="outline">Open verifications</Button>
            </Link>
            <Link to="/admin/reviews">
              <Button variant="outline">Open reviews</Button>
            </Link>
            <Link to="/admin/bookings">
              <Button variant="outline">Open bookings</Button>
            </Link>
            <Link to="/admin/services">
              <Button variant="outline">Open services</Button>
            </Link>
          </div>
        </>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-950">Recent Admin Actions</h2>
          <Link to="/admin/audit">
            <Button size="sm" variant="outline">
              View Audit Log
            </Button>
          </Link>
        </div>
        {recent.status === 'loading' ? <Skeleton className="h-32" /> : null}
        {recent.status === 'error' ? <ErrorState body={recent.error} onRetry={recent.reload} /> : null}
        {recent.status === 'success' && recent.data.items.length === 0 ? (
          <p className="text-sm text-slate-500">No admin actions recorded yet.</p>
        ) : null}
        {recent.status === 'success' && recent.data.items.length > 0 ? (
          <div className="space-y-2">
            {recent.data.items.map((row) => (
              <Card key={row.id} className="p-4">
                <p className="text-xs text-slate-500">{formatReviewDate(row.createdAt)}</p>
                <p className="mt-1 text-sm text-navy-950">
                  {row.adminName} · {AUDIT_ACTION_LABELS[row.action]} {AUDIT_ENTITY_LABELS[row.entityType]}
                </p>
                <p className="mt-1 text-xs text-slate-600">{auditDetails(row)}</p>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
