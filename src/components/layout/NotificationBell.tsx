import {
  Bell,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Star,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import {
  formatNotificationTime,
  loadMyNotificationBoard,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  type InterviewerNotification,
  type NotificationBoard,
} from '../../services/interviewerNotifications.ts'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'
import { Skeleton } from '../ui/primitives.tsx'

const POLL_MS = 45_000

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
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id)
        await refresh()
      } catch (caught) {
        pushToast(caught instanceof Error ? caught.message : 'Could not update that notification. Try again.')
        return
      }
    }
    setOpen(false)
    navigate(notificationHref(item))
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
          className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96"
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
              {board.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void onOpenItem(item)}
                    className={cn(
                      'flex w-full gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50',
                      item.readAt ? 'opacity-80' : 'bg-blue-50/60',
                    )}
                  >
                    <KindIcon kind={item.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-navy-950">{item.title}</span>
                        {item.readAt ? null : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-600">{item.body}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{formatNotificationTime(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
