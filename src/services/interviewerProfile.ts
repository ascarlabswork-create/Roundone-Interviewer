import { supabase } from '../lib/supabase.ts'
import { TABLES } from './tables.ts'
import { claimInterviewerPersona, requireUser, updateAuthMetadata } from './auth.ts'

export type ProfileRole = 'candidate' | 'interviewer' | 'admin'

export type ProfileRecord = {
  id: string
  role: ProfileRole
  full_name: string
  avatar_url: string | null
  timezone: string
  is_active: boolean
}

export type InterviewerProfileRecord = {
  id: string
  profile_id: string
  headline: string | null
  bio: string | null
  current_role: string
  company: string
  experience_years: number
  timezone: string
  languages: string[]
}

export type InterviewerRoleRecord = {
  id: string
  interviewer_profile_id: string
  target_role: string
  candidate_level: string | null
}

export type DbVerificationKind = 'identity' | 'employment'
export type DbVerificationStatus = 'pending' | 'verified' | 'rejected'
export type DisplayVerificationStatus = DbVerificationStatus | 'action_required'

export type VerificationStatusItem = {
  kind: DbVerificationKind
  status: DisplayVerificationStatus
}

export type InterviewerAccount = {
  userId: string
  email: string
  linkedin: string
  phone: string
  profile: ProfileRecord
  interviewer: InterviewerProfileRecord
  skills: string[]
  targetRoles: string[]
  candidateLevels: string[]
  verifications: VerificationStatusItem[]
}

export type InterviewerProfileUpdates = {
  fullName?: string
  avatarUrl?: string | null
  timezone?: string
  headline?: string | null
  bio?: string | null
  currentRole?: string
  company?: string
  experienceYears?: number
  languages?: string[]
  linkedin?: string
  phone?: string
}

const WRONG_APP_ROLE = 'This Interviewer app only supports interviewer accounts.'
const PROFILE_SELECT = 'id, role, full_name, avatar_url, timezone, is_active'
const INTERVIEWER_SELECT =
  'id, profile_id, headline, bio, current_role, company, experience_years, timezone, languages'
const VERIFICATION_KINDS: DbVerificationKind[] = ['identity', 'employment']

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function asRole(value: string): ProfileRole {
  if (value === 'candidate' || value === 'interviewer' || value === 'admin') return value
  throw new Error('Unknown account role.')
}

function asVerificationStatus(value: string): DisplayVerificationStatus {
  if (value === 'pending' || value === 'verified' || value === 'rejected') return value
  if (value === 'action_required') return value
  return 'pending'
}

function asVerificationKind(value: string): DbVerificationKind | null {
  if (value === 'identity' || value === 'employment') return value
  return null
}

function metadataString(user: { user_metadata?: Record<string, unknown> }, key: string) {
  const value = user.user_metadata?.[key]
  return typeof value === 'string' ? value : ''
}

function mapProfile(row: {
  id: string
  role: string
  full_name: string
  avatar_url: string | null
  timezone: string
  is_active: boolean
}): ProfileRecord {
  return {
    id: row.id,
    role: asRole(row.role),
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    timezone: row.timezone,
    is_active: row.is_active,
  }
}

function mapInterviewer(row: {
  id: string
  profile_id: string
  headline: string | null
  bio: string | null
  current_role: string
  company: string
  experience_years: number
  timezone: string
  languages: string[] | null
}): InterviewerProfileRecord {
  return {
    id: row.id,
    profile_id: row.profile_id,
    headline: row.headline,
    bio: row.bio,
    current_role: row.current_role,
    company: row.company,
    experience_years: row.experience_years,
    timezone: row.timezone,
    languages: row.languages ?? [],
  }
}

export function isPlaceholderProfessional(interviewer: InterviewerProfileRecord) {
  return interviewer.current_role === 'Pending' && interviewer.company === 'Pending'
}

