import { useEffect, useState } from 'react'
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../../data/catalogs.ts'
import {
  addDayWindow,
  applyTimeToSelectedDays,
  removeDayWindow,
  scheduleDraftFromAvailability,
  setDayEnabled,
  updateDayWindow,
  validateScheduleDraft,
  type ScheduleDraft,
} from '../../lib/interviewSchedule.ts'
import { timeToMinutes } from '../../lib/dates.ts'
import { describeAvailableRange, type AvailabilityBoard } from '../../services/interviewerAvailability.ts'
import { Button } from '../ui/Button.tsx'
import { ClockTimeInput } from '../ui/ClockTimeInput.tsx'
import { Card, FieldLabel, TextInput } from '../ui/primitives.tsx'

export function InterviewScheduleCard({
  board,
  saving,
  onSave,
}: {
  board: AvailabilityBoard
  saving: boolean
  onSave: (draft: ScheduleDraft) => void
}) {
  const savedKey = [
    board.availableFrom ?? '',
    board.availableUntil ?? '',
    ...board.availability.map((row) => `${row.id}:${row.weekday}:${row.start_time}:${row.end_time}`),
  ].join('|')
  const [draft, setDraft] = useState(() =>
    scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability),
  )
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    setDraft(scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability))
    setAttempted(false)
  }, [savedKey, board.availableFrom, board.availableUntil, board.availability])

  const errors = validateScheduleDraft(draft)
  const saved = scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  function save() {
    setAttempted(true)
    if (errors.length > 0) return
    onSave(draft)
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-navy-950">When candidates can book you</h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose the dates, then give each weekday its own hours. Monday can be 10:00 AM–12:00 PM and Tuesday 3:00
        PM–6:00 PM. Those hours repeat on that weekday inside the date range. Nothing is published until you save.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="range-from">Start date</FieldLabel>
          <TextInput
            id="range-from"
            type="date"
            value={draft.from}
            max={draft.until || undefined}
            disabled={saving}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel htmlFor="range-until">End date</FieldLabel>
          <TextInput
            id="range-until"
            type="date"
            value={draft.until}
            min={draft.from || undefined}
            disabled={saving}
            onChange={(event) => setDraft({ ...draft, until: event.target.value })}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Current window: {describeAvailableRange({ availableFrom: draft.from || null, availableUntil: draft.until || null })}.
        Leave a date empty for no limit on that side.
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-navy-950">Time for each day</h3>
          <p className="mt-1 text-xs text-slate-500">
            Tick a day and set its own start and end. A different day can use a different time. Unchecked days stay
            closed.
          </p>
        </div>
        {WEEKDAY_ORDER.map((weekday) => {
          const day = draft.days[weekday]
          return (
            <div key={weekday} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 text-sm font-semibold text-navy-950">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    disabled={saving}
                    onChange={(event) => setDraft(setDayEnabled(draft, weekday, event.target.checked))}
                  />
                  {WEEKDAY_LABELS[weekday]}
                </label>
                {day.enabled ? (
                  <div className="space-y-2 pl-7">
                    {day.windows.map((window, index) => (
                      <div key={window.id ?? `${weekday}-${index}`} className="flex flex-wrap items-center gap-2">
                        <ClockTimeInput
                          value={window.startTime}
                          disabled={saving}
                          aria-label={`${WEEKDAY_LABELS[weekday]} start time`}
                          onChange={(startTime) => setDraft(updateDayWindow(draft, weekday, index, { startTime }))}
                        />
                        <span className="text-sm text-slate-400">to</span>
                        <ClockTimeInput
                          value={window.endTime}
                          disabled={saving}
                          aria-label={`${WEEKDAY_LABELS[weekday]} end time`}
                          onChange={(endTime) => setDraft(updateDayWindow(draft, weekday, index, { endTime }))}
                        />
                        {day.windows.length > 1 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={saving}
                            onClick={() => setDraft(removeDayWindow(draft, weekday, index))}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => setDraft(addDayWindow(draft, weekday))}
                    >
                      Add another time
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-xl border border-navy-950/10 bg-paper px-4 py-4">
        <h3 className="text-sm font-semibold text-navy-950">Optional: same time on every selected day</h3>
        <p className="mt-1 text-xs text-slate-500">
          Use this only when several days share one block. You can still change any day afterward.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ClockTimeInput
            id="all-dates-start"
            value={draft.allStart}
            disabled={saving}
            aria-label="Start time for all selected days"
            onChange={(allStart) => setDraft({ ...draft, allStart })}
          />
          <span className="text-sm text-slate-400">to</span>
          <ClockTimeInput
            id="all-dates-end"
            value={draft.allEnd}
            disabled={saving}
            aria-label="End time for all selected days"
            onChange={(allEnd) => setDraft({ ...draft, allEnd })}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (timeToMinutes(draft.allStart) >= timeToMinutes(draft.allEnd)) return
              setDraft(applyTimeToSelectedDays(draft))
            }}
          >
            Apply to selected days
          </Button>
        </div>
      </div>

      {attempted && errors.length > 0 ? (
        <div className="mt-4 space-y-1 text-sm text-red-700">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <Button type="button" disabled={saving || !dirty || (attempted && errors.length > 0)} onClick={save}>
          {saving ? 'Saving…' : 'Save schedule'}
        </Button>
      </div>
    </Card>
  )
}
