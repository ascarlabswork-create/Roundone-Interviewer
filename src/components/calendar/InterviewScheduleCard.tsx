import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  addCommonWindow,
  applyCommonSlotsToDays,
  buildMonthCells,
  countInclusiveDays,
  dateCalendarKind,
  removeCommonWindow,
  scheduleDraftFromAvailability,
  scheduleSummary,
  updateCommonWindow,
  validateCommonWindows,
  validateScheduleDraft,
  type ScheduleDraft,
  type ScheduleWindow,
} from '../../lib/interviewSchedule.ts'
import { formatClock, formatDateLong, fromYMD, minutesToTime, timeToMinutes, toISODate, timezoneLabel } from '../../lib/dates.ts'
import { cn } from '../../lib/cn.ts'
import type { AvailabilityBoard, CustomSlotRecord } from '../../services/interviewerAvailability.ts'
import { Button } from '../ui/Button.tsx'
import { ClockTimeInput } from '../ui/ClockTimeInput.tsx'
import { Card, FieldLabel, TextInput } from '../ui/primitives.tsx'

type DateOverrideWindow = {
  startTime: string
  endTime: string
}

function cloneWindows(windows: ScheduleWindow[]): DateOverrideWindow[] {
  return windows.map((window) => ({ startTime: window.startTime, endTime: window.endTime }))
}

function windowsFromCustomSlots(slots: CustomSlotRecord[], date: string): DateOverrideWindow[] {
  return slots
    .filter((slot) => slot.on_date === date)
    .map((slot) => ({ startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5) }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-950 text-xs font-semibold text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
      {step}
    </span>
  )
}

