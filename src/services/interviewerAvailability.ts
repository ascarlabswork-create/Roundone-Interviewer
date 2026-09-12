import { BUFFER_OPTIONS, TIMEZONES, WEEKDAY_LABELS } from '../data/catalogs.ts'
import { fromYMD, timeToMinutes, toISODate } from '../lib/dates.ts'
import { supabase } from '../lib/supabase.ts'
import { getCurrentInterviewer } from './interviewer.ts'
import { TABLES } from './tables.ts'

export const BOOKING_BUFFER_MINUTES = BUFFER_OPTIONS
export type BookingBufferMinutes = (typeof BOOKING_BUFFER_MINUTES)[number]
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type SupportedTimezone = (typeof TIMEZONES)[number]['id']

export type AvailabilityWindow = {
  id: string
  interviewer_profile_id: string
  weekday: Weekday
  start_time: string
  end_time: string
}

export type CustomSlotRecord = {
  id: string
  interviewer_profile_id: string
  on_date: string
  start_time: string
  end_time: string
}

export type BlockedTimeRecord = {
  id: string
  interviewer_profile_id: string
  on_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  reason: string | null
}

export type AvailabilityWindowInput = {
  weekday: Weekday
  startTime: string
  endTime: string
}

export type AvailabilityWindowUpdates = {
  weekday?: Weekday
  startTime?: string
  endTime?: string
}

export type CustomSlotInput = {
  onDate: string
  startTime: string
  endTime: string
}

export type CustomSlotUpdates = {
  onDate?: string
  startTime?: string
  endTime?: string
}

export type BlockedTimeInput = {
  onDate: string
  allDay: boolean
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
}

export type BlockedTimeUpdates = {
  onDate?: string
  allDay?: boolean
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
}

export type AvailabilityBoard = {
  interviewerProfileId: string
  timezone: string
  bookingBufferMin: BookingBufferMinutes
  availability: AvailabilityWindow[]
  customSlots: CustomSlotRecord[]
  blockedTimes: BlockedTimeRecord[]
}

const AVAILABILITY_SELECT = 'id, interviewer_profile_id, weekday, start_time, end_time'
const CUSTOM_SELECT = 'id, interviewer_profile_id, on_date, start_time, end_time'
const BLOCKED_SELECT = 'id, interviewer_profile_id, on_date, start_time, end_time, all_day, reason'
const PROFILE_SETTINGS_SELECT = 'id, timezone, booking_buffer_min'

type ProfileSettingsRow = {
  id: string
  timezone: string
  booking_buffer_min: number
}

type AvailabilityRow = {
  id: string
  interviewer_profile_id: string
  weekday: number
  start_time: string
  end_time: string
}

type CustomSlotRow = {
  id: string
  interviewer_profile_id: string
  on_date: string
  start_time: string
  end_time: string
}

type BlockedTimeRow = {
  id: string
  interviewer_profile_id: string
  on_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  reason: string | null
}

type PostgrestFail = {
  message: string
  code?: string
}

function fail(error: PostgrestFail | null) {
  if (!error) return
  if (error.code === '23505') {
    throw new Error('This time range already exists.')
  }
  throw new Error(error.message)
}

async function myInterviewerProfileId() {
  const account = await getCurrentInterviewer()
  return account.interviewer.id
}

function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6
}

function isBookingBuffer(value: number): value is BookingBufferMinutes {
  return (BOOKING_BUFFER_MINUTES as readonly number[]).includes(value)
}

function isClockTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = fromYMD(value)
  return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === value
}

function normalizeTime(value: string) {
  const [hour = '00', minute = '00'] = value.split(':')
  const next = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  if (!isClockTime(next)) {
    throw new Error('Time must use HH:MM in 24-hour format.')
  }
  return next
}

function toDbTime(value: string) {
  return `${normalizeTime(value)}:00`
}

function weekdayLabel(weekday: Weekday) {
  return WEEKDAY_LABELS[weekday]
}

function assertStartBeforeEnd(startTime: string, endTime: string, label: string) {
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw new Error(`${label}: start time must be before end time.`)
  }
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}

function assertValidTimezone(timezone: string) {
  const trimmed = timezone.trim()
  if (!trimmed) throw new Error('Timezone is required.')
  if (!TIMEZONES.some((zone) => zone.id === trimmed)) {
    throw new Error('Choose a supported timezone.')
  }
  return trimmed
}

function readBuffer(value: number): BookingBufferMinutes {
  if (isBookingBuffer(value)) return value
  throw new Error('Booking buffer must be 0, 10, 15, or 30 minutes.')
}

