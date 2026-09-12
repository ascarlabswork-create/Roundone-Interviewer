import type { DbBookingStatus } from '../../services/interviewerBookings.ts'
import type { BookingStatus, PayoutStatus, SlotState, VerificationStatus } from '../../types.ts'
import { Badge } from './primitives.tsx'

const bookingTone: Record<BookingStatus, { label: string; tone: 'amber' | 'blue' | 'green' | 'slate' }> = {
  pending: { label: 'Pending', tone: 'amber' },
  upcoming: { label: 'Upcoming', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}

const liveBookingTone: Record<
  DbBookingStatus,
  { label: string; tone: 'amber' | 'blue' | 'green' | 'slate' | 'red' }
> = {
  pending_payment: { label: 'Payment hold', tone: 'slate' },
  requested: { label: 'Pending Request', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  rejected: { label: 'Rejected', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  expired: { label: 'Expired', tone: 'slate' },
  rescheduled: { label: 'Rescheduled', tone: 'slate' },
  in_progress: { label: 'In progress', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  no_show: { label: 'No show', tone: 'slate' },
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const item = bookingTone[status]
  return <Badge tone={item.tone}>{item.label}</Badge>
}

export function LiveBookingStatusBadge({ status }: { status: DbBookingStatus }) {
  const item = liveBookingTone[status]
  return <Badge tone={item.tone}>{item.label}</Badge>
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified') return <Badge tone="green">Verified</Badge>
  if (status === 'rejected') return <Badge tone="red">Rejected</Badge>
  if (status === 'action_required') return <Badge tone="amber">Action Required</Badge>
  return <Badge tone="slate">Pending</Badge>
}

export function PayoutBadge({ status }: { status: PayoutStatus }) {
  return status === 'completed' ? <Badge tone="green">Completed Payout</Badge> : <Badge tone="amber">Pending Payout</Badge>
}

export function SlotBadge({ state }: { state: SlotState }) {
  if (state === 'booked') return <Badge tone="navy">Booked</Badge>
  if (state === 'blocked') return <Badge tone="slate">Blocked</Badge>
  return <Badge tone="blue">Available</Badge>
}
