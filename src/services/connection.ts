import { JOBROUND_PROJECT_REF, supabase } from '../lib/supabase.ts'
import { TABLES } from './tables.ts'

export type ConnectionCheck = {
  ok: boolean
  projectRef: string
  error?: string
}

function isProjectReachableError(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('jwt') ||
    lower.includes('not authenticated')
  )
}

/** Lightweight reachability check against the shared jobround.ai project. No writes. */
export async function verifySupabaseConnection(): Promise<ConnectionCheck> {
  const { error } = await supabase.from(TABLES.profiles).select('id', { head: true, count: 'exact' })

  if (!error) {
    return {
      ok: true,
      projectRef: JOBROUND_PROJECT_REF,
    }
  }

  // Unauthenticated roles may be denied by grants/RLS; a PostgREST reply still means we hit jobround.ai.
  if (isProjectReachableError(error.message)) {
    return {
      ok: true,
      projectRef: JOBROUND_PROJECT_REF,
    }
  }

  return {
    ok: false,
    projectRef: JOBROUND_PROJECT_REF,
    error: error.message,
  }
}