function mapAvailability(row: AvailabilityRow): AvailabilityWindow {
  if (!isWeekday(row.weekday)) {
    throw new Error('Stored weekday is invalid.')
  }
  return {
    id: row.id,
    interviewer_profile_id: row.interviewer_profile_id,
    weekday: row.weekday,
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
  }
}

function mapCustomSlot(row: CustomSlotRow): CustomSlotRecord {
  return {
    id: row.id,
    interviewer_profile_id: row.interviewer_profile_id,
    on_date: row.on_date,
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
  }
}

function mapBlockedTime(row: BlockedTimeRow): BlockedTimeRecord {
  return {
    id: row.id,
    interviewer_profile_id: row.interviewer_profile_id,
    on_date: row.on_date,
    start_time: row.start_time ? normalizeTime(row.start_time) : null,
    end_time: row.end_time ? normalizeTime(row.end_time) : null,
    all_day: row.all_day,
    reason: row.reason,
  }
}

function blockedInterval(item: { all_day: boolean; start_time: string | null; end_time: string | null }) {
  if (item.all_day || !item.start_time || !item.end_time) {
    return { start: '00:00', end: '23:59' }
  }
  return { start: item.start_time, end: item.end_time }
}

function assertNoAvailabilityOverlap(
  weekday: Weekday,
  startTime: string,
  endTime: string,
  existing: AvailabilityWindow[],
  ignoreId?: string,
) {
  const clash = existing.some(
    (item) =>
      item.id !== ignoreId &&
      item.weekday === weekday &&
      rangesOverlap(item.start_time, item.end_time, startTime, endTime),
  )
  if (clash) {
    throw new Error(`${weekdayLabel(weekday)} has overlapping availability ranges.`)
  }
}

function assertNoCustomOverlap(
  onDate: string,
  startTime: string,
  endTime: string,
  existing: CustomSlotRecord[],
  ignoreId?: string,
) {
  const clash = existing.some(
    (item) =>
      item.id !== ignoreId &&
      item.on_date === onDate &&
      rangesOverlap(item.start_time, item.end_time, startTime, endTime),
  )
  if (clash) {
    throw new Error('This custom slot overlaps another custom slot.')
  }
}

function assertNoBlockedOverlap(
  onDate: string,
  candidate: { all_day: boolean; start_time: string | null; end_time: string | null },
  existing: BlockedTimeRecord[],
  ignoreId?: string,
) {
  const next = blockedInterval(candidate)
  const clash = existing.some((item) => {
    if (item.id === ignoreId || item.on_date !== onDate) return false
    const current = blockedInterval(item)
    return rangesOverlap(current.start, current.end, next.start, next.end)
  })
  if (clash) {
    throw new Error('This blocked period overlaps another blocked period on that date.')
  }
}

async function getOwnedAvailability(id: string, interviewerProfileId: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerAvailability)
    .select(AVAILABILITY_SELECT)
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  if (!data) throw new Error('Availability window not found.')
  return mapAvailability(data as AvailabilityRow)
}

async function getOwnedCustomSlot(id: string, interviewerProfileId: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerCustomSlots)
    .select(CUSTOM_SELECT)
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  if (!data) throw new Error('Custom slot not found.')
  return mapCustomSlot(data as CustomSlotRow)
}

async function getOwnedBlockedTime(id: string, interviewerProfileId: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerBlockedTimes)
    .select(BLOCKED_SELECT)
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  if (!data) throw new Error('Blocked time not found.')
  return mapBlockedTime(data as BlockedTimeRow)
}

async function getProfileSettings() {
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerProfiles)
    .select(PROFILE_SETTINGS_SELECT)
    .eq('id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  if (!data) throw new Error('Interviewer profile not found.')
  const row = data as ProfileSettingsRow
  return {
    id: row.id,
    timezone: row.timezone,
    bookingBufferMin: readBuffer(row.booking_buffer_min),
  }
}

export async function getMyAvailability(): Promise<AvailabilityWindow[]> {
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerAvailability)
    .select(AVAILABILITY_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => mapAvailability(row as AvailabilityRow))
}

