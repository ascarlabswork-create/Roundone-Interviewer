import { CURRENT_INTERVIEWER_ID } from './interviewer.ts'
import { nextDateWithWeekday } from '../lib/dates.ts'
import type {
  AvailabilitySchedule,
  AvailabilitySettings,
  BlockedTime,
  CustomAvailabilitySlot,
  RecurringAvailability,
} from '../types.ts'

const TZ = 'Asia/Kolkata'

function recurring(
  id: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isActive: boolean,
): RecurringAvailability {
  return {
    id,
    interviewerId: CURRENT_INTERVIEWER_ID,
    dayOfWeek,
    startTime,
    endTime,
    timezone: TZ,
    isActive,
    serviceId: null,
  }
}

export const seedSettings: AvailabilitySettings = {
  interviewerId: CURRENT_INTERVIEWER_ID,
  timezone: TZ,
  defaultDurationMin: 60,
  bufferMin: 15,
}

export const seedRecurring: RecurringAvailability[] = [
  recurring('rec-mon', 1, '18:00', '21:00', true),
  recurring('rec-tue', 2, '18:00', '21:00', true),
  recurring('rec-wed', 3, '18:00', '21:00', false),
  recurring('rec-thu', 4, '19:00', '22:00', true),
  recurring('rec-fri', 5, '18:00', '21:00', false),
  recurring('rec-sat-am', 6, '10:00', '14:00', true),
  recurring('rec-sat-pm', 6, '18:00', '21:00', true),
  recurring('rec-sun', 0, '10:00', '14:00', false),
]

export const seedCustomSlots: CustomAvailabilitySlot[] = [
  {
    id: 'custom-sep-20',
    interviewerId: CURRENT_INTERVIEWER_ID,
    date: '2026-09-20',
    startTime: '14:00',
    endTime: '18:00',
    timezone: TZ,
    note: 'Extra Saturday afternoon window',
    serviceId: null,
  },
]

export const seedBlockedTimes: BlockedTime[] = [
  {
    id: 'block-holiday',
    interviewerId: CURRENT_INTERVIEWER_ID,
    date: '2026-09-25',
    startTime: null,
    endTime: null,
    allDay: true,
    reason: 'Holiday',
    timezone: TZ,
  },
  {
    id: 'block-personal',
    interviewerId: CURRENT_INTERVIEWER_ID,
    date: '2026-09-28',
    startTime: '18:00',
    endTime: '21:00',
    allDay: false,
    reason: 'Personal commitment',
    timezone: TZ,
  },
  {
    id: 'block-sat-lunch',
    interviewerId: CURRENT_INTERVIEWER_ID,
    date: nextDateWithWeekday(6),
    startTime: '11:00',
    endTime: '12:00',
    allDay: false,
    reason: 'Personal commitment',
    timezone: TZ,
  },
]

export const seedSchedule: AvailabilitySchedule = {
  settings: seedSettings,
  recurring: seedRecurring,
  customSlots: seedCustomSlots,
  blockedTimes: seedBlockedTimes,
}
