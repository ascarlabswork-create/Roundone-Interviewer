import { createClient } from '@supabase/supabase-js'

const EXPECTED_PROJECT_REF = 'fhcrxjrqtojixgqemofp'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local.',
  )
}

if (!supabaseUrl.includes(EXPECTED_PROJECT_REF)) {
  throw new Error(
    `Interviewer must use the shared jobround.ai Supabase project (${EXPECTED_PROJECT_REF}). Got: ${supabaseUrl}`,
  )
}

export const JOBROUND_PROJECT_REF = EXPECTED_PROJECT_REF

const REQUEST_TIMEOUT_MS = 15_000
const FUNCTION_TIMEOUT_MS = 60_000

/**
 * A stalled request would otherwise never settle, leaving pages on their loading state and holding the
 * auth lock that every other request waits on.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const timeout = AbortSignal.timeout(url.includes('/functions/v1/') ? FUNCTION_TIMEOUT_MS : REQUEST_TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  return fetch(input, { ...init, signal })
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithTimeout },
})
