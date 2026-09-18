import { supabase } from '../lib/supabase.ts'
import { requireUser } from './auth.ts'
import { getMyProfile } from './interviewerProfile.ts'
import { TABLES } from './tables.ts'

export const ADMIN_PAGE_SIZE = 25
export const ADMIN_REQUIRED = 'Admin access is required.'

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const
export type AdminVerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const MODERATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type AdminModerationStatus = (typeof MODERATION_STATUSES)[number]

export const BOOKING_FILTERS = [
  'all',
  'requested',
  'confirmed',
  'completed',
  'cancelled',
] as const
export type AdminBookingFilter = (typeof BOOKING_FILTERS)[number]

export type AdminPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type AdminDashboardMetrics = {
  interviewerCount: number
  pendingVerificationCount: number
  candidateCount: number
  pendingReviewCount: number
  upcomingBookingCount: number
  recentCompletedCount: number
}

export type AdminVerificationRow = {
  id: string
  kind: string
  status: AdminVerificationStatus
  notes: string | null
  reviewedAt: string | null
  hasDocument: boolean
  interviewerName: string
  currentRole: string
  company: string
  headline: string | null
  experienceYears: number | null
}

export type AdminReviewRow = {
  id: string
  overallRating: number
  writtenReview: string | null
  displayName: string
  moderationStatus: AdminModerationStatus
  createdAt: string
  interviewerName: string
}

export type AdminBookingRow = {
  id: string
  status: string
  startsAtUtc: string
  displayTimezone: string
  serviceName: string
  interviewType: string
  interviewerName: string
  candidateName: string
  paymentStatus: string | null
  sessionStatus: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return isRecord(first) ? first : null
  }
  return isRecord(value) ? value : null
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readNestedName(value: unknown): string {
  const profile = asRecord(asRecord(value)?.profiles) ?? asRecord(value)
  return readString(profile ?? {}, 'full_name')?.trim() || 'Unknown'
}

function mapAuthError(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    throw new Error(ADMIN_REQUIRED)
  }
  throw new Error(fallback)
}

async function requireAdmin() {
  const user = await requireUser()
  const profile = await getMyProfile()
  if (profile.role !== 'admin') throw new Error(ADMIN_REQUIRED)
  return { user, profile }
}

async function counted(result: PromiseLike<{ count: number | null; error: { message?: string; code?: string } | null }>) {
  const { count, error } = await result
  mapAuthError(error, 'Could not load admin metrics. Check your connection and try again.')
  return count ?? 0
}

export async function loadAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  await requireAdmin()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const [
    interviewerCount,
    pendingVerificationCount,
    candidateCount,
    pendingReviewCount,
    upcomingBookingCount,
    recentCompletedCount,
  ] = await Promise.all([
    counted(supabase.from(TABLES.profiles).select('id', { count: 'exact', head: true }).eq('role', 'interviewer')),
    counted(
      supabase.from(TABLES.interviewerVerifications).select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ),
    counted(supabase.from(TABLES.profiles).select('id', { count: 'exact', head: true }).eq('role', 'candidate')),
    counted(
      supabase
        .from(TABLES.candidateReviews)
        .select('id', { count: 'exact', head: true })
        .eq('moderation_status', 'pending'),
    ),
    counted(
      supabase
        .from(TABLES.bookings)
        .select('id', { count: 'exact', head: true })
        .in('status', ['confirmed', 'in_progress'])
        .gte('starts_at', now),
    ),
    counted(
      supabase
        .from(TABLES.bookings)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('starts_at', weekAgo),
    ),
  ])
  return {
    interviewerCount,
    pendingVerificationCount,
    candidateCount,
    pendingReviewCount,
    upcomingBookingCount,
    recentCompletedCount,
  }
}

async function interviewerIdsMatchingName(query: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerProfiles)
    .select('id, profiles!inner(full_name)')
    .ilike('profiles.full_name', `%${query}%`)
    .limit(100)
  mapAuthError(error, 'Could not search interviewers. Try again.')
  return (data ?? []).map((row) => row.id as string)
}

async function profileLinkedIds(table: 'interviewer_profiles' | 'candidate_profiles', query: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id, profiles!inner(full_name)')
    .ilike('profiles.full_name', `%${query}%`)
    .limit(100)
  mapAuthError(error, 'Could not search names. Try again.')
  return (data ?? []).map((row) => row.id as string)
}

