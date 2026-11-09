import type { InterviewerAccount, VerificationStatusItem } from '../services/interviewerProfile.ts'

export const VERIFICATION_SUBMITTED_PATH = '/interviewer/verification/submitted'
export const VERIFICATION_VERIFIED_PATH = '/interviewer/verification/verified'
export const INTERVIEWER_PROFILE_PATH = '/interviewer/profile'

const REQUEST_KINDS = ['identity', 'employment'] as const

export type VerificationProfileCheck = {
  id: string
  label: string
  done: boolean
  href: string
}

export function verificationKindsRequested(verifications: readonly VerificationStatusItem[]) {
  return REQUEST_KINDS.every((kind) => verifications.some((row) => row.kind === kind && row.id))
}

export function verificationFullyVerified(verifications: readonly VerificationStatusItem[]) {
  return REQUEST_KINDS.every((kind) =>
    verifications.some((row) => row.kind === kind && row.status === 'verified'),
  )
}

export function verificationHasRejection(verifications: readonly VerificationStatusItem[]) {
  return verifications.some((row) => row.kind !== 'linkedin' && row.status === 'rejected')
}

/** Details admins review on jobround.ai — all editable on Profile. */
export function verificationProfileChecks(account: InterviewerAccount): VerificationProfileCheck[] {
  const { interviewer, profile, skills, targetRoles } = account
  return [
    {
      id: 'name',
      label: 'Full name (identity)',
      done: Boolean(profile.full_name.trim()),
      href: INTERVIEWER_PROFILE_PATH,
    },
    {
      id: 'summary',
      label: 'Professional summary or headline',
      done: Boolean(interviewer.bio?.trim() || interviewer.headline?.trim()),
      href: INTERVIEWER_PROFILE_PATH,
    },
    {
      id: 'employment',
      label: 'Current role and company (employment)',
      done:
        interviewer.current_role !== 'Pending' &&
        interviewer.company !== 'Pending' &&
        Boolean(interviewer.current_role.trim() && interviewer.company.trim()),
      href: INTERVIEWER_PROFILE_PATH,
    },
    {
      id: 'experience',
      label: 'Years of experience',
      done: interviewer.experience_years > 0,
      href: INTERVIEWER_PROFILE_PATH,
    },
    {
      id: 'skills',
      label: 'Skills you interview on',
      done: skills.length > 0,
      href: INTERVIEWER_PROFILE_PATH,
    },
    {
      id: 'roles',
      label: 'Roles you interview for',
      done: targetRoles.length > 0,
      href: INTERVIEWER_PROFILE_PATH,
    },
  ]
}

export function verificationProfileReady(account: InterviewerAccount) {
  return verificationProfileChecks(account).every((item) => item.done)
}

const IDENTITY_CHECK_IDS = ['name'] as const
const EMPLOYMENT_CHECK_IDS = ['summary', 'employment', 'experience', 'skills', 'roles'] as const

function checksDoneForIds(account: InterviewerAccount, ids: readonly string[]) {
  const byId = new Map(verificationProfileChecks(account).map((row) => [row.id, row.done]))
  return ids.every((id) => byId.get(id) === true)
}

/** Interviewer-editable profile fields for each verification kind (admin review is separate). */
export function verificationKindDetailsComplete(
  account: InterviewerAccount,
  kind: (typeof REQUEST_KINDS)[number],
) {
  if (kind === 'identity') return checksDoneForIds(account, IDENTITY_CHECK_IDS)
  return checksDoneForIds(account, EMPLOYMENT_CHECK_IDS)
}

export function verificationAnyDetailsIncomplete(account: InterviewerAccount) {
  return REQUEST_KINDS.some((kind) => !verificationKindDetailsComplete(account, kind))
}