function metadataNumber(user: { user_metadata?: Record<string, unknown> }, key: string) {
  const value = user.user_metadata?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

/** Copy company/role/LinkedIn from signup metadata onto the live interviewer row. */
export async function hydrateInterviewerSignupFromMetadata(
  account?: InterviewerAccount,
): Promise<InterviewerAccount> {
  const user = await requireUser()
  const current = account ?? (await getInterviewerProfile())
  const updates: InterviewerProfileUpdates = {}
  const fullName = metadataString(user, 'full_name')
  const currentRole = metadataString(user, 'current_role')
  const company = metadataString(user, 'company')
  const linkedin = metadataString(user, 'linkedin')
  const phone = metadataString(user, 'phone')
  const years = metadataNumber(user, 'experience_years')
  const emailLocal = (user.email ?? '').split('@')[0]

  if (fullName && (!current.profile.full_name.trim() || current.profile.full_name === emailLocal)) {
    updates.fullName = fullName
  }
  if (isPlaceholderProfessional(current.interviewer)) {
    if (currentRole) {
      updates.currentRole = currentRole
      updates.headline = currentRole
    }
    if (company) updates.company = company
  }
  if (years !== undefined && current.interviewer.experience_years === 0) {
    updates.experienceYears = Math.max(0, Math.round(years))
  }
  if (linkedin && !current.linkedin) updates.linkedin = linkedin
  if (phone && !current.phone) updates.phone = phone

  if (Object.keys(updates).length === 0) return current
  return updateInterviewerProfile(updates)
}

export async function applySignupProfile(updates: InterviewerProfileUpdates): Promise<InterviewerAccount> {
  await getInterviewerProfile({ retries: 6 })
  return updateInterviewerProfile(updates)
}

function profileSetupChecks(account: InterviewerAccount) {
  return [
    Boolean(account.profile.full_name.trim()),
    Boolean(account.profile.timezone.trim()),
    Boolean(account.interviewer.headline?.trim()),
    Boolean(account.interviewer.bio?.trim()),
    Boolean(account.interviewer.current_role.trim()) && !isPlaceholderProfessional(account.interviewer),
    Boolean(account.interviewer.company.trim()) && !isPlaceholderProfessional(account.interviewer),
    account.interviewer.experience_years > 0,
    account.skills.length > 0,
    account.targetRoles.length > 0,
    account.candidateLevels.length > 0,
  ]
}

export function isProfileSetupComplete(account: InterviewerAccount) {
  return profileSetupChecks(account).every(Boolean)
}

export function profileCompleteness(account: InterviewerAccount) {
  const checks = profileSetupChecks(account)
  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
}

export async function getInterviewerProfile(options?: { retries?: number }): Promise<InterviewerAccount> {
  const user = await requireUser()
  const retries = options?.retries ?? 0
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data: profileRow, error: profileError } = await supabase
      .from(TABLES.profiles)
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle()
    fail(profileError)

    if (!profileRow) {
      lastError = new Error('Your account profile is not ready yet. Try again in a moment.')
    } else {
      const profile = mapProfile(profileRow)
      if (profile.role !== 'interviewer') {
        const claimed = await claimInterviewerPersona()
        if (!claimed) throw new Error(WRONG_APP_ROLE)
        lastError = new Error('Your interviewer profile is not ready yet. Try again in a moment.')
      } else {
        const { data: interviewerRow, error: interviewerError } = await supabase
          .from(TABLES.interviewerProfiles)
          .select(INTERVIEWER_SELECT)
          .eq('profile_id', user.id)
          .maybeSingle()
        fail(interviewerError)

        if (interviewerRow) {
          const interviewer = mapInterviewer(interviewerRow)
          const [skills, roleRows, verifications] = await Promise.all([
            getInterviewerSkills(interviewer.id),
            getInterviewerRoleRows(interviewer.id),
            getVerificationStatus(interviewer.id),
          ])
          return {
            userId: user.id,
            email: user.email ?? '',
            linkedin: metadataString(user, 'linkedin'),
            phone: metadataString(user, 'phone'),
            profile,
            interviewer,
            skills,
            targetRoles: unique(roleRows.map((row) => row.target_role).filter((role) => role !== 'Any')),
            candidateLevels: unique(
              roleRows.map((row) => row.candidate_level).filter((level): level is string => Boolean(level)),
            ),
            verifications,
          }
        }
        lastError = new Error('Your interviewer profile is not ready yet. Try again in a moment.')
      }
    }

    if (attempt < retries) await sleep(250 * (attempt + 1))
  }

  throw lastError ?? new Error('Could not load your interviewer profile.')
}

export async function updateInterviewerProfile(updates: InterviewerProfileUpdates): Promise<InterviewerAccount> {
  const account = await getInterviewerProfile()
  const profilePatch: Record<string, string | null> = {}
  const interviewerPatch: Record<string, string | string[] | number | null> = {}
  const metadata: Record<string, string> = {}

  if (updates.fullName !== undefined) profilePatch.full_name = updates.fullName.trim()
  if (updates.avatarUrl !== undefined) profilePatch.avatar_url = updates.avatarUrl
  if (updates.timezone !== undefined) {
    profilePatch.timezone = updates.timezone
    interviewerPatch.timezone = updates.timezone
  }
  if (updates.headline !== undefined) interviewerPatch.headline = updates.headline
  if (updates.bio !== undefined) interviewerPatch.bio = updates.bio
  if (updates.currentRole !== undefined) interviewerPatch.current_role = updates.currentRole.trim() || 'Pending'
  if (updates.company !== undefined) interviewerPatch.company = updates.company.trim() || 'Pending'
  if (updates.experienceYears !== undefined) interviewerPatch.experience_years = Math.max(0, updates.experienceYears)
  if (updates.languages !== undefined) interviewerPatch.languages = updates.languages
  if (updates.linkedin !== undefined) metadata.linkedin = updates.linkedin.trim()
  if (updates.phone !== undefined) metadata.phone = updates.phone.trim()

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabase.from(TABLES.profiles).update(profilePatch).eq('id', account.userId)
    fail(error)
  }

  if (Object.keys(interviewerPatch).length > 0) {
    const { error } = await supabase
      .from(TABLES.interviewerProfiles)
      .update(interviewerPatch)
      .eq('id', account.interviewer.id)
    fail(error)
  }

  if (Object.keys(metadata).length > 0) {
    await updateAuthMetadata(metadata)
  }

  return getInterviewerProfile()
}

