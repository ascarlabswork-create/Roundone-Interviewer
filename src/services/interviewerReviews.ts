import { supabase } from '../lib/supabase.ts'
import { getCurrentInterviewer } from './interviewer.ts'
import { TABLES } from './tables.ts'

export type PublicReviewDimensions = {
  technicalExpertise: number
  communication: number
  interviewRealism: number
  feedbackQuality: number
  professionalism: number
}

export type PublicReviewPreview = {
  id: string
  displayName: string
  overallRating: number
  writtenReview: string | null
  createdAt: string
}

export type PublicReviewRecord = PublicReviewPreview & {
  recommend: string | null
  dimensions: PublicReviewDimensions
}

export type PublicReviewSummary = {
  count: number
  averageRating: number | null
  dimensionAverages: PublicReviewDimensions | null
  recent: PublicReviewPreview[]
}

const PUBLIC_REVIEW_SELECT =
  'id, interviewer_profile_id, display_name, overall_rating, technical_expertise, communication, interview_realism, feedback_quality, professionalism, recommend, written_review, created_at'

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

function parseDimension(value: unknown, key: string) {
  const score = readNumber(isRecord(value) ? value : {}, key)
  if (score === null || !Number.isInteger(score) || score < 1 || score > 5) return null
  return score
}

function parsePublicReview(value: unknown): PublicReviewRecord | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const displayName = readString(value, 'display_name')
  const overallRating = readNumber(value, 'overall_rating')
  const createdAt = readString(value, 'created_at')
  const technicalExpertise = parseDimension(value, 'technical_expertise')
  const communication = parseDimension(value, 'communication')
  const interviewRealism = parseDimension(value, 'interview_realism')
  const feedbackQuality = parseDimension(value, 'feedback_quality')
  const professionalism = parseDimension(value, 'professionalism')
  if (!id || !displayName || overallRating === null || !createdAt) return null
  if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) return null
  if (
    technicalExpertise === null ||
    communication === null ||
    interviewRealism === null ||
    feedbackQuality === null ||
    professionalism === null
  ) {
    return null
  }
  const written = readString(value, 'written_review')
  return {
    id,
    displayName,
    overallRating,
    writtenReview: written?.trim() ? written : null,
    createdAt,
    recommend: readString(value, 'recommend'),
    dimensions: {
      technicalExpertise,
      communication,
      interviewRealism,
      feedbackQuality,
      professionalism,
    },
  }
}

function toPreview(review: PublicReviewRecord): PublicReviewPreview {
  return {
    id: review.id,
    displayName: review.displayName,
    overallRating: review.overallRating,
    writtenReview: review.writtenReview,
    createdAt: review.createdAt,
  }
}

async function loadApprovedReviews(): Promise<PublicReviewRecord[]> {
  const account = await getCurrentInterviewer()
  const { data, error } = await supabase
    .from(TABLES.candidateReviewsPublic)
    .select(PUBLIC_REVIEW_SELECT)
    .eq('interviewer_profile_id', account.interviewer.id)
    .order('created_at', { ascending: false })
  mapLoadError(error)
  return (data ?? []).map(parsePublicReview).filter((item): item is PublicReviewRecord => Boolean(item))
}

export async function listMyPublicReviews(): Promise<PublicReviewRecord[]> {
  return loadApprovedReviews()
}

export async function loadMyPublicReviewSummary(): Promise<PublicReviewSummary> {
  const reviews = await loadApprovedReviews()
  const count = reviews.length
  const averageRating =
    count === 0 ? null : reviews.reduce((sum, item) => sum + item.overallRating, 0) / count
  const dimensionAverages =
    count === 0
      ? null
      : {
          technicalExpertise: reviews.reduce((sum, item) => sum + item.dimensions.technicalExpertise, 0) / count,
          communication: reviews.reduce((sum, item) => sum + item.dimensions.communication, 0) / count,
          interviewRealism: reviews.reduce((sum, item) => sum + item.dimensions.interviewRealism, 0) / count,
          feedbackQuality: reviews.reduce((sum, item) => sum + item.dimensions.feedbackQuality, 0) / count,
          professionalism: reviews.reduce((sum, item) => sum + item.dimensions.professionalism, 0) / count,
        }

  return {
    count,
    averageRating,
    dimensionAverages,
    recent: reviews.slice(0, RECENT_PREVIEW_LIMIT).map(toPreview),
  }
}
