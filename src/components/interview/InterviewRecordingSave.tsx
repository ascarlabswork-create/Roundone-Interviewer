import { FolderDown } from 'lucide-react'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/primitives.tsx'

export function InterviewRecordingSave({
  canSave,
  saving,
  saved = false,
  finishing = false,
  error,
  onSave,
  compact = false,
}: {
  canSave: boolean
  saving: boolean
  saved?: boolean
  finishing?: boolean
  error: string | null
  onSave: () => void
  compact?: boolean
}) {
  if (!canSave && !saving && !finishing && !error) return null

  if (compact) {
    const message = saving
      ? 'Saving the recording to your computer. This can take up to a minute while the file finishes processing.'
      : saved
        ? 'Recording saved to your computer.'
        : 'Recording finished. Choose where to save it on this computer.'
    return (
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <p className="text-xs text-white/80">{message}</p>
        {canSave && !saving ? (
          <Button size="sm" variant="inverse" onClick={onSave}>
            <FolderDown className="h-4 w-4" />
            {saved ? 'Save another copy' : 'Save to computer'}
          </Button>
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onSave} disabled={saving}>
            <FolderDown className="h-4 w-4" />
            {saving ? 'Saving…' : saved ? 'Save another copy' : 'Save to computer'}
          </Button>
          {saved && !saving ? <p className="text-sm text-emerald-700">Recording saved to your computer.</p> : null}
        </div>
      ) : finishing ? (
        <p className="mt-3 text-sm text-slate-600" aria-live="polite">
          The recording is still finishing. The save button appears here when it is ready.
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No saved recording is available for this interview yet.</p>
      )}
    </Card>
  )
}
