import type { AppRole } from '../services/auth.ts'

export const INTERVIEWER_HOME = '/interviewer/dashboard'
export const INTERVIEWER_SETUP = '/interviewer/setup?step=professional'
export const ADMIN_HOME = '/admin/dashboard'

function pathOnly(value: string) {
  return value.split('?')[0] ?? value
}

export function isInterviewerAppPath(value: string) {
  const path = pathOnly(value)
  return path === '/interviewer' || path.startsWith('/interviewer/') || path === '/admin' || path.startsWith('/admin/')
}

export function defaultHomePath(role?: AppRole | null) {
  return role === 'admin' ? ADMIN_HOME : INTERVIEWER_HOME
}

export function safeNextPath(value: string | null, fallback = INTERVIEWER_HOME) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }
  const path = pathOnly(value)
  if (path.startsWith('/candidate')) return fallback
  if (
    path === '/' ||
    path === '/interviewer' ||
    path === '/interviewer/' ||
    path.startsWith('/interviewer/login') ||
    path.startsWith('/interviewer/register') ||
    path.startsWith('/interviewer/auth/callback')
  ) {
    return fallback
  }
  if (!isInterviewerAppPath(value)) return fallback
  return value
}

export function destinationForRole(role: AppRole | null | undefined, nextPath: string) {
  if (role === 'admin') {
    return nextPath.startsWith('/admin') ? nextPath : ADMIN_HOME
  }
  if (!isInterviewerAppPath(nextPath) || nextPath.startsWith('/admin')) return INTERVIEWER_HOME
  return nextPath
}
