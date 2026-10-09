/** Shown first in timezone pickers (common interview corridors). */
export const POPULAR_TIMEZONE_IDS = [
  'Asia/Kolkata',
  'America/Chicago',
  'America/New_York',
  'America/Los_Angeles',
  'America/Denver',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
] as const

export type TimezoneOption = { id: string; label: string }

let cachedOptions: TimezoneOption[] | null = null

function allIanaTimezones(): string[] {
  const set = new Set<string>()
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      for (const id of Intl.supportedValuesOf('timeZone')) set.add(id)
    } catch {
      // fall through
    }
  }
  for (const id of POPULAR_TIMEZONE_IDS) {
    if (isValidTimezone(id)) set.add(id)
  }
  if (set.has('Asia/Kolkata')) set.delete('Asia/Calcutta')
  if (set.size === 0) return [...POPULAR_TIMEZONE_IDS]
  return [...set].sort((a, b) => a.localeCompare(b))
}

const TIMEZONE_ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
}

/** Canonical IANA id for storage (trim + known alias merge). */
export function normalizeTimezoneId(zone: string) {
  const trimmed = zone.trim()
  if (!trimmed) return ''
  return TIMEZONE_ALIASES[trimmed] ?? trimmed
}

export function isValidTimezone(zone: string) {
  const trimmed = normalizeTimezoneId(zone)
  if (!trimmed) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return true
  } catch {
    return false
  }
}

/** Scheduling uses interviewer_profiles.timezone; keep profiles in sync for the public directory. */
export function effectiveSchedulingTimezone(
  profileTimezone: string,
  interviewerTimezone: string,
  fallback = 'Asia/Kolkata',
) {
  const fromInterviewer = normalizeTimezoneId(interviewerTimezone)
  if (fromInterviewer && isValidTimezone(fromInterviewer)) return fromInterviewer
  const fromProfile = normalizeTimezoneId(profileTimezone)
  if (fromProfile && isValidTimezone(fromProfile)) return fromProfile
  return fallback
}

function offsetMinutesAt(zone: string, atMs: number) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(atMs))
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
    const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(raw)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    const hours = Number(match[2])
    const minutes = Number(match[3] ?? '0')
    return sign * (hours * 60 + minutes)
  } catch {
    return 0
  }
}

function shortOffsetAt(zone: string, atMs: number) {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(new Date(atMs))
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    )
  } catch {
    return ''
  }
}

export function formatTimezoneLabel(zone: string, atMs = Date.now()) {
  if (!isValidTimezone(zone)) return zone
  const offset = shortOffsetAt(zone, atMs)
  const readable = zone.replace(/_/g, ' ')
  return offset ? `${readable} (${offset})` : readable
}

/** Every IANA zone the runtime supports, popular regions first, then sorted by current UTC offset. */
export function getTimezoneOptions(atMs = Date.now()): TimezoneOption[] {
  if (cachedOptions && atMs === cachedOptionsAt) return cachedOptions
  const zones = allIanaTimezones()
  const popular = new Set<string>(POPULAR_TIMEZONE_IDS)
  const head = POPULAR_TIMEZONE_IDS.filter((id) => zones.includes(id)).map((id) => ({
    id,
    label: formatTimezoneLabel(id, atMs),
  }))
  const tail = zones
    .filter((id) => !popular.has(id))
    .map((id) => ({ id, offset: offsetMinutesAt(id, atMs) }))
    .sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id))
    .map(({ id }) => ({ id, label: formatTimezoneLabel(id, atMs) }))
  cachedOptions = [...head, ...tail]
  cachedOptionsAt = atMs
  return cachedOptions
}

let cachedOptionsAt = 0

export function timezoneSelectOptions(atMs = Date.now()) {
  return getTimezoneOptions(atMs).map((zone) => ({ value: zone.id, label: zone.label }))
}
