import { CalendarCheck, Shield, Star, Users, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../../components/ui/dashboard.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui/primitives.tsx'
import { formatCount } from '../../lib/format.ts'
import { useAsync } from '../../lib/useAsync.ts'
import { loadAdminDashboardMetrics } from '../../services/adminOperations.ts'

export function AdminDashboardPage() {
  const state = useAsync(() => loadAdminDashboardMetrics(), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations overview"
        subtitle="Counts come from live RoundOne tables. No estimated or AI-generated scores."
      />

      {state.status === 'loading' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Total interviewers"
              value={formatCount(state.data.interviewerCount)}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              label="Pending verifications"
              value={formatCount(state.data.pendingVerificationCount)}
              icon={<Shield className="h-4 w-4" />}
            />
            <MetricCard
              label="Total candidates"
              value={formatCount(state.data.candidateCount)}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              label="Pending review moderation"
              value={formatCount(state.data.pendingReviewCount)}
              icon={<Star className="h-4 w-4" />}
            />
            <MetricCard
              label="Upcoming bookings"
              value={formatCount(state.data.upcomingBookingCount)}
              hint="Confirmed or in progress, starting now or later"
              icon={<Video className="h-4 w-4" />}
            />
            <MetricCard
              label="Recently completed interviews"
              value={formatCount(state.data.recentCompletedCount)}
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
          </div>
        </>
      ) : null}
    </div>
  )
}
