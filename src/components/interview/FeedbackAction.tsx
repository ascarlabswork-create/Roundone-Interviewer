import { Link } from 'react-router-dom'
import { interviewerFeedbackAction } from '../../services/interviewerFeedback.ts'
import type { InterviewerBooking } from '../../services/interviewerBookings.ts'
import { Button } from '../ui/Button.tsx'

export function FeedbackAction({
  booking,
  hasFeedback,
  size = 'sm',
  disabled,
}: {
  booking: InterviewerBooking
  hasFeedback: boolean
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const action = interviewerFeedbackAction(booking.status, hasFeedback)
  if (!action) return null

  const label = action === 'submitted' ? 'Feedback Submitted' : 'Give Feedback'
  const variant = action === 'submitted' ? 'outline' : 'primary'

  if (disabled) {
    return (
      <Button size={size} variant={variant} disabled>
        {label}
      </Button>
    )
  }

  return (
    <Link to={`/interviewer/feedback/${booking.id}`}>
      <Button size={size} variant={variant}>
        {label}
      </Button>
    </Link>
  )
}