function Panel({
  step,
  title,
  children,
  className,
}: {
  step: number
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'group rounded-2xl border border-navy-950/10 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)]',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <StepBadge step={step} />
        <h3 className="text-sm font-semibold text-navy-950">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function InterviewScheduleCard({
  board,
  saving,
  onSave,
  onSaveDateCustom,
  onResetDateCustom,
}: {
  board: AvailabilityBoard
  saving: boolean
  onSave: (draft: ScheduleDraft) => void
  onSaveDateCustom?: (date: string, windows: DateOverrideWindow[]) => Promise<void> | void
  onResetDateCustom?: (date: string) => Promise<void> | void
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
  const [attempted, setAttempted] = useState(false)
  const [applyFlash, setApplyFlash] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [monthCursor, setMonthCursor] = useState(() => {
    const seed = board.availableFrom ? fromYMD(board.availableFrom) : new Date()
    return new Date(seed.getFullYear(), seed.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => board.availableFrom || toISODate(new Date()))
  const [dateWindows, setDateWindows] = useState<DateOverrideWindow[]>(() =>
    windowsFromCustomSlots(board.customSlots, board.availableFrom || toISODate(new Date())),
  )
  const [dateSaving, setDateSaving] = useState(false)
  const [dateMessage, setDateMessage] = useState<string | null>(null)

  useEffect(() => {
    const next = scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability)
    setDraft(next)
    setAttempted(false)
    setApplyError(null)
    const seed = next.from ? fromYMD(next.from) : new Date()
    setMonthCursor(new Date(seed.getFullYear(), seed.getMonth(), 1))
    const nextSelected = next.from || toISODate(new Date())
    setSelectedDate(nextSelected)
    setDateWindows(windowsFromCustomSlots(board.customSlots, nextSelected))
  }, [savedKey, board.availableFrom, board.availableUntil, board.availability, board.customSlots])

  const errors = validateScheduleDraft(draft)
  const saved = scheduleDraftFromAvailability(board.availableFrom, board.availableUntil, board.availability)
  const dirty = JSON.stringify({ ...draft, applyMode: 'replace' }) !== JSON.stringify({ ...saved, applyMode: 'replace' })

  const customDates = useMemo(() => new Set(board.customSlots.map((slot) => slot.on_date)), [board.customSlots])
  const blockedDates = useMemo(
    () => new Set(board.blockedTimes.filter((row) => row.all_day).map((row) => row.on_date)),
    [board.blockedTimes],
  )
  const summary = scheduleSummary(draft, customDates)
  const selectedCount = countInclusiveDays(draft.from, draft.until)
  const monthCells = buildMonthCells(monthCursor)
  const monthLabel = monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedKind = dateCalendarKind(selectedDate, draft, customDates, blockedDates)
  const selectedHasCustom = customDates.has(selectedDate)
  const commonWindowsPreview = draft.days.find((day) => day.enabled)?.windows ?? draft.commonWindows

  function selectDate(date: string) {
    setSelectedDate(date)
    setDateMessage(null)
    const custom = windowsFromCustomSlots(board.customSlots, date)
    if (custom.length > 0) {
      setDateWindows(custom)
      return
    }
    const weekday = fromYMD(date).getDay()
    const weekly = draft.days[weekday]
    setDateWindows(weekly?.enabled ? cloneWindows(weekly.windows) : cloneWindows(draft.commonWindows))
  }

  function applyCommon() {
    const commonErrors = validateCommonWindows(draft.commonWindows)
    if (commonErrors.length > 0) {
      setApplyError(commonErrors[0] ?? 'Could not apply common hours.')
      return
    }
    if (!draft.from || !draft.until) {
      setApplyError('Choose a start and end date first.')
      return
    }
    setApplyError(null)
    setDraft(applyCommonSlotsToDays(draft))
    setApplyFlash(true)
    window.setTimeout(() => setApplyFlash(false), 900)
  }

  function save() {
    setAttempted(true)
    if (errors.length > 0) return
    onSave(draft)
  }

  async function saveDateCustom() {
    if (!onSaveDateCustom) return
    if (dateWindows.length === 0) {
      setDateMessage('Add at least one time slot for this date.')
      return
    }
    if (dateWindows.some((window) => timeToMinutes(window.startTime) >= timeToMinutes(window.endTime))) {
      setDateMessage('Each slot must end after it starts.')
      return
    }
    setDateSaving(true)
    setDateMessage(null)
    try {
      await onSaveDateCustom(selectedDate, dateWindows)
      setDateMessage('Custom hours saved for this date.')
    } catch (caught) {
      setDateMessage(caught instanceof Error ? caught.message : 'Could not save custom hours.')
    } finally {
      setDateSaving(false)
    }
  }

  async function resetDateCustom() {
    if (!onResetDateCustom) return
    setDateSaving(true)
    setDateMessage(null)
    try {
      await onResetDateCustom(selectedDate)
      const weekday = fromYMD(selectedDate).getDay()
      const weekly = draft.days[weekday]
      setDateWindows(weekly?.enabled ? cloneWindows(weekly.windows) : cloneWindows(draft.commonWindows))
      setDateMessage('Reset to common hours for this date.')
    } catch (caught) {
      setDateMessage(caught instanceof Error ? caught.message : 'Could not reset this date.')
    } finally {
      setDateSaving(false)
    }
  }

  return (
    <Card className="overflow-hidden border-navy-950/10 p-0 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)]">
      <div className="relative overflow-hidden border-b border-navy-950/8 bg-gradient-to-br from-navy-950 via-navy-900 to-coral-800 px-5 py-6 text-white sm:px-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-20 h-36 w-36 rounded-full bg-coral-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-gold-400" aria-hidden />
              <h2 className="text-xl font-semibold tracking-tight">Interview Availability</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Set your date window, apply shared hours across those days, then customize any single date. Nothing is
              published until you save.
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-300',
              dirty ? 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-200/40' : 'bg-emerald-300/15 text-emerald-100 ring-1 ring-emerald-200/30',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', dirty ? 'animate-pulse bg-amber-300' : 'bg-emerald-300')} />
            {dirty ? 'Draft' : 'Saved'}
          </span>
        </div>
      </div>

      <div className="space-y-4 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_48%)] p-4 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel step={1} title="Select Date Range">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <div>
                <FieldLabel htmlFor="range-from">Start</FieldLabel>
                <TextInput
                  id="range-from"
                  type="date"
                  value={draft.from}
                  max={draft.until || undefined}
                  disabled={saving}
                  onChange={(event) => {
                    const from = event.target.value
                    setDraft((current) => ({ ...current, from }))
                    if (from) {
                      const seed = fromYMD(from)
                      setMonthCursor(new Date(seed.getFullYear(), seed.getMonth(), 1))
                      selectDate(from)
                    }
                  }}
                />
              </div>
              <div className="hidden items-end justify-center pb-3 text-slate-400 sm:flex">→</div>
              <div>
                <FieldLabel htmlFor="range-until">End</FieldLabel>
                <TextInput
                  id="range-until"
                  type="date"
                  value={draft.until}
                  min={draft.from || undefined}
                  disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, until: event.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-navy-950/8 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4 text-navy-700" aria-hidden />
                <span>Days in window</span>
              </div>
              <span className="text-sm font-semibold text-navy-950">
                {selectedCount > 0 ? `${selectedCount} days selected` : 'Set both dates'}
              </span>
            </div>
          </Panel>

          <Panel step={2} title="Set Common Time Slots">
            <p className="mb-3 text-xs text-slate-500">
              These hours repeat on every weekday inside your date range. Apply once, then customize individual dates
              below.
            </p>
            <div className="space-y-2">
              {draft.commonWindows.map((window, index) => (
                <div
                  key={`common-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors duration-200 hover:border-navy-950/20"
                >
                  <span className="min-w-20 text-xs font-medium text-slate-500">Slot {index + 1}</span>
                  <ClockTimeInput
                    value={window.startTime}
                    disabled={saving}
                    aria-label={`Common slot ${index + 1} start`}
                    onChange={(startTime) => setDraft((current) => updateCommonWindow(current, index, { startTime }))}
                  />
                  <span className="text-sm text-slate-400">to</span>
                  <ClockTimeInput
                    value={window.endTime}
                    disabled={saving}
                    aria-label={`Common slot ${index + 1} end`}
                    onChange={(endTime) => setDraft((current) => updateCommonWindow(current, index, { endTime }))}
                  />
                  {draft.commonWindows.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => setDraft((current) => removeCommonWindow(current, index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => setDraft((current) => addCommonWindow(current))}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-navy-950/20 px-3 py-2.5 text-sm font-medium text-navy-800 transition-all duration-200 hover:border-coral-500/50 hover:bg-coral-50/60 hover:text-coral-800"
            >
              <Plus className="h-4 w-4" />
              Add another time slot
            </button>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { mode: 'replace' as const, title: 'Replace existing', body: 'Overwrite weekday hours with these slots.' },
                  { mode: 'add' as const, title: 'Add to existing', body: 'Keep current hours and append these slots.' },
                ] as const
              ).map((option) => {
                const active = draft.applyMode === option.mode
                return (
                  <button
                    key={option.mode}
                    type="button"
                    disabled={saving}
                    onClick={() => setDraft((current) => ({ ...current, applyMode: option.mode }))}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left transition-all duration-200',
                      active
                        ? 'border-navy-950 bg-navy-950 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-navy-950/30',
                    )}
                  >
                    <p className="text-sm font-semibold">{option.title}</p>
                    <p className={cn('mt-1 text-xs', active ? 'text-white/70' : 'text-slate-500')}>{option.body}</p>
                  </button>
                )
              })}
            </div>

            <Button
              type="button"
              className={cn('mt-4 w-full transition-transform duration-300', applyFlash && 'scale-[1.02]')}
              disabled={saving}
              onClick={applyCommon}
            >
              {applyFlash ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" /> Applied
                </span>
              ) : (
                `Apply to ${selectedCount > 0 ? `all ${selectedCount} dates` : 'date range'}`
              )}
            </Button>
            {applyError ? <p className="mt-2 text-sm text-red-700">{applyError}</p> : null}
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel step={3} title="Calendar View">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-navy-950">{monthLabel}</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthCells.map((cell) => {
                const kind = dateCalendarKind(cell.date, draft, customDates, blockedDates)
                const selected = cell.date === selectedDate
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={saving || !cell.inMonth}
                    onClick={() => selectDate(cell.date)}
                    className={cn(
                      'relative aspect-square rounded-xl text-sm transition-all duration-200',
                      !cell.inMonth && 'opacity-25',
                      cell.inMonth && kind === 'available' && 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
                      cell.inMonth && kind === 'custom' && 'bg-navy-950 text-white shadow-md',
                      cell.inMonth && kind === 'unavailable' && 'bg-slate-50 text-slate-400 hover:bg-slate-100',
                      cell.inMonth && kind === 'outside' && 'text-slate-300 hover:bg-slate-50',
                      selected && 'ring-2 ring-coral-500 ring-offset-1',
                    )}
                  >
                    {cell.dayNumber}
                    {cell.inMonth && kind === 'available' ? (
                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500" />
                    ) : null}
                    {cell.inMonth && kind === 'custom' ? (
                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold-400" />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-navy-950" /> Custom time
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Not available
              </span>
            </div>
          </Panel>

          <Panel step={4} title="Edit Date Availability">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-navy-950">{formatDateLong(`${selectedDate}T12:00:00`)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedKind === 'outside'
                    ? 'Outside your date window'
                    : selectedHasCustom
                      ? 'Using custom hours for this date'
                      : selectedKind === 'available'
                        ? 'Using common hours for this weekday'
                        : 'No bookable hours on this date yet'}
                </p>
              </div>
              {selectedHasCustom ? (
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Customized</span>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              {dateWindows.map((window, index) => (
                <div
                  key={`date-${selectedDate}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                >
                  <span className="min-w-20 text-xs font-medium text-slate-500">Slot {index + 1}</span>
                  <ClockTimeInput
                    value={window.startTime}
                    disabled={saving || dateSaving || !onSaveDateCustom}
                    aria-label={`Date slot ${index + 1} start`}
                    onChange={(startTime) =>
                      setDateWindows((current) =>
                        current.map((row, rowIndex) => (rowIndex === index ? { ...row, startTime } : row)),
                      )
                    }
                  />
                  <span className="text-sm text-slate-400">to</span>
                  <ClockTimeInput
                    value={window.endTime}
                    disabled={saving || dateSaving || !onSaveDateCustom}
                    aria-label={`Date slot ${index + 1} end`}
                    onChange={(endTime) =>
                      setDateWindows((current) =>
                        current.map((row, rowIndex) => (rowIndex === index ? { ...row, endTime } : row)),
                      )
                    }
                  />
                  {dateWindows.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={saving || dateSaving || !onSaveDateCustom}
                      onClick={() => setDateWindows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || dateSaving || !onSaveDateCustom}
                onClick={() => {
                  const last = dateWindows[dateWindows.length - 1]
                  const start = last ? timeToMinutes(last.endTime) : timeToMinutes(draft.allStart)
                  const end = Math.min(start + 60, 23 * 60 + 59)
                  if (end <= start) return
                  setDateWindows((current) => [
                    ...current,
                    { startTime: minutesToTime(start), endTime: minutesToTime(end) },
                  ])
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add slot
              </Button>
              {onSaveDateCustom ? (
                <Button type="button" size="sm" disabled={saving || dateSaving} onClick={() => void saveDateCustom()}>
                  {dateSaving ? 'Saving…' : 'Save date hours'}
                </Button>
              ) : null}
              {selectedHasCustom && onResetDateCustom ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving || dateSaving}
                  onClick={() => void resetDateCustom()}
                >
                  Reset to common
                </Button>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
              {selectedHasCustom
                ? `Custom windows are saved for ${formatDateLong(`${selectedDate}T12:00:00`)} and add to your common weekday hours.`
                : `Save date hours to add custom windows for ${formatDateLong(`${selectedDate}T12:00:00`)} only. Common hours still apply until you customize.`}
            </div>
            {dateMessage ? <p className="mt-2 text-sm text-navy-800">{dateMessage}</p> : null}

            {commonWindowsPreview.length > 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                Common preview:{' '}
                {commonWindowsPreview.map((window) => `${formatClock(window.startTime)}–${formatClock(window.endTime)}`).join(', ')}
              </div>
            ) : null}
          </Panel>
        </div>

        {attempted && errors.length > 0 ? (
          <div className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        <div className="sticky bottom-3 z-10 rounded-2xl border border-navy-950/10 bg-white/95 p-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span>
                <strong className="text-navy-950">{summary.total}</strong> total dates
              </span>
              <span>
                <strong className="text-navy-950">{summary.common}</strong> common hours
              </span>
              <span>
                <strong className="text-navy-950">{summary.custom}</strong> custom dates
              </span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Clock3 className="h-3.5 w-3.5 text-navy-700" aria-hidden />
                {timezoneLabel(board.timezone)}
              </div>
              <Button
                type="button"
                disabled={saving || !dirty || (attempted && errors.length > 0)}
                onClick={save}
                className="min-w-44"
              >
                {saving ? 'Saving…' : 'Save availability'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
