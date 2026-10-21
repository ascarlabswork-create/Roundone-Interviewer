/** Origins registered on the shared jobround.ai Google OAuth web client. */
export const GOOGLE_OAUTH_WEB_CLIENT_ID =
  '36438582739-1nvehrporgsk8rvlhr76abn900g1fqra.apps.googleusercontent.com'

export const GOOGLE_OAUTH_BUILTIN_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://experts.jobround.ai',
] as const

export const SUPABASE_GOOGLE_REDIRECT_URI =
  'https://fhcrxjrqtojixgqemofp.supabase.co/auth/v1/callback'

function extraOriginsFromEnv(): string[] {
  const raw = import.meta.env.VITE_GOOGLE_AUTHORIZED_ORIGINS?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((item: string) => item.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

/** Returns origins that should be allowlisted in Google Cloud for this app. */
export function googleOAuthOriginAllowlist(): string[] {
  const list = new Set<string>([...GOOGLE_OAUTH_BUILTIN_ORIGINS, ...extraOriginsFromEnv()])
  const publicApp = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (publicApp) list.add(publicApp)
  return [...list]
}

/**
 * Google Identity (One Tap) only runs on origins registered in Google Cloud.
 * Preview URLs and custom domains must be added there and optionally via
 * VITE_PUBLIC_APP_URL / VITE_GOOGLE_AUTHORIZED_ORIGINS.
 */
export function isGoogleIdentityOriginAllowed(origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!origin) return false
  return googleOAuthOriginAllowlist().includes(origin.replace(/\/$/, ''))
}