export async function getInterviewerSkills(interviewerProfileId?: string): Promise<string[]> {
  const id = interviewerProfileId ?? (await getInterviewerProfile()).interviewer.id
  const { data, error } = await supabase.from(TABLES.interviewerSkills).select('skill').eq('interviewer_profile_id', id)
  fail(error)
  return unique((data ?? []).map((row) => row.skill))
}

export async function updateInterviewerSkills(skills: string[]): Promise<string[]> {
  const account = await getInterviewerProfile()
  const next = unique(skills.map((skill) => skill.trim()).filter(Boolean))
  const { data: existing, error: existingError } = await supabase
    .from(TABLES.interviewerSkills)
    .select('id, skill')
    .eq('interviewer_profile_id', account.interviewer.id)
  fail(existingError)

  const current = existing ?? []
  const toDelete = current.filter((row) => !next.includes(row.skill)).map((row) => row.id)
  const toInsert = next.filter((skill) => !current.some((row) => row.skill === skill))

  if (toDelete.length > 0) {
    const { error } = await supabase.from(TABLES.interviewerSkills).delete().in('id', toDelete)
    fail(error)
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from(TABLES.interviewerSkills).insert(
      toInsert.map((skill) => ({
        interviewer_profile_id: account.interviewer.id,
        skill,
      })),
    )
    fail(error)
  }

  return getInterviewerSkills(account.interviewer.id)
}

async function getInterviewerRoleRows(interviewerProfileId: string): Promise<InterviewerRoleRecord[]> {
  const { data, error } = await supabase
    .from(TABLES.interviewerRoles)
    .select('id, interviewer_profile_id, target_role, candidate_level')
    .eq('interviewer_profile_id', interviewerProfileId)
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    interviewer_profile_id: row.interviewer_profile_id,
    target_role: row.target_role,
    candidate_level: row.candidate_level,
  }))
}

export async function getInterviewerRoles(): Promise<{ targetRoles: string[]; candidateLevels: string[] }> {
  const account = await getInterviewerProfile()
  const rows = await getInterviewerRoleRows(account.interviewer.id)
  return {
    targetRoles: unique(rows.map((row) => row.target_role).filter((role) => role !== 'Any')),
    candidateLevels: unique(rows.map((row) => row.candidate_level).filter((level): level is string => Boolean(level))),
  }
}

export async function updateInterviewerRoles(input: {
  targetRoles: string[]
  candidateLevels: string[]
}): Promise<{ targetRoles: string[]; candidateLevels: string[] }> {
  const account = await getInterviewerProfile()
  const targetRoles = unique(input.targetRoles.map((role) => role.trim()).filter(Boolean))
  const candidateLevels = unique(input.candidateLevels.map((level) => level.trim()).filter(Boolean))

  const nextRows: Array<{ target_role: string; candidate_level: string | null }> = []
  if (targetRoles.length > 0 && candidateLevels.length > 0) {
    for (const targetRole of targetRoles) {
      for (const candidateLevel of candidateLevels) {
        nextRows.push({ target_role: targetRole, candidate_level: candidateLevel })
      }
    }
  } else if (targetRoles.length > 0) {
    for (const targetRole of targetRoles) nextRows.push({ target_role: targetRole, candidate_level: null })
  } else if (candidateLevels.length > 0) {
    for (const candidateLevel of candidateLevels) nextRows.push({ target_role: 'Any', candidate_level: candidateLevel })
  }

  const { error: deleteError } = await supabase
    .from(TABLES.interviewerRoles)
    .delete()
    .eq('interviewer_profile_id', account.interviewer.id)
  fail(deleteError)

  if (nextRows.length > 0) {
    const { error } = await supabase.from(TABLES.interviewerRoles).insert(
      nextRows.map((row) => ({
        interviewer_profile_id: account.interviewer.id,
        target_role: row.target_role,
        candidate_level: row.candidate_level,
      })),
    )
    fail(error)
  }

  return getInterviewerRoles()
}

export async function getVerificationStatus(interviewerProfileId?: string): Promise<VerificationStatusItem[]> {
  const id = interviewerProfileId ?? (await getInterviewerProfile()).interviewer.id
  const { data, error } = await supabase
    .from(TABLES.interviewerVerifications)
    .select('kind, status')
    .eq('interviewer_profile_id', id)
  fail(error)

  const byKind = new Map<DbVerificationKind, DisplayVerificationStatus>()
  for (const row of data ?? []) {
    const kind = asVerificationKind(row.kind)
    if (!kind) continue
    byKind.set(kind, asVerificationStatus(row.status))
  }

  return VERIFICATION_KINDS.map((kind) => ({
    kind,
    status: byKind.get(kind) ?? 'pending',
  }))
}

function unique(values: string[]) {
  return [...new Set(values)]
}
