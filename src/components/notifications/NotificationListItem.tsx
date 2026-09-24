import { Bell, CalendarClock, CalendarX2, CheckCircle2, ClipboardList, Star } from 'lucide-react'
import { cn } from '../../lib/cn.ts'
import {
  formatNotificationTime,
  notificationDisplay,
  type InterviewerNotification,
} from '../../services/interviewerNotifications.ts'
import type { InterviewerBooking } from '../../services/interviewerBookings.ts'

export function NotificationKindIcon({ kind }: { kind: string }) {
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

export function NotificationListItem({
  item,
  booking,
  compact,
  onOpen,
}: {
  item: InterviewerNotification
  booking?: InterviewerBooking | null
  compact?: boolean
  onOpen: () => void
}) {
  const display = notificationDisplay(item, booking)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full gap-3 text-left hover:bg-slate-50',
        compact ? 'rounded-lg px-3 py-2.5' : 'px-4 py-3',
        item.readAt ? compact ? 'opacity-80' : 'bg-white' : 'bg-blue-50/60',
      )}
    >
      <NotificationKindIcon kind={item.kind} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-navy-950">{display.title}</span>
          {item.readAt ? null : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
        </span>
        <span className={cn('mt-0.5 block text-slate-600', compact ? 'text-xs' : 'text-sm')}>{display.body}</span>
        {display.dateLabel ? (
          <span className="mt-1 block text-xs text-slate-500">{display.dateLabel}</span>
        ) : null}
        {display.timeLabel ? (
          <span className="block text-xs text-slate-500">{display.timeLabel}</span>
        ) : null}
        <span className="mt-1 block text-[11px] text-slate-400">{formatNotificationTime(item.createdAt)}</span>
        {display.actionLabel ? (
          <span
            className={cn(
              'mt-2 inline-flex rounded-lg px-3 py-1.5 text-sm font-medium',
              item.kind === 'booking_requested'
                ? 'bg-navy-950 text-white'
                : 'border border-slate-300 bg-white text-navy-950',
            )}
          >
            {display.actionLabel}
          </span>
        ) : null}
      </span>
    </button>
  )
}