async function serviceIdsMatchingName(query: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerServices)
    .select('id')
    .ilike('name', `%${query}%`)
    .limit(100)
  mapAuthError(error, 'Could not search services. Try again.')
  return (data ?? []).map((row) => row.id as string)
}

function sanitizeSearch(value: string) {
  return value.replace(/[%(),]/g, ' ').trim()
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function parseVerification(value: unknown): AdminVerificationRow | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const kind = readString(value, 'kind')
  const status = readString(value, 'status')
  if (!id || !kind || !status) return null
  if (!VERIFICATION_STATUSES.includes(status as AdminVerificationStatus)) return null
  const interviewer = asRecord(value.interviewer_profiles)
  return {
    id,
    kind,
    status: status as AdminVerificationStatus,
    notes: readString(value, 'notes'),
    reviewedAt: readString(value, 'reviewed_at'),
    hasDocument: Boolean(readString(value, 'document_path')),
    interviewerName: readNestedName(interviewer),
    currentRole: readString(interviewer ?? {}, 'current_role') ?? '',
    company: readString(interviewer ?? {}, 'company') ?? '',
    headline: readString(interviewer ?? {}, 'headline'),
    experienceYears: readNumber(interviewer ?? {}, 'experience_years'),
  }
}

export async function listAdminVerifications(input: {
  status: AdminVerificationStatus | 'all'
  search: string
  page: number
}): Promise<AdminPage<AdminVerificationRow>> {
  await requireAdmin()
  const page = Math.max(1, input.page)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to = from + ADMIN_PAGE_SIZE - 1
  const search = sanitizeSearch(input.search)

  let query = supabase
    .from(TABLES.interviewerVerifications)
    .select(
      'id, kind, status, notes, reviewed_at, document_path, interviewer_profiles ( current_role, company, headline, experience_years, profiles ( full_name ) )',
      { count: 'exact' },
    )
    .order('reviewed_at', { ascending: false, nullsFirst: true })

  if (input.status !== 'all') query = query.eq('status', input.status)
  if (search) {
    const ids = await interviewerIdsMatchingName(search)
    if (ids.length === 0) return { items: [], total: 0, page, pageSize: ADMIN_PAGE_SIZE }
    query = query.in('interviewer_profile_id', ids)
  }

  const { data, error, count } = await query.range(from, to)
  mapAuthError(error, 'Could not load verifications. Check your connection and try again.')
  return {
    items: (data ?? []).map(parseVerification).filter((item): item is AdminVerificationRow => Boolean(item)),
    total: count ?? 0,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}

export async function updateAdminVerification(
  id: string,
  status: AdminVerificationStatus,
  notes?: string,
): Promise<void> {
  await requireAdmin()
  if (!isUuid(id)) throw new Error('Verification not found.')
  const patch: Record<string, string | null> = { status }
  if (notes !== undefined) patch.notes = notes.trim() || null
  const { error } = await supabase.from(TABLES.interviewerVerifications).update(patch).eq('id', id)
  mapAuthError(error, 'Could not update verification. Try again.')
}

function parseReview(value: unknown): AdminReviewRow | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const overallRating = readNumber(value, 'overall_rating')
  const displayName = readString(value, 'display_name')
  const moderationStatus = readString(value, 'moderation_status')
  const createdAt = readString(value, 'created_at')
  if (!id || overallRating === null || !displayName || !moderationStatus || !createdAt) return null
  if (!MODERATION_STATUSES.includes(moderationStatus as AdminModerationStatus)) return null
  return {
    id,
    overallRating,
    writtenReview: readString(value, 'written_review'),
    displayName,
    moderationStatus: moderationStatus as AdminModerationStatus,
    createdAt,
    interviewerName: readNestedName(value.interviewer_profiles),
  }
}

