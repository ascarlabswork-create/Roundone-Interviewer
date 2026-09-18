import { supabase } from '../lib/supabase.ts'
import { requireUser } from './auth.ts'
import { TABLES } from './tables.ts'

export type NotificationPreferences = {
  bookingUpdates: boolean
  feedbackUpdates: boolean
}

export type NotificationPreferenceKey = keyof NotificationPreferences

const SELECT_COLUMNS = 'booking_updates, feedback_updates'

const COLUMN_BY_KEY: Record<NotificationPreferenceKey, 'booking_updates' | 'feedback_updates'> = {
  bookingUpdates: 'booking_updates',
  feedbackUpdates: 'feedback_updates',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapLoadError(error: { message?: string; code?: string } | null) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  throw new Error('Could not load notification preferences. Check your connection and try again.')
}

function mapUpdateError(error: { message?: string; code?: string } | null) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    throw new Error('You can only update your own notification preferences.')
  }
  throw new Error('Could not save that preference. Try again.')
}

function parsePreferences(value: unknown): NotificationPreferences | null {
  if (!isRecord(value)) return null
  if (typeof value.booking_updates !== 'boolean' || typeof value.feedback_updates !== 'boolean') return null
  return {
    bookingUpdates: value.booking_updates,
    feedbackUpdates: value.feedback_updates,
  }
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const user = await requireUser()
  const { data, error } = await supabase
    .from(TABLES.notificationPreferences)
    .select(SELECT_COLUMNS)
    .eq('profile_id', user.id)
    .maybeSingle()
  mapLoadError(error)
  const parsed = parsePreferences(data)
  if (!parsed) throw new Error('Could not load notification preferences. Check your connection and try again.')
  return parsed
}

export async function updateMyNotificationPreference(
  key: NotificationPreferenceKey,
  value: boolean,
): Promise<NotificationPreferences> {
  const user = await requireUser()
  const { data, error } = await supabase
    .from(TABLES.notificationPreferences)
    .update({ [COLUMN_BY_KEY[key]]: value })
    .eq('profile_id', user.id)
    .select(SELECT_COLUMNS)
    .maybeSingle()
  mapUpdateError(error)
  const parsed = parsePreferences(data)
  if (!parsed) throw new Error('Could not save that preference. Try again.')
  return parsed
}
