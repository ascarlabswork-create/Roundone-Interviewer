import { supabase } from '../lib/supabase.ts'
import { getCurrentInterviewer } from './interviewer.ts'
import { TABLES } from './tables.ts'

export type PublicReviewPreview = {
  id: string
  displayName: string
  overallRating: number
  writtenReview: string | null
  createdAt: string
}

export type PublicReviewSummary = {
  count: number
  averageRating: number | null
  recent: PublicReviewPreview[]
}

const PUBLIC_REVIEW_SELECT =
  'id, interviewer_profile_id, display_name, overall_rating, written_review, created_at'

const RECENT_PREVIEW_LIMIT = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mapLoadError(error: { message?: string; code?: string } | null) {
  if (!error) return
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('jwt') || text.includes('not authenticated') || error.code === 'PGRST301') {
    throw new Error('You need to sign in to continue.')
  }
  throw new Error('Could not load public reviews. Check your connection and try again.')
}

function parsePublicReview(value: unknown): PublicReviewPreview | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const displayName = readString(value, 'display_name')
  const overallRating = readNumber(value, 'overall_rating')
  const createdAt = readString(value, 'created_at')
  if (!id || !displayName || overallRating === null || !createdAt) return null
  if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) return null
  const written = readString(value, 'written_review')
  return {
    id,
    displayName,
    overallRating,
    writtenReview: written?.trim() ? written : null,
    createdAt,
  }
}

export async function loadMyPublicReviewSummary(): Promise<PublicReviewSummary> {
  const account = await getCurrentInterviewer()
  const { data, error } = await supabase
    .from(TABLES.candidateReviewsPublic)
    .select(PUBLIC_REVIEW_SELECT)
    .eq('interviewer_profile_id', account.interviewer.id)
    .order('created_at', { ascending: false })
  mapLoadError(error)

  const reviews = (data ?? [])
    .map(parsePublicReview)
    .filter((item): item is PublicReviewPreview => Boolean(item))
  const count = reviews.length
  const averageRating =
    count === 0 ? null : reviews.reduce((sum, item) => sum + item.overallRating, 0) / count

  return {
    count,
    averageRating,
    recent: reviews.slice(0, RECENT_PREVIEW_LIMIT),
  }
}
