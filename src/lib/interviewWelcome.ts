import type { AppRole } from '../services/auth.ts'
import { destinationForRole, INTERVIEWER_HOME } from './nextPath.ts'

export const INTERVIEWER_WELCOME = '/interviewer/welcome'

export type InterviewWelcomeAccount = {
  skills: readonly string[]
  targetRoles: readonly string[]
  interviewer: { current_role: string; company: string; headline?: string | null; bio?: string | null }
}

export function needsInterviewWelcome(account: InterviewWelcomeAccount) {
  const placeholder = account.interviewer.current_role === 'Pending' && account.interviewer.company === 'Pending'
  return placeholder || account.skills.length === 0 || account.targetRoles.length === 0
}

function pathOnly(value: string) {
  return value.split('?')[0] ?? value
}

/** First stop after sign-in only (not on in-app links such as Verification → Dashboard). */
export function landingPathForAccount(
  role: AppRole | null | undefined,
  account: InterviewWelcomeAccount | null | undefined,
  requested: string,
) {
  const next = destinationForRole(role, requested)
  if (role === 'admin' || !account || !needsInterviewWelcome(account)) return next
  const path = pathOnly(next)
  if (path === INTERVIEWER_HOME || path === '/interviewer/setup') return INTERVIEWER_WELCOME
  return next
}

export function welcomeHeadline(role: string, interviewTypes: readonly string[], existing: string | null | undefined) {
  const current = existing?.trim() ?? ''
  const title = role.trim()
  if (current && current !== title) return current
  const focus = interviewTypes.map((item) => item.trim()).filter(Boolean).join(', ')
  return focus ? `${title} · ${focus}` : title
}

export function welcomeBio(interviewTypes: readonly string[], note: string) {
  const focus = interviewTypes.map((item) => item.trim()).filter(Boolean)
  const focusLine = focus.length > 0 ? `I interview candidates on ${focus.join(', ')}.` : ''
  const written = note.trim()
  if (!focusLine) return written
  if (!written) return focusLine
  return `${focusLine} ${written}`
}
