import { FolderDown } from 'lucide-react'
import { INTERVIEW_NOTES_MAX_LENGTH } from '../../lib/interviewRoomExtras.ts'
import { Button } from '../ui/Button.tsx'
import type { NotesSaveState } from './useInterviewNotes.ts'

export function InterviewNotesPanel({
  value,
  saveState,
  error,
  exporting,
  onChange,
  onSave,
  onSaveToComputer,
}: {
  value: string
  saveState: NotesSaveState
  error: string | null
  exporting?: boolean
  onChange: (value: string) => void
  onSave: () => void
  onSaveToComputer: () => void
}) {
  const status =
    saveState === 'saving'
      ? 'Saving to your account…'
      : saveState === 'saved'
        ? 'Saved to your account'
        : saveState === 'error'
          ? 'Could not save'
          : 'Private to you'

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-800">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-navy-950">Notes</h2>
        <p className="text-xs text-slate-500">
          These stay in your interviewer account for this interview. The candidate cannot read them. Use Save to
          computer to pick a folder and keep a .txt copy on this PC.
        </p>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, INTERVIEW_NOTES_MAX_LENGTH))}
        maxLength={INTERVIEW_NOTES_MAX_LENGTH}
        className="min-h-0 flex-1 resize-none p-4 text-sm outline-none"
        placeholder="Observations, follow-up questions, scoring notes…"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3">
        <p className={`text-xs ${saveState === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{error ?? status}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onSaveToComputer} disabled={exporting || !value.trim()}>
            <FolderDown className="h-4 w-4" />
            {exporting ? 'Saving…' : 'Save to computer'}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saveState === 'saving'}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
