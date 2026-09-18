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

export const AUDIT_ACTIONS = [
  'verification_approved',
  'verification_rejected',
  'verification_pending',
  'review_approved',
  'review_rejected',
  'service_activated',
  'service_deactivated',
] as const
export type AdminAuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ENTITY_TYPES = [
  'interviewer_verification',
  'candidate_review',
  'interviewer_service',
] as const
export type AdminAuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export const AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  verification_approved: 'Approve',
  verification_rejected: 'Reject',
  verification_pending: 'Request changes',
  review_approved: 'Approve',
  review_rejected: 'Reject',
  service_activated: 'Activate',
  service_deactivated: 'Deactivate',
}

export const AUDIT_ENTITY_LABELS: Record<AdminAuditEntityType, string> = {
  interviewer_verification: 'Verification',
  candidate_review: 'Review',
  interviewer_service: 'Service',
}

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

export type AdminAuditRow = {
  id: string
  adminProfileId: string
  adminName: string
  action: AdminAuditAction
  entityType: AdminAuditEntityType
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type AdminServiceRow = {
  id: string
  name: string
  interviewType: string
  durationMin: number
  isActive: boolean
  interviewerName: string
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

function mapRpcError(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  if (text.includes('not_authorized') || error.code === '42501') {
    throw new Error(ADMIN_REQUIRED)
  }
  if (text.includes('verification_not_found')) throw new Error('Verification not found.')
  if (text.includes('review_not_found')) throw new Error('Review not found.')
  if (text.includes('service_not_found')) throw new Error('Service not found.')
  if (text.includes('invalid_status') || error.code === 'P0001') {
    throw new Error('That status is not allowed.')
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
  mapRpcError(error, 'Could not load admin metrics. Check your connection and try again.')
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
  mapRpcError(error, 'Could not search interviewers. Try again.')
  return (data ?? []).map((row) => row.id as string)
}

async function profileLinkedIds(table: 'interviewer_profiles' | 'candidate_profiles', query: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id, profiles!inner(full_name)')
    .ilike('profiles.full_name', `%${query}%`)
    .limit(100)
  mapRpcError(error, 'Could not search names. Try again.')
  return (data ?? []).map((row) => row.id as string)
}

async function serviceIdsMatchingName(query: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerServices)
    .select('id')
    .ilike('name', `%${query}%`)
    .limit(100)
  mapRpcError(error, 'Could not search services. Try again.')
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
  mapRpcError(error, 'Could not load verifications. Check your connection and try again.')
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
  const { error } = await supabase.rpc('moderate_interviewer_verification', {
    p_verification_id: id,
    p_status: status,
    p_notes: notes ?? null,
  })
  mapRpcError(error, 'Could not update verification. Try again.')
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
  mapRpcError(error, 'Could not load reviews. Check your connection and try again.')
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
  mapRpcError(error, 'Could not moderate this review. Try again.')
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
  mapRpcError(error, 'Could not load bookings. Check your connection and try again.')
  return {
    items: (data ?? []).map(parseBooking).filter((item): item is AdminBookingRow => Boolean(item)),
    total: count ?? 0,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}

function isAuditAction(value: string): value is AdminAuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value)
}

function isAuditEntityType(value: string): value is AdminAuditEntityType {
  return (AUDIT_ENTITY_TYPES as readonly string[]).includes(value)
}

function parseAudit(value: unknown): AdminAuditRow | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const adminProfileId = readString(value, 'admin_profile_id')
  const action = readString(value, 'action')
  const entityType = readString(value, 'entity_type')
  const entityId = readString(value, 'entity_id')
  const createdAt = readString(value, 'created_at')
  if (!id || !adminProfileId || !action || !entityType || !entityId || !createdAt) return null
  if (!isAuditAction(action) || !isAuditEntityType(entityType)) return null
  const metadata = isRecord(value.metadata) ? value.metadata : {}
  return {
    id,
    adminProfileId,
    adminName: readNestedName(value.profiles),
    action,
    entityType,
    entityId,
    metadata,
    createdAt,
  }
}

export function auditDetails(row: AdminAuditRow) {
  const kind = typeof row.metadata.kind === 'string' ? row.metadata.kind : null
  const status = typeof row.metadata.status === 'string' ? row.metadata.status : null
  if (kind && status) return `${kind} \u2192 ${status}`
  if (status) return status
  if (typeof row.metadata.is_active === 'boolean') return row.metadata.is_active ? 'Active' : 'Inactive'
  return '\u2014'
}

