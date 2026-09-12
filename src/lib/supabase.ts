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
    `Interviewer must use the shared Roundone Supabase project (${EXPECTED_PROJECT_REF}). Got: ${supabaseUrl}`,
  )
}

export const ROUNDONE_PROJECT_REF = EXPECTED_PROJECT_REF

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
