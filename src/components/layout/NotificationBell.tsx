import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NotificationListItem } from '../notifications/NotificationListItem.tsx'
import {
  loadMyNotificationBoard,
  markAllNotificationsRead,
  markNotificationRead,
  notificationBookingId,
  notificationHref,
  type InterviewerNotification,
  type NotificationBoard,
} from '../../services/interviewerNotifications.ts'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { Bell } from 'lucide-react'

const POLL_MS = 45_000

export function NotificationBell() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [board, setBoard] = useState<NotificationBoard | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  async function refresh() {
    try {
      const next = await loadMyNotificationBoard()
      setBoard(next)
      setStatus('success')
      setError(null)
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Could not load notifications. Check your connection and try again.'
      setError(message)
      setStatus((current) => (current === 'success' ? 'success' : 'error'))
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const unreadCount = board?.unreadCount ?? 0

  async function onOpenItem(item: InterviewerNotification) {
    const bookingId = notificationBookingId(item)
    const booking = bookingId ? board?.bookingsById.get(bookingId) ?? null : null
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id)
        await refresh()
      } catch (caught) {
        pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
      }
    }
    if (
      (item.kind === 'booking_requested' ||
        item.kind === 'booking_confirmed' ||
        item.kind === 'booking_rejected' ||
        item.kind === 'booking_cancelled' ||
        item.kind === 'booking_rescheduled') &&
      !bookingId
    ) {
      pushToast('This notification is missing booking details.')
    }
    setOpen(false)
    navigate(notificationHref(item, booking))
  }

  async function onMarkAll() {
    if (!unreadCount || acting) return
    setActing(true)
    try {
      await markAllNotificationsRead()
      await refresh()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-50"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-blue-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute right-0 mt-2 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-navy-950">Notifications</p>
            {unreadCount > 0 ? (
              <Button size="sm" variant="ghost" disabled={acting} onClick={() => void onMarkAll()}>
                {acting ? 'Updating…' : 'Mark all as read'}
              </Button>
            ) : null}
          </div>
          {status === 'loading' && !board ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="space-y-2 p-4">
              <p className="text-sm text-red-700">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          ) : null}
          {status === 'success' && board && board.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet</p>
          ) : null}
          {board && board.items.length > 0 ? (
            <ul className="max-h-96 overflow-y-auto p-1">
              {board.items.map((item) => {
                const bookingId = notificationBookingId(item)
                return (
                  <li key={item.id}>
                    <NotificationListItem
                      item={item}
                      booking={bookingId ? board.bookingsById.get(bookingId) ?? null : null}
                      compact
                      onOpen={() => void onOpenItem(item)}
                    />
                  </li>
                )
              })}
            </ul>
          ) : null}
          <div className="border-t border-slate-100 px-3 py-2">
            <Link
              to="/interviewer/notifications"
              className="block text-center text-sm font-medium text-navy-950 hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