export async function createAvailability(input: AvailabilityWindowInput): Promise<AvailabilityWindow> {
  if (!isWeekday(input.weekday)) throw new Error('Weekday must be between Sunday (0) and Saturday (6).')
  const startTime = normalizeTime(input.startTime)
  const endTime = normalizeTime(input.endTime)
  assertStartBeforeEnd(startTime, endTime, weekdayLabel(input.weekday))

  const interviewerProfileId = await myInterviewerProfileId()
  const existing = await getMyAvailability()
  assertNoAvailabilityOverlap(input.weekday, startTime, endTime, existing)

  const { data, error } = await supabase
    .from(TABLES.interviewerAvailability)
    .insert({
      interviewer_profile_id: interviewerProfileId,
      weekday: input.weekday,
      start_time: toDbTime(startTime),
      end_time: toDbTime(endTime),
    })
    .select(AVAILABILITY_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not save availability.')
  return mapAvailability(data as AvailabilityRow)
}

export async function updateAvailability(id: string, input: AvailabilityWindowUpdates): Promise<AvailabilityWindow> {
  const interviewerProfileId = await myInterviewerProfileId()
  const current = await getOwnedAvailability(id, interviewerProfileId)
  const weekday = input.weekday ?? current.weekday
  if (!isWeekday(weekday)) throw new Error('Weekday must be between Sunday (0) and Saturday (6).')
  const startTime = normalizeTime(input.startTime ?? current.start_time)
  const endTime = normalizeTime(input.endTime ?? current.end_time)
  assertStartBeforeEnd(startTime, endTime, weekdayLabel(weekday))

  const existing = await getMyAvailability()
  assertNoAvailabilityOverlap(weekday, startTime, endTime, existing, id)

  const { data, error } = await supabase
    .from(TABLES.interviewerAvailability)
    .update({
      weekday,
      start_time: toDbTime(startTime),
      end_time: toDbTime(endTime),
    })
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .select(AVAILABILITY_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not update availability.')
  return mapAvailability(data as AvailabilityRow)
}

export async function deleteAvailability(id: string): Promise<void> {
  const interviewerProfileId = await myInterviewerProfileId()
  await getOwnedAvailability(id, interviewerProfileId)
  const { error } = await supabase
    .from(TABLES.interviewerAvailability)
    .delete()
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
  fail(error)
}

export async function getMyCustomSlots(): Promise<CustomSlotRecord[]> {
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerCustomSlots)
    .select(CUSTOM_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('on_date', { ascending: true })
    .order('start_time', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => mapCustomSlot(row as CustomSlotRow))
}

export async function createCustomSlot(input: CustomSlotInput): Promise<CustomSlotRecord> {
  if (!isIsoDate(input.onDate)) throw new Error('Choose a valid date.')
  const startTime = normalizeTime(input.startTime)
  const endTime = normalizeTime(input.endTime)
  assertStartBeforeEnd(startTime, endTime, 'Custom availability')

  const interviewerProfileId = await myInterviewerProfileId()
  const existing = await getMyCustomSlots()
  assertNoCustomOverlap(input.onDate, startTime, endTime, existing)

  const { data, error } = await supabase
    .from(TABLES.interviewerCustomSlots)
    .insert({
      interviewer_profile_id: interviewerProfileId,
      on_date: input.onDate,
      start_time: toDbTime(startTime),
      end_time: toDbTime(endTime),
    })
    .select(CUSTOM_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not save custom slot.')
  return mapCustomSlot(data as CustomSlotRow)
}

export async function updateCustomSlot(id: string, input: CustomSlotUpdates): Promise<CustomSlotRecord> {
  const interviewerProfileId = await myInterviewerProfileId()
  const current = await getOwnedCustomSlot(id, interviewerProfileId)
  const onDate = input.onDate ?? current.on_date
  if (!isIsoDate(onDate)) throw new Error('Choose a valid date.')
  const startTime = normalizeTime(input.startTime ?? current.start_time)
  const endTime = normalizeTime(input.endTime ?? current.end_time)
  assertStartBeforeEnd(startTime, endTime, 'Custom availability')

  const existing = await getMyCustomSlots()
  assertNoCustomOverlap(onDate, startTime, endTime, existing, id)

  const { data, error } = await supabase
    .from(TABLES.interviewerCustomSlots)
    .update({
      on_date: onDate,
      start_time: toDbTime(startTime),
      end_time: toDbTime(endTime),
    })
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .select(CUSTOM_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not update custom slot.')
  return mapCustomSlot(data as CustomSlotRow)
}

export async function deleteCustomSlot(id: string): Promise<void> {
  const interviewerProfileId = await myInterviewerProfileId()
  await getOwnedCustomSlot(id, interviewerProfileId)
  const { error } = await supabase
    .from(TABLES.interviewerCustomSlots)
    .delete()
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
  fail(error)
}

export async function getMyBlockedTimes(): Promise<BlockedTimeRecord[]> {
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerBlockedTimes)
    .select(BLOCKED_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('on_date', { ascending: true })
    .order('start_time', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => mapBlockedTime(row as BlockedTimeRow))
}

function resolveBlockedWindow(input: {
  allDay: boolean
  startTime?: string | null
  endTime?: string | null
}) {
  if (input.allDay) {
    return { all_day: true, start_time: null as string | null, end_time: null as string | null }
  }
  if (!input.startTime || !input.endTime) {
    throw new Error('Partial blocked times require a start and end time.')
  }
  const startTime = normalizeTime(input.startTime)
  const endTime = normalizeTime(input.endTime)
  assertStartBeforeEnd(startTime, endTime, 'Blocked time')
  return {
    all_day: false,
    start_time: startTime,
    end_time: endTime,
  }
}

export async function createBlockedTime(input: BlockedTimeInput): Promise<BlockedTimeRecord> {
  if (!isIsoDate(input.onDate)) throw new Error('Choose a valid date.')
  const window = resolveBlockedWindow(input)
  const interviewerProfileId = await myInterviewerProfileId()
  const existing = await getMyBlockedTimes()
  assertNoBlockedOverlap(input.onDate, window, existing)

  const { data, error } = await supabase
    .from(TABLES.interviewerBlockedTimes)
    .insert({
      interviewer_profile_id: interviewerProfileId,
      on_date: input.onDate,
      start_time: window.start_time ? toDbTime(window.start_time) : null,
      end_time: window.end_time ? toDbTime(window.end_time) : null,
      all_day: window.all_day,
      reason: input.reason?.trim() || null,
    })
    .select(BLOCKED_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not save blocked time.')
  return mapBlockedTime(data as BlockedTimeRow)
}

export async function updateBlockedTime(id: string, input: BlockedTimeUpdates): Promise<BlockedTimeRecord> {
  const interviewerProfileId = await myInterviewerProfileId()
  const current = await getOwnedBlockedTime(id, interviewerProfileId)
  const onDate = input.onDate ?? current.on_date
  if (!isIsoDate(onDate)) throw new Error('Choose a valid date.')
  const allDay = input.allDay ?? current.all_day
  const window = resolveBlockedWindow({
    allDay,
    startTime: input.startTime !== undefined ? input.startTime : current.start_time,
    endTime: input.endTime !== undefined ? input.endTime : current.end_time,
  })
  const existing = await getMyBlockedTimes()
  assertNoBlockedOverlap(onDate, window, existing, id)

  const reason = input.reason !== undefined ? input.reason?.trim() || null : current.reason

  const { data, error } = await supabase
    .from(TABLES.interviewerBlockedTimes)
    .update({
      on_date: onDate,
      start_time: window.start_time ? toDbTime(window.start_time) : null,
      end_time: window.end_time ? toDbTime(window.end_time) : null,
      all_day: window.all_day,
      reason,
    })
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .select(BLOCKED_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not update blocked time.')
  return mapBlockedTime(data as BlockedTimeRow)
}

export async function deleteBlockedTime(id: string): Promise<void> {
  const interviewerProfileId = await myInterviewerProfileId()
  await getOwnedBlockedTime(id, interviewerProfileId)
  const { error } = await supabase
    .from(TABLES.interviewerBlockedTimes)
    .delete()
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
  fail(error)
}

export async function getMyTimezone(): Promise<string> {
  const settings = await getProfileSettings()
  return settings.timezone
}

export async function updateMyTimezone(timezone: string): Promise<string> {
  const next = assertValidTimezone(timezone)
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerProfiles)
    .update({ timezone: next })
    .eq('id', interviewerProfileId)
    .select('timezone')
    .single()
  fail(error)
  if (!data || typeof data.timezone !== 'string' || !data.timezone.trim()) {
    throw new Error('Could not update timezone.')
  }
  return data.timezone
}

export async function getMyBookingBuffer(): Promise<BookingBufferMinutes> {
  const settings = await getProfileSettings()
  return settings.bookingBufferMin
}

export async function updateMyBookingBuffer(bufferMin: BookingBufferMinutes): Promise<BookingBufferMinutes> {
  if (!isBookingBuffer(bufferMin)) {
    throw new Error('Booking buffer must be 0, 10, 15, or 30 minutes.')
  }
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerProfiles)
    .update({ booking_buffer_min: bufferMin })
    .eq('id', interviewerProfileId)
    .select('booking_buffer_min')
    .single()
  fail(error)
  if (!data || typeof data.booking_buffer_min !== 'number') {
    throw new Error('Could not update booking buffer.')
  }
  return readBuffer(data.booking_buffer_min)
}

export async function loadMyAvailabilityBoard(): Promise<AvailabilityBoard> {
  const [availability, customSlots, blockedTimes, settings] = await Promise.all([
    getMyAvailability(),
    getMyCustomSlots(),
    getMyBlockedTimes(),
    getProfileSettings(),
  ])
  return {
    interviewerProfileId: settings.id,
    timezone: settings.timezone,
    bookingBufferMin: settings.bookingBufferMin,
    availability,
    customSlots,
    blockedTimes,
  }
}
