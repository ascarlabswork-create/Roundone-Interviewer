import { Bell, CalendarClock, CalendarX2, CheckCircle2, ClipboardList, Star } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { cn } from '../lib/cn.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  formatNotificationTime,
  loadMyNotificationBoard,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  type InterviewerNotification,
} from '../services/interviewerNotifications.ts'
import { useToast } from '../state/toast.tsx'

function KindIcon({ kind }: { kind: string }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0 text-slate-500'
  switch (kind) {
    case 'booking_requested':
      return <ClipboardList className={className} />
    case 'booking_cancelled':
    case 'booking_rejected':
    case 'booking_expired':
      return <CalendarX2 className={className} />
    case 'booking_rescheduled':
    case 'booking_confirmed':
    case 'interview_reminder':
      return <CalendarClock className={className} />
    case 'interview_completed':
      return <CheckCircle2 className={className} />
    case 'feedback_ready':
      return <Star className={className} />
    default:
      return <Bell className={className} />
  }
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const state = useAsync(() => loadMyNotificationBoard(), [])
  const [acting, setActing] = useState(false)

  async function onOpenItem(item: InterviewerNotification) {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id)
        state.reload()
      } catch (caught) {
        pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
        return
      }
    }
    navigate(notificationHref(item))
  }

  async function onMarkAll() {
    if (acting || state.status !== 'success' || state.data.unreadCount === 0) return
    setActing(true)
    try {
      await markAllNotificationsRead()
      state.reload()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Booking, interview, and review events for your interviewer account."
        actions={
          state.status === 'success' && state.data.unreadCount > 0 ? (
            <Button variant="outline" disabled={acting} onClick={() => void onMarkAll()}>
              {acting ? 'Updating…' : 'Mark all as read'}
            </Button>
          ) : null
        }
      />

      {state.status === 'loading' ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.items.length === 0 ? (
        <EmptyState title="No notifications yet" body="Booking requests, cancellations, reminders, and reviews will appear here." />
      ) : null}
      {state.status === 'success' && state.data.items.length > 0 ? (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {state.data.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void onOpenItem(item)}
              className={cn(
                'flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50',
                item.readAt ? 'bg-white' : 'bg-blue-50/60',
              )}
            >
              <KindIcon kind={item.kind} />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-navy-950">{item.title}</span>
                  {item.readAt ? null : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                </span>
                <span className="mt-0.5 block text-sm text-slate-600">{item.body}</span>
                <span className="mt-1 block text-xs text-slate-400">{formatNotificationTime(item.createdAt)}</span>
              </span>
            </button>
          ))}
        </Card>
      ) : null}
    </div>
  )
}