export async function listAdminReviews(input: {
  status: AdminModerationStatus | 'all'
  search: string
  page: number
}): Promise<AdminPage<AdminReviewRow>> {
  await requireAdmin()
  const page = Math.max(1, input.page)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to = from + ADMIN_PAGE_SIZE - 1
  const search = sanitizeSearch(input.search)

  let query = supabase
    .from(TABLES.candidateReviews)
    .select(
      'id, overall_rating, written_review, display_name, moderation_status, created_at, interviewer_profiles ( profiles ( full_name ) )',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (input.status !== 'all') query = query.eq('moderation_status', input.status)
  if (search) {
    const ids = await interviewerIdsMatchingName(search)
    if (ids.length === 0) {
      query = query.ilike('display_name', `%${search}%`)
    } else {
      query = query.or(`interviewer_profile_id.in.(${ids.join(',')}),display_name.ilike.%${search}%`)
    }
  }

  const { data, error, count } = await query.range(from, to)
  mapAuthError(error, 'Could not load reviews. Check your connection and try again.')
  return {
    items: (data ?? []).map(parseReview).filter((item): item is AdminReviewRow => Boolean(item)),
    total: count ?? 0,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}

export async function moderateAdminReview(id: string, status: 'approved' | 'rejected'): Promise<void> {
  await requireAdmin()
  if (!isUuid(id)) throw new Error('Review not found.')
  const { error } = await supabase.rpc('moderate_candidate_review', {
    p_review_id: id,
    p_status: status,
  })
  if (error) {
    const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
    if (text.includes('not_authorized') || error.code === '42501') throw new Error(ADMIN_REQUIRED)
    if (text.includes('review_not_found') || error.code === 'P0002') throw new Error('Review not found.')
    if (text.includes('invalid_status') || error.code === 'P0001') throw new Error('That moderation status is not allowed.')
    throw new Error('Could not moderate this review. Try again.')
  }
}

function sessionStatus(value: unknown) {
  const row = asRecord(value)
  if (!row) return null
  if (readString(row, 'ended_at')) return 'Ended'
  if (readString(row, 'started_at')) return 'In progress'
  return 'Scheduled'
}

function parseBooking(value: unknown): AdminBookingRow | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const status = readString(value, 'status')
  const startsAtUtc = readString(value, 'starts_at')
  const displayTimezone = readString(value, 'display_timezone')
  if (!id || !status || !startsAtUtc || !displayTimezone) return null
  const service = asRecord(value.interviewer_services)
  const payment = asRecord(value.payments)
  return {
    id,
    status,
    startsAtUtc,
    displayTimezone,
    serviceName: readString(service ?? {}, 'name') ?? 'Service',
    interviewType: readString(service ?? {}, 'interview_type') ?? '',
    interviewerName: readNestedName(value.interviewer_profiles),
    candidateName: readNestedName(value.candidate_profiles),
    paymentStatus: readString(payment ?? {}, 'status'),
    sessionStatus: sessionStatus(value.interview_sessions),
  }
}

export async function listAdminBookings(input: {
  status: AdminBookingFilter
  search: string
  page: number
}): Promise<AdminPage<AdminBookingRow>> {
  await requireAdmin()
  const page = Math.max(1, input.page)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to = from + ADMIN_PAGE_SIZE - 1
  const search = sanitizeSearch(input.search)

  let query = supabase
    .from(TABLES.bookings)
    .select(
      'id, status, starts_at, display_timezone, interviewer_services ( name, interview_type ), interviewer_profiles ( profiles ( full_name ) ), candidate_profiles ( profiles ( full_name ) ), payments ( status ), interview_sessions ( started_at, ended_at )',
      { count: 'exact' },
    )
    .order('starts_at', { ascending: false })

  if (input.status !== 'all') query = query.eq('status', input.status)

  if (search) {
    if (isUuid(search)) {
      query = query.eq('id', search)
    } else {
      const [interviewerIds, candidateIds, serviceIds] = await Promise.all([
        profileLinkedIds('interviewer_profiles', search),
        profileLinkedIds('candidate_profiles', search),
        serviceIdsMatchingName(search),
      ])
      const parts: string[] = []
      if (interviewerIds.length) parts.push(`interviewer_profile_id.in.(${interviewerIds.join(',')})`)
      if (candidateIds.length) parts.push(`candidate_profile_id.in.(${candidateIds.join(',')})`)
      if (serviceIds.length) parts.push(`service_id.in.(${serviceIds.join(',')})`)
      if (parts.length === 0) return { items: [], total: 0, page, pageSize: ADMIN_PAGE_SIZE }
      query = query.or(parts.join(','))
    }
  }

  const { data, error, count } = await query.range(from, to)
  mapAuthError(error, 'Could not load bookings. Check your connection and try again.')
  return {
    items: (data ?? []).map(parseBooking).filter((item): item is AdminBookingRow => Boolean(item)),
    total: count ?? 0,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}
