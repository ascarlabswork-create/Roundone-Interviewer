import { useEffect, useState } from 'react'
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../../data/catalogs.ts'
import {
  addDayWindow,
  applyTimeToSelectedDates,
  applyTimeToSelectedDays,
  dateTimesForRange,
  listRangeDates,
  MAX_DATED_HOURS,
  removeDayWindow,
  scheduleDraftFromAvailability,
  setDayEnabled,
  updateDayWindow,
  validateScheduleDraft,
  type DateTimeDraft,
  type ScheduleDraft,
} from '../../lib/interviewSchedule.ts'
import { formatReviewDate, fromYMD, timeToMinutes } from '../../lib/dates.ts'
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
  onSave: (draft: ScheduleDraft, dates: DateTimeDraft[]) => void
}) {
  const savedKey = [
    board.availableFrom ?? '',
    board.availableUntil ?? '',
    ...board.availability.map((row) => `${row.id}:${row.weekday}:${row.start_time}:${row.end_time}`),
    ...board.customSlots.map((row) => `${row.id}:${row.on_date}:${row.start_time}:${row.end_time}`),
  ].join('|')
  const [draft, setDraft] = useState(() =>
    scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability),
  )
  const [dateTimes, setDateTimes] = useState(() =>
    dateTimesForRange(board.availableFrom ?? '', board.availableUntil ?? '', [], board.customSlots, {
      startTime: '10:00',
      endTime: '18:00',
    }),
  )
  const [attempted, setAttempted] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    const next = scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability)
    setDraft(next)
    setDateTimes(
      dateTimesForRange(next.from, next.until, [], board.customSlots, {
        startTime: next.allStart,
        endTime: next.allEnd,
      }),
    )
    setAttempted(false)
  }, [savedKey, board.availableFrom, board.availableUntil, board.availability, board.customSlots])

  const errors = validateScheduleDraft(draft, undefined, dateTimes)
  const saved = scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability)
  const savedDates = dateTimesForRange(saved.from, saved.until, [], board.customSlots, {
    startTime: saved.allStart,
    endTime: saved.allEnd,
  })
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(saved) || JSON.stringify(dateTimes) !== JSON.stringify(savedDates)

  function save() {
    setAttempted(true)
    if (errors.length > 0) return
    onSave(draft, dateTimes)
  }

  function changeRange(patch: Partial<Pick<ScheduleDraft, 'from' | 'until'>>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    setDateTimes((current) =>
      dateTimesForRange(next.from, next.until, current, board.customSlots, {
        startTime: next.allStart,
        endTime: next.allEnd,
      }),
    )
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
            onChange={(event) => changeRange({ from: event.target.value })}
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
            onChange={(event) => changeRange({ until: event.target.value })}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Current window: {describeAvailableRange({ availableFrom: draft.from || null, availableUntil: draft.until || null })}.
        Leave a date empty for no limit on that side.
      </p>

      {dateTimes.length > 0 ? (
        <div className="mt-6 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-950">Time for each date</h3>
            <p className="mt-1 text-xs text-slate-500">
              Tick a date to give that day its own hours. Nov 6 can be 10:00 AM–12:00 PM and Nov 7 can be 4:00 PM–6:00
              PM. A date with its own time does not use the weekly hours.
            </p>
          </div>
          {listRangeDates(draft.from, draft.until).length === MAX_DATED_HOURS &&
          dateTimes[dateTimes.length - 1]?.date < draft.until ? (
            <p className="text-xs text-amber-800">
              This range is longer than {MAX_DATED_HOURS} days. The first {MAX_DATED_HOURS} dates are listed. Shorten
              the range to set a time on every date.
            </p>
          ) : null}
          {dateTimes.map((row, index) => (
            <div key={row.date} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 text-sm font-semibold text-navy-950">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    disabled={saving}
                    onChange={(event) =>
                      setDateTimes((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  {WEEKDAY_LABELS[fromYMD(row.date).getDay()]}, {formatReviewDate(row.date)}
                </label>
                {row.enabled ? (
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    <ClockTimeInput
                      value={row.startTime}
                      disabled={saving}
                      aria-label={`${row.date} start time`}
                      onChange={(startTime) =>
                        setDateTimes((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, startTime } : item)),
                        )
                      }
                    />
                    <span className="text-sm text-slate-400">to</span>
                    <ClockTimeInput
                      value={row.endTime}
                      disabled={saving}
                      aria-label={`${row.date} end time`}
                      onChange={(endTime) =>
                        setDateTimes((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, endTime } : item)),
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

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
        <h3 className="text-sm font-semibold text-navy-950">Same time for the dates you ticked</h3>
        <p className="mt-1 text-xs text-slate-500">
          Set one block, then apply it. Ticked dates get this time. If none are ticked yet, every date in the range is
          ticked. You can change any date afterward.
        </p>
        <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
          <ClockTimeInput
            id="all-dates-start"
            value={draft.allStart}
            disabled={saving}
            aria-label="Start time for all selected dates"
            onChange={(allStart) => {
              setApplyError(null)
              setDraft({ ...draft, allStart })
            }}
          />
          <span className="shrink-0 text-sm text-slate-400">to</span>
          <ClockTimeInput
            id="all-dates-end"
            value={draft.allEnd}
            disabled={saving}
            aria-label="End time for all selected dates"
            onChange={(allEnd) => {
              setApplyError(null)
              setDraft({ ...draft, allEnd })
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={saving}
            onClick={() => {
              if (timeToMinutes(draft.allStart) >= timeToMinutes(draft.allEnd)) {
                setApplyError('The end time has to be later than the start time.')
                return
              }
              setApplyError(null)
              setDraft(applyTimeToSelectedDays(draft))
              setDateTimes((current) => applyTimeToSelectedDates(current, draft.allStart, draft.allEnd))
            }}
          >
            Apply to selected dates
          </Button>
        </div>
        {applyError ? <p className="mt-2 text-sm text-red-700">{applyError}</p> : null}
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
