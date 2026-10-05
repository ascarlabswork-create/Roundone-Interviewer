import { FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
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
  it('clears the local session only after the server confirms deletion', async () => {
    const signOutLocal = vi.fn(async () => undefined)
    await deleteMyInterviewerAccount({
      invoke: async () => ({ data: { deleted: true }, error: null }),
      signOutLocal,
    })
    expect(signOutLocal).toHaveBeenCalledTimes(1)
  })

  it('keeps the session and shows a friendly message when an interview is in progress', async () => {
    const signOutLocal = vi.fn(async () => undefined)
    await expect(
      deleteMyInterviewerAccount({
        invoke: async () => ({ data: null, error: httpError(409, { error: 'interview_in_progress' }) }),
        signOutLocal,
      }),
    ).rejects.toThrow(deleteAccountErrorMessage('interview_in_progress'))
    expect(signOutLocal).not.toHaveBeenCalled()
  })

  it('does not expose raw server errors', async () => {
    await expect(
      deleteMyInterviewerAccount({
        invoke: async () => ({ data: null, error: httpError(500, { error: 'delete_failed', detail: 'SQL state 23503' }) }),
        signOutLocal: async () => undefined,
      }),
    ).rejects.toThrow('Could not delete your account. Try again in a moment.')
  })

  it('treats an unexpected success body as a failure', async () => {
    const signOutLocal = vi.fn(async () => undefined)
    await expect(
      deleteMyInterviewerAccount({ invoke: async () => ({ data: {}, error: null }), signOutLocal }),
    ).rejects.toThrow()
    expect(signOutLocal).not.toHaveBeenCalled()
  })
})
