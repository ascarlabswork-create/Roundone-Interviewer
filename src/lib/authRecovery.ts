import { PASSWORD_RESET_PATH } from '../services/auth.ts'

const RECOVERY_SESSION_KEY = 'jobround.password_recovery'

/** Supabase password recovery puts `type=recovery` in the query string or URL hash. */
export function isAuthRecoveryUrl(href?: string) {
  const raw = href ?? (typeof window !== 'undefined' ? window.location.href : '')
  if (!raw) return false
  try {
    const url = new URL(raw)
    if (url.searchParams.get('type') === 'recovery') return true
  } catch {
    return raw.includes('type=recovery')
  }
  return raw.includes('type=recovery')
}

let memoryRecoveryFlag = false

function recoveryFlagStore() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function markPasswordRecoveryPending() {
  const store = recoveryFlagStore()
  if (store) store.setItem(RECOVERY_SESSION_KEY, '1')
  else memoryRecoveryFlag = true
}

export function isPasswordRecoveryPending() {
  const store = recoveryFlagStore()
  if (store) return store.getItem(RECOVERY_SESSION_KEY) === '1'
  return memoryRecoveryFlag
}

export function clearPasswordRecoveryPending() {
  const store = recoveryFlagStore()
  store?.removeItem(RECOVERY_SESSION_KEY)
  memoryRecoveryFlag = false
}

/** True while the user is following a reset-password link (before the URL hash is cleared). */
export function isInPasswordRecoveryFlow(href?: string) {
  return isAuthRecoveryUrl(href) || isPasswordRecoveryPending()
}

/** Full navigation keeps the hash Supabase needs to establish the recovery session. */
export function redirectToPasswordRecovery(href?: string) {
  markPasswordRecoveryPending()
  if (typeof window === 'undefined') return
  const source = new URL(href ?? window.location.href)
  const target = new URL(PASSWORD_RESET_PATH, source.origin)
  target.search = source.search
  target.hash = source.hash
  if (target.pathname + target.search + target.hash === source.pathname + source.search + source.hash) return
  window.location.replace(target.toString())
}
