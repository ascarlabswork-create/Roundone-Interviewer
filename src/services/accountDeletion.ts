import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

export const DELETE_ACCOUNT_FUNCTION = 'delete-interviewer-account'
export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE'

export function isDeleteConfirmationValid(value: string) {
  return value.trim() === DELETE_ACCOUNT_CONFIRMATION
}

export function deleteAccountErrorMessage(code: string | null) {
  switch (code) {
    case 'interview_in_progress':
      return 'You have an interview in progress. Finish it before deleting your account.'
    case 'not_authenticated':
      return 'Your session has expired. Sign in again, then retry.'
    case 'not_interviewer':
      return 'Only interviewer accounts can be deleted here.'
    case 'confirmation_required':
      return `Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm.`
    default:
      return 'Could not delete your account. Try again in a moment.'
  }
}

async function readErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  const context: unknown = error.context
  if (!(context instanceof Response)) return null
  try {
    const body: unknown = await context.clone().json()
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error
    }
  } catch {
    return null
  }
  return null
}

type InvokeDelete = () => Promise<{ data: unknown; error: unknown }>

const invokeDelete: InvokeDelete = () =>
  supabase.functions.invoke(DELETE_ACCOUNT_FUNCTION, { body: { confirm: DELETE_ACCOUNT_CONFIRMATION } })

/**
 * Deletes the signed-in interviewer through the server-side Edge Function
 * (which holds the service role), then clears the local session. The auth
 * user no longer exists afterwards, so only the local session is cleared.
 */
export async function deleteMyInterviewerAccount(options?: {
  invoke?: InvokeDelete
  signOutLocal?: () => Promise<unknown>
}): Promise<void> {
  const { data, error } = await (options?.invoke ?? invokeDelete)()
  if (error) throw new Error(deleteAccountErrorMessage(await readErrorCode(error)))
  const deleted = data && typeof data === 'object' && (data as { deleted?: unknown }).deleted === true
  if (!deleted) throw new Error(deleteAccountErrorMessage(null))
  await (options?.signOutLocal ?? (() => supabase.auth.signOut({ scope: 'local' })))()
}
