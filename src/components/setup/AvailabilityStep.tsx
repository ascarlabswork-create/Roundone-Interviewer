import { useState } from 'react'
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../../data/catalogs.ts'
import { formatClockRange, minutesToTime, timeToMinutes, timezoneLabel, toISODate } from '../../lib/dates.ts'
import type { Weekday } from '../../services/interviewerAvailability.ts'
import type { OnboardingCustomSlot, OnboardingWeeklyRange } from '../../types.ts'
import { Button } from '../ui/Button.tsx'
import { ClockTimeInput } from '../ui/ClockTimeInput.tsx'
import { FieldLabel, TextInput } from '../ui/primitives.tsx'

function newId() {
  return crypto.randomUUID()
}

function nextRangeForDay(existing: OnboardingWeeklyRange[]) {
  const sorted = [...existing].sort((a, b) => a.startTime.localeCompare(b.startTime))
  if (sorted.length === 0) return { startTime: '10:00', endTime: '14:00' }
  const last = sorted[sorted.length - 1]
  const startMin = timeToMinutes(last.endTime)
  const endMin = startMin + 180
  if (endMin <= 22 * 60) {
    return { startTime: minutesToTime(startMin), endTime: minutesToTime(endMin) }
  }
  return { startTime: '10:00', endTime: '14:00' }
}

export function validateOnboardingAvailability(
  weekly: OnboardingWeeklyRange[],
  custom: OnboardingCustomSlot[],
) {
  for (const range of weekly) {
    if (timeToMinutes(range.startTime) >= timeToMinutes(range.endTime)) {
      throw new Error(`${WEEKDAY_LABELS[range.weekday]}: start time must be before end time.`)
    }
  }
  for (const day of WEEKDAY_ORDER) {
    const ranges = weekly
      .filter((item) => item.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let index = 1; index < ranges.length; index += 1) {
      if (timeToMinutes(ranges[index].startTime) < timeToMinutes(ranges[index - 1].endTime)) {
        throw new Error(`${WEEKDAY_LABELS[day]}: time ranges overlap.`)
      }
    }
  }
  for (const slot of custom) {
    if (!slot.date) throw new Error('Choose a date for each one-off window.')
    if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
      throw new Error(`${slot.date}: start time must be before end time.`)
    }
  }
  const byDate = new Map<string, OnboardingCustomSlot[]>()
  for (const slot of custom) {
    const list = byDate.get(slot.date) ?? []
    list.push(slot)
    byDate.set(slot.date, list)
  }
  for (const [date, slots] of byDate) {
    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let index = 1; index < sorted.length; index += 1) {
      if (timeToMinutes(sorted[index].startTime) < timeToMinutes(sorted[index - 1].endTime)) {
        throw new Error(`${date}: time ranges overlap.`)
      }
    }
  }
}

export function AvailabilityStep({
  timezone,
  weekly,
  custom,
  onWeeklyChange,
  onCustomChange,
}: {
  timezone: string
  weekly: OnboardingWeeklyRange[]
  custom: OnboardingCustomSlot[]
  onWeeklyChange: (next: OnboardingWeeklyRange[]) => void
  onCustomChange: (next: OnboardingCustomSlot[]) => void
}) {
  const [oneOffDate, setOneOffDate] = useState(toISODate(new Date()))
  const [oneOffStart, setOneOffStart] = useState('10:00')
  const [oneOffEnd, setOneOffEnd] = useState('14:00')
  const [oneOffError, setOneOffError] = useState<string | null>(null)

  function toggleDay(day: Weekday, enabled: boolean) {
    if (!enabled) {
      onWeeklyChange(weekly.filter((item) => item.weekday !== day))
      return
    }
    if (weekly.some((item) => item.weekday === day)) return
    const defaults = nextRangeForDay([])
    onWeeklyChange([
      ...weekly,
      { id: newId(), weekday: day, startTime: defaults.startTime, endTime: defaults.endTime },
    ])
  }

  function updateRange(id: string, patch: Partial<Pick<OnboardingWeeklyRange, 'startTime' | 'endTime'>>) {
    onWeeklyChange(weekly.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function addRange(day: Weekday) {
    const defaults = nextRangeForDay(weekly.filter((item) => item.weekday === day))
    onWeeklyChange([
      ...weekly,
      { id: newId(), weekday: day, startTime: defaults.startTime, endTime: defaults.endTime },
    ])
  }

  function addOneOff() {
    setOneOffError(null)
    const next: OnboardingCustomSlot = {
      id: newId(),
      date: oneOffDate,
      startTime: oneOffStart,
      endTime: oneOffEnd,
    }
    try {
      validateOnboardingAvailability(weekly, [...custom, next])
    } catch (caught) {
      setOneOffError(caught instanceof Error ? caught.message : 'Could not add that window.')
      return
    }
    onCustomChange([...custom, next])
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm text-slate-600">Timezone: {timezoneLabel(timezone)}</p>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-950">Weekly hours</h2>
          <p className="text-sm text-slate-500">
            Turn on the days you can interview, then set start and end times with the clock.
          </p>
        </div>
        <div className="space-y-3">
          {WEEKDAY_ORDER.map((day) => {
            const ranges = weekly.filter((item) => item.weekday === day)
            const enabled = ranges.length > 0
            return (
              <div key={day} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-3 text-sm font-semibold text-navy-950">
                    <input type="checkbox" checked={enabled} onChange={(event) => toggleDay(day, event.target.checked)} />
                    {WEEKDAY_LABELS[day]}
                  </label>
                  <span className="text-xs text-slate-500">{enabled ? 'Available' : 'Unavailable'}</span>
                </div>
                {enabled ? (
                  <div className="mt-3 space-y-2">
                    {ranges.map((range) => (
                      <div key={range.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                        <ClockTimeInput
                          value={range.startTime}
                          aria-label={`${WEEKDAY_LABELS[day]} start time`}
                          onChange={(startTime) => updateRange(range.id, { startTime })}
                        />
                        <ClockTimeInput
                          value={range.endTime}
                          aria-label={`${WEEKDAY_LABELS[day]} end time`}
                          onChange={(endTime) => updateRange(range.id, { endTime })}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => onWeeklyChange(weekly.filter((item) => item.id !== range.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" type="button" onClick={() => addRange(day)}>
                      Add time
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-950">Specific dates</h2>
          <p className="text-sm text-slate-500">
            Optional. Pick a date from the calendar and a clock range for one-off availability.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <FieldLabel htmlFor="setup-avail-date">Date</FieldLabel>
            <TextInput
              id="setup-avail-date"
              type="date"
              value={oneOffDate}
              onChange={(event) => setOneOffDate(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="setup-avail-start">Start</FieldLabel>
            <ClockTimeInput id="setup-avail-start" value={oneOffStart} onChange={setOneOffStart} />
          </div>
          <div>
            <FieldLabel htmlFor="setup-avail-end">End</FieldLabel>
            <ClockTimeInput id="setup-avail-end" value={oneOffEnd} onChange={setOneOffEnd} />
          </div>
          <Button type="button" variant="outline" onClick={addOneOff}>
            Add date
          </Button>
        </div>
        {oneOffError ? <p className="text-sm text-red-700">{oneOffError}</p> : null}
        {custom.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No specific dates yet. Use the calendar if you are free on a date that is not part of your weekly hours.
          </p>
        ) : (
          <ul className="space-y-2">
            {custom.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy-950"
              >
                <span>
                  {slot.date} · {formatClockRange(slot.startTime, slot.endTime)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => onCustomChange(custom.filter((item) => item.id !== slot.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