export async function listAdminAuditLogs(input: {
  action: AdminAuditAction | 'all'
  entityType: AdminAuditEntityType | 'all'
  adminSearch: string
  fromDate: string
  toDate: string
  page: number
  pageSize?: number
}): Promise<AdminPage<AdminAuditRow>> {
  await requireAdmin()
  const page = Math.max(1, input.page)
  const pageSize = Math.min(ADMIN_PAGE_SIZE, Math.max(1, input.pageSize ?? ADMIN_PAGE_SIZE))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const adminSearch = sanitizeSearch(input.adminSearch)

  let query = supabase
    .from(TABLES.auditLogs)
    .select('id, admin_profile_id, action, entity_type, entity_id, metadata, created_at, profiles ( full_name )', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })

  if (input.action !== 'all') query = query.eq('action', input.action)
  if (input.entityType !== 'all') query = query.eq('entity_type', input.entityType)
  if (input.fromDate) query = query.gte('created_at', `${input.fromDate}T00:00:00.000Z`)
  if (input.toDate) query = query.lte('created_at', `${input.toDate}T23:59:59.999Z`)
  if (adminSearch) {
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .select('id')
      .eq('role', 'admin')
      .ilike('full_name', `%${adminSearch}%`)
      .limit(100)
    mapRpcError(error, 'Could not search admins. Try again.')
    const ids = (data ?? []).map((row) => row.id as string)
    if (ids.length === 0) return { items: [], total: 0, page, pageSize }
    query = query.in('admin_profile_id', ids)
  }

  const { data, error, count } = await query.range(from, to)
  mapRpcError(error, 'Could not load the audit log. Check your connection and try again.')
  return {
    items: (data ?? []).map(parseAudit).filter((item): item is AdminAuditRow => Boolean(item)),
    total: count ?? 0,
    page,
    pageSize,
  }
}

function parseAdminService(value: unknown): AdminServiceRow | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const name = readString(value, 'name')
  const interviewType = readString(value, 'interview_type')
  const durationMin = readNumber(value, 'duration_min')
  if (!id || !name || !interviewType || durationMin === null) return null
  return {
    id,
    name,
    interviewType,
    durationMin,
    isActive: value.is_active === true,
    interviewerName: readNestedName(value.interviewer_profiles),
  }
}

export async function listAdminServices(input: {
  active: 'all' | 'active' | 'inactive'
  search: string
  page: number
}): Promise<AdminPage<AdminServiceRow>> {
  await requireAdmin()
  const page = Math.max(1, input.page)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to = from + ADMIN_PAGE_SIZE - 1
  const search = sanitizeSearch(input.search)

  let query = supabase
    .from(TABLES.interviewerServices)
    .select(
      'id, name, interview_type, duration_min, is_active, interviewer_profiles ( profiles ( full_name ) )',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (input.active === 'active') query = query.eq('is_active', true)
  if (input.active === 'inactive') query = query.eq('is_active', false)
  if (search) {
    const [interviewerIds, serviceIds] = await Promise.all([
      interviewerIdsMatchingName(search),
      serviceIdsMatchingName(search),
    ])
    const parts: string[] = []
    if (interviewerIds.length) parts.push(`interviewer_profile_id.in.(${interviewerIds.join(',')})`)
    if (serviceIds.length) parts.push(`id.in.(${serviceIds.join(',')})`)
    if (parts.length === 0) return { items: [], total: 0, page, pageSize: ADMIN_PAGE_SIZE }
    query = query.or(parts.join(','))
  }

  const { data, error, count } = await query.range(from, to)
  mapRpcError(error, 'Could not load services. Check your connection and try again.')
  return {
    items: (data ?? []).map(parseAdminService).filter((item): item is AdminServiceRow => Boolean(item)),
    total: count ?? 0,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}

export async function setAdminServiceActive(id: string, isActive: boolean): Promise<void> {
  await requireAdmin()
  if (!isUuid(id)) throw new Error('Service not found.')
  const { error } = await supabase.rpc('set_interviewer_service_active', {
    p_service_id: id,
    p_is_active: isActive,
  })
  mapRpcError(error, 'Could not update that service. Try again.')
}
