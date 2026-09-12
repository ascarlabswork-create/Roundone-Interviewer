import type { AppNotification } from '../types.ts'

export const seedNotifications: AppNotification[] = [
  {
    id: 'n-1',
    title: 'New booking request',
    body: 'Meera S. requested a Coding Mock for Thursday 6:00 PM.',
    time: '12 min ago',
    read: false,
    to: '/interviewer/bookings',
  },
  {
    id: 'n-2',
    title: 'Upcoming interview',
    body: 'Aditi Verma · System Design Mock in 2 days.',
    time: '1 hour ago',
    read: false,
    to: '/interviewer/dashboard',
  },
  {
    id: 'n-3',
    title: 'Private feedback due',
    body: 'Madhan · System Design Mock completed today. Submit private candidate feedback.',
    time: 'Today',
    read: false,
    to: '/interviewer/feedback/bk-completed-madhan',
  },
  {
    id: 'n-4',
    title: 'Payout pending',
    body: '₹1,710 is ready for the next payout cycle.',
    time: '2 days ago',
    read: true,
    to: '/interviewer/earnings',
  },
]
