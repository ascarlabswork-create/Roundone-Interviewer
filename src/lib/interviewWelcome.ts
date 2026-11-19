import type { AppRole } from '../services/auth.ts'
import { destinationForRole } from './nextPath.ts'

export const INTERVIEWER_WELCOME = '/interviewer/welcome'

export type InterviewWelcomeAccount = {
  skills: readonly string[]
  targetRoles: readonly string[]
  interviewer: { current_role: string; company: string; headline?: string | null; bio?: string | null }
}

/** Soft-delete and new signup both use placeholder job fields until welcome is completed. */
export function isInterviewWelcomePlaceholder(currentRole: string, company: string) {
  const role = currentRole.trim()
  const org = company.trim()
  return (role === 'Pending' && org === 'Pending') || (role === 'Deleted' && org === 'Deleted')
}

export function needsInterviewWelcome(account: InterviewWelcomeAccount) {
  const placeholder = isInterviewWelcomePlaceholder(
    account.interviewer.current_role,
    account.interviewer.company,
  )
  return placeholder || account.skills.length === 0 || account.targetRoles.length === 0
}

function pathOnly(value: string) {
  return value.split('?')[0] ?? value
}

/** First stop after sign-in only (not on in-app links such as live interview rooms). */
export function landingPathForAccount(
  role: AppRole | null | undefined,
  account: InterviewWelcomeAccount | null | undefined,
  requested: string,
) {
  const next = destinationForRole(role, requested)
  if (role === 'admin' || !account || !needsInterviewWelcome(account)) return next
  const path = pathOnly(next)
  // Keep deep links into a live room; every other post-auth landing goes to welcome.
  if (path.startsWith('/interviewer/interview/')) return next
  return INTERVIEWER_WELCOME
}

export function welcomeHeadline(role: string, interviewTypes: readonly string[], existing: string | null | undefined) {
  const current = existing?.trim() ?? ''
  const title = role.trim()
  const focus = interviewTypes.map((item) => item.trim()).filter(Boolean).join(', ')
  // Prefer interview focus alone — current_role is shown on its own line in the preview.
  // Avoid storing "software Engineer · System Design" which duplicated the role under the name.
  if (current && current !== title && current !== `${title} · ${focus}`) return current
  return focus || title
}

export function welcomeBio(interviewTypes: readonly string[], note: string) {
  const focus = interviewTypes.map((item) => item.trim()).filter(Boolean)
  const focusLine = focus.length > 0 ? `I interview candidates on ${focus.join(', ')}.` : ''
  const written = note.trim()
  if (!focusLine) return written
  if (!written) return focusLine
  return `${focusLine} ${written}`
}
