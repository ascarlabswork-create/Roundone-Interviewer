import { FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  deleteAccountErrorMessage,
  deleteMyInterviewerAccount,
  isDeleteConfirmationValid,
} from './accountDeletion.ts'

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }))
}

describe('delete account confirmation', () => {
  it('requires the exact confirmation word', () => {
    expect(isDeleteConfirmationValid('DELETE')).toBe(true)
    expect(isDeleteConfirmationValid(' DELETE ')).toBe(true)
    expect(isDeleteConfirmationValid('delete')).toBe(false)
    expect(isDeleteConfirmationValid('')).toBe(false)
  })
})

describe('deleteMyInterviewerAccount', () => {
  it('resolves when the server confirms deletion', async () => {
    await expect(
      deleteMyInterviewerAccount({
        invoke: async () => ({ data: { deleted: true }, error: null }),
      }),
    ).resolves.toBeUndefined()
  })

  it('shows a friendly message when an interview is in progress', async () => {
    await expect(
      deleteMyInterviewerAccount({
        invoke: async () => ({ data: null, error: httpError(409, { error: 'interview_in_progress' }) }),
      }),
    ).rejects.toThrow(deleteAccountErrorMessage('interview_in_progress'))
  })

  it('does not expose raw server errors', async () => {
    await expect(
      deleteMyInterviewerAccount({
        invoke: async () => ({ data: null, error: httpError(500, { error: 'delete_failed', detail: 'SQL state 23503' }) }),
      }),
    ).rejects.toThrow('Could not delete your account. Try again in a moment.')
  })

  it('treats an unexpected success body as a failure', async () => {
    await expect(
      deleteMyInterviewerAccount({ invoke: async () => ({ data: {}, error: null }) }),
    ).rejects.toThrow()
  })
})
