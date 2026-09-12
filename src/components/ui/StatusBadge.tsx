import type { BookingStatus, PayoutStatus, SlotState, VerificationStatus } from '../../types.ts'
import { Badge } from './primitives.tsx'

const bookingTone: Record<BookingStatus, { label: string; tone: 'amber' | 'blue' | 'green' | 'slate' }> = {
  pending: { label: 'Pending', tone: 'amber' },
  upcoming: { label: 'Upcoming', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const item = bookingTone[status]
  return <Badge tone={item.tone}>{item.label}</Badge>
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified') return <Badge tone="green">Verified</Badge>
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
