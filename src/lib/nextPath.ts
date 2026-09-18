import type { AppRole } from '../services/auth.ts'

export const INTERVIEWER_HOME = '/interviewer/dashboard'
export const ADMIN_HOME = '/admin/dashboard'

export function defaultHomePath(role?: AppRole | null) {
  return role === 'admin' ? ADMIN_HOME : INTERVIEWER_HOME
}

export function safeNextPath(value: string | null, fallback = INTERVIEWER_HOME) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }
  if (
    value === '/' ||
    value === '/interviewer' ||
    value === '/interviewer/' ||
    value.startsWith('/interviewer/login') ||
    value.startsWith('/interviewer/register') ||
    value.startsWith('/interviewer/auth/callback')
  ) {
    return fallback
  }
  return value
}

export function destinationForRole(role: AppRole | null | undefined, nextPath: string) {
  if (role === 'admin') {
    return nextPath.startsWith('/admin') ? nextPath : ADMIN_HOME
  }
  if (nextPath.startsWith('/admin')) return INTERVIEWER_HOME
  return nextPath
}
