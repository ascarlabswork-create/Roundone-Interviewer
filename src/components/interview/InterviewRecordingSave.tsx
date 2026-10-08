import { FolderDown } from 'lucide-react'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/primitives.tsx'

export function InterviewRecordingSave({
  canSave,
  saving,
  error,
  onSave,
  compact = false,
}: {
  canSave: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  compact?: boolean
}) {
  if (!canSave && !error) return null

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canSave ? (
          <>
            <p className="text-xs text-white/80">
              Recording finished. Choose a folder and filename on this computer to keep a copy.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onSave}
              disabled={saving}
              className="border-white/20 bg-transparent text-white hover:border-white"
            >
              <FolderDown className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save to computer'}
            </Button>
          </>
        ) : null}
        {error ? <p className="text-xs text-amber-100">{error}</p> : null}
      </div>
    )
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-navy-950">Interview recording</h2>
      <p className="mt-1 text-sm text-slate-500">
        The call is recorded on the server. After it finishes, save a copy to a folder on this computer.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {canSave ? (
        <div className="mt-4">
          <Button onClick={onSave} disabled={saving}>
            <FolderDown className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save to computer'}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No saved recording is available for this interview yet.</p>
      )}
    </Card>
  )
}
