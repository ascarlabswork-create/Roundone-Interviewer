import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotificationListItem } from '../components/notifications/NotificationListItem.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import {
  loadMyNotificationBoard,
  markAllNotificationsRead,
  markNotificationRead,
  notificationBookingId,
  notificationHref,
  type InterviewerNotification,
} from '../services/interviewerNotifications.ts'
import { useToast } from '../state/toast.tsx'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const state = useAsync(() => loadMyNotificationBoard(), [])
  const [acting, setActing] = useState(false)

  async function onOpenItem(item: InterviewerNotification) {
    const bookingId = notificationBookingId(item)
    const booking = bookingId && state.status === 'success' ? state.data.bookingsById.get(bookingId) ?? null : null
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id)
        state.reload()
      } catch (caught) {
        pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
        return
      }
    }
    navigate(notificationHref(item, booking))
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
          {state.data.items.map((item) => {
            const bookingId = notificationBookingId(item)
            return (
              <NotificationListItem
                key={item.id}
                item={item}
                booking={bookingId ? state.data.bookingsById.get(bookingId) ?? null : null}
                onOpen={() => void onOpenItem(item)}
              />
            )
          })}
        </Card>
      ) : null}
    </div>
  )
}
