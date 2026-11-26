import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ACCOUNT_DELETED_LOGIN_PATH,
  DELETE_ACCOUNT_CONFIRMATION,
  deleteMyInterviewerAccount,
  isDeleteConfirmationValid,
} from '../../services/accountDeletion.ts'
import { useOnboarding } from '../../state/onboarding.tsx'
import { Button } from '../ui/Button.tsx'
import { Card, FieldLabel, TextInput } from '../ui/primitives.tsx'

export function DeleteAccountCard() {
  const navigate = useNavigate()
  const { reset } = useOnboarding()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (!isDeleteConfirmationValid(confirmation)) return
    setError(null)
    setDeleting(true)
    try {
      await deleteMyInterviewerAccount()
      reset()
      navigate(ACCOUNT_DELETED_LOGIN_PATH, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete your account. Try again in a moment.')
      setDeleting(false)
    }
  }

  return (
    <Card className="border-red-200 p-6">
      <h2 className="text-lg font-semibold text-red-800">Delete account</h2>
      <p className="mt-1 text-sm text-slate-600">
        Permanently delete your interviewer account and sign out. If you also use the same email as a
        candidate on jobround.ai, that candidate account stays. This cannot be undone.
      </p>
      {open ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">This will:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Delete your interviewer profile, skills, roles, services, availability, custom slots and blocked times.</li>
              <li>Delete interviewer verifications and the feedback you wrote as an interviewer.</li>
              <li>Cancel your upcoming and pending interviewer bookings. Candidates are notified of the cancellation.</li>
              <li>
                Keep past booking records for the candidates you interviewed, with your name and details removed.
              </li>
              <li>Leave any candidate account on the same email untouched.</li>
            </ul>
          </div>
          <div className="max-w-sm">
            <FieldLabel htmlFor="delete-confirm">Type {DELETE_ACCOUNT_CONFIRMATION} to confirm</FieldLabel>
            <TextInput
              id="delete-confirm"
              autoComplete="off"
              value={confirmation}
              disabled={deleting}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={deleting || !isDeleteConfirmationValid(confirmation)}
              onClick={() => void onDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete my account permanently'}
            </Button>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setOpen(false)
                setConfirmation('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4 border-red-300 text-red-700" onClick={() => setOpen(true)}>
          Delete account…
        </Button>
      )}
    </Card>
  )
}
