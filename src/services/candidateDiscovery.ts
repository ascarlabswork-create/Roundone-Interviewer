import { supabase } from '../lib/supabase.ts'

export const DISCOVERY_PAGE_SIZE = 20

export type CandidateDiscoverySort = 'match' | 'name'

export type DiscoveredCandidate = {
  candidateProfileId: string
  name: string
  targetRole: string | null
  candidateLevel: string | null
  skills: string[]
  matchedSkills: string[]
  missingInterviewerSkills: string[]
  extraCandidateSkills: string[]
  skillRatio: number
  skillPercent: number
  bookedSessionsCount: number
}

export type CandidateDiscoveryPage = {
  candidates: DiscoveredCandidate[]
  page: number
  pageSize: number
  totalCount: number
  interviewerSkills: string[]
}

export type CandidateDiscoveryQuery = {
  page: number
  search: string
  sort: CandidateDiscoverySort
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseCandidate(value: unknown): DiscoveredCandidate | null {
  if (!isRecord(value)) return null
  const candidateProfileId = readString(value, 'candidate_profile_id')
  if (!candidateProfileId) return null
  return {
    candidateProfileId,
    name: readString(value, 'full_name')?.trim() || 'Candidate',
    targetRole: readString(value, 'target_role'),
    candidateLevel: readString(value, 'candidate_level'),
    skills: readStringArray(value.skills),
    matchedSkills: readStringArray(value.matched_skills),
    missingInterviewerSkills: readStringArray(value.missing_interviewer_skills),
    extraCandidateSkills: readStringArray(value.extra_candidate_skills),
    skillRatio: readNumber(value, 'skill_ratio') ?? 0,
    skillPercent: readNumber(value, 'skill_percent') ?? 0,
    bookedSessionsCount: readNumber(value, 'booked_sessions_count') ?? 0,
  }
}

function mapDiscoveryError(error: { message?: string; code?: string }) {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (text.includes('not_authenticated') || text.includes('jwt') || error.code === 'PGRST301') {
    return new Error('You need to sign in to continue.')
  }
  if (text.includes('not_an_interviewer') || text.includes('account_inactive')) {
    return new Error('Only active interviewer accounts can browse candidates.')
  }
  return new Error('Could not load candidates. Check your connection and try again.')
}

export async function discoverCandidates(query: CandidateDiscoveryQuery): Promise<CandidateDiscoveryPage> {
  const search = query.search.trim()
  const { data, error } = await supabase.rpc('match_all_candidates_by_skills', {
    p_page: Math.max(1, Math.floor(query.page)),
    p_page_size: DISCOVERY_PAGE_SIZE,
    p_search: search || null,
    p_sort: query.sort,
  })
  if (error) throw mapDiscoveryError(error)
  if (!isRecord(data)) throw new Error('Could not load candidates. Try again.')

  const candidates = Array.isArray(data.candidates)
    ? data.candidates.map(parseCandidate).filter((item): item is DiscoveredCandidate => item !== null)
    : []

  return {
    candidates,
    page: readNumber(data, 'page') ?? query.page,
    pageSize: readNumber(data, 'page_size') ?? DISCOVERY_PAGE_SIZE,
    totalCount: readNumber(data, 'total_count') ?? candidates.length,
    interviewerSkills: readStringArray(data.interviewer_skills),
  }
}

export function formatSkillPercent(percent: number) {
  const rounded = Math.round(percent * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}
