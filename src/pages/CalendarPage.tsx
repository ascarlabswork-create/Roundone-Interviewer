import { useMemo, useState } from 'react'
import {
  addBlockedTime,
  addCustomSlot,
  deleteBlockedTime,
  deleteCustomSlot,
  getAvailabilitySchedule,
  listBookings,
  listServices,
  saveRecurringAvailability,
} from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { SlotBadge } from '../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../components/ui/dashboard.tsx'
import { Card, FieldLabel, PageHeader, SelectInput, Skeleton, TextInput } from '../components/ui/primitives.tsx'
import { BUFFER_OPTIONS, TIMEZONES, WEEKDAY_LABELS, WEEKDAY_ORDER } from '../data/catalogs.ts'
import { cn } from '../lib/cn.ts'
import {
  addDays,
  formatClock,
  formatClockRange,
  formatDateLong,
  minutesToTime,
  nextDateWithWeekday,
  sameDay,
  startOfWeek,
  timezoneLabel,
  toISODate,
  weekdayShort,
} from '../lib/dates.ts'
import {
  buildDayPeriods,
  defaultRangeForDay,
  generateBookableSlots,
  generateUpcomingSlots,
  validateRecurring,
} from '../lib/slots.ts'
import { useAsync } from '../lib/useAsync.ts'
import { useToast } from '../state/toast.tsx'
import type {
  AvailabilitySchedule,
  AvailabilitySettings,
  BufferMinutes,
  CalendarPeriod,
  RecurringAvailability,
} from '../types.ts'

export function CalendarPage() {
  const scheduleState = useAsync(() => getAvailabilitySchedule(), [])
  const bookingsState = useAsync(() => listBookings(), [])
  const servicesState = useAsync(() => listServices(), [])
  const { pushToast } = useToast()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDate, setPreviewDate] = useState(nextDateWithWeekday(6))
  const [previewServiceId, setPreviewServiceId] = useState('rahul-coding')
  const [customOpen, setCustomOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<{ recurring: RecurringAvailability[]; settings: AvailabilitySettings } | null>(null)
  const [customForm, setCustomForm] = useState({ date: '', startTime: '14:00', endTime: '18:00', note: '' })
  const [blockForm, setBlockForm] = useState({
    date: '',
    allDay: true,
    startTime: '18:00',
    endTime: '21:00',
    reason: '',
  })

  const schedule = scheduleState.status === 'success' ? scheduleState.data : null
  const working = draft ?? (schedule ? { recurring: schedule.recurring, settings: schedule.settings } : null)
  const bookings = bookingsState.status === 'success' ? bookingsState.data : []
  const services = servicesState.status === 'success' ? servicesState.data.filter((item) => item.isActive) : []
  const previewService = services.find((item) => item.id === previewServiceId) ?? services[0]
  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const liveSchedule = schedule && working ? { ...schedule, ...working } : schedule

  const previewSlots = liveSchedule
    ? generateBookableSlots({
        schedule: liveSchedule,
        bookings,
        date: previewDate,
        durationMin: previewService?.durationMin ?? 60,
        serviceId: previewService?.id,
      })
    : []

  function updateRange(id: string, patch: Partial<RecurringAvailability>) {
    if (!working) return
    setDraft({
      ...working,
      recurring: working.recurring.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  function addRange(dayOfWeek: number) {
    if (!working) return
    const existing = working.recurring.filter((item) => item.dayOfWeek === dayOfWeek && item.isActive)
    const defaults = existing.length ? { startTime: '18:00', endTime: '21:00' } : defaultRangeForDay(dayOfWeek)
    setDraft({
      ...working,
      recurring: [
        ...working.recurring,
        {
          id: `rec-${dayOfWeek}-${Date.now()}`,
          interviewerId: working.settings.interviewerId,
          dayOfWeek,
          startTime: defaults.startTime,
          endTime: defaults.endTime,
          timezone: working.settings.timezone,
          isActive: true,
          serviceId: null,
        },
      ],
    })
  }

  function removeRange(id: string) {
    if (!working) return
    const target = working.recurring.find((item) => item.id === id)
    const sameDay = working.recurring.filter((item) => item.dayOfWeek === target?.dayOfWeek)
    if (sameDay.length <= 1 && target) {
      updateRange(id, { isActive: false })
      return
    }
    setDraft({ ...working, recurring: working.recurring.filter((item) => item.id !== id) })
  }

  async function onSave() {
    if (!working) return
    const nextErrors = validateRecurring(working.recurring, working.settings.timezone)
    setErrors(nextErrors)
    if (nextErrors.length) return
    setSaving(true)
    try {
      await saveRecurringAvailability(working.recurring, working.settings)
      pushToast('Availability saved. Candidates will only see generated valid slots.')
      setDraft(null)
      scheduleState.reload()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not save availability'])
    } finally {
      setSaving(false)
    }
  }

  async function onAddCustom() {
    try {
      await addCustomSlot({
        ...customForm,
        timezone: working?.settings.timezone ?? 'Asia/Kolkata',
        serviceId: null,
      })
      pushToast('Custom availability added')
      setCustomOpen(false)
      scheduleState.reload()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not add custom slot')
    }
  }

  async function onAddBlock() {
    try {
      await addBlockedTime({
        date: blockForm.date,
        allDay: blockForm.allDay,
        startTime: blockForm.allDay ? null : blockForm.startTime,
        endTime: blockForm.allDay ? null : blockForm.endTime,
        reason: blockForm.reason || 'Blocked',
      })
      pushToast('Blocked time saved. It overrides recurring availability.')
      setBlockOpen(false)
      scheduleState.reload()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not block time')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        subtitle="Set when candidates can book your interview sessions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              Preview Candidate View
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              Save Availability
            </Button>
          </div>
        }
      />

      <Card className="p-5">
        <p className="text-sm font-medium text-slate-500">Timezone</p>
        <div className="mt-2 max-w-md">
          <SelectInput
            value={working?.settings.timezone ?? 'Asia/Kolkata'}
            onChange={(event) =>
              working && setDraft({ ...working, settings: { ...working.settings, timezone: event.target.value } })
            }
          >
            {TIMEZONES.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </SelectInput>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Availability belongs to your timezone ({timezoneLabel(working?.settings.timezone ?? 'Asia/Kolkata')}). Candidates
          never pick a time you have not opened.
        </p>
      </Card>

      {errors.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {scheduleState.status === 'loading' || !working ? <Skeleton className="h-64" /> : null}

      {working ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Weekly recurring schedule</h2>
              <p className="text-sm text-slate-500">You control the windows. RoundOne generates the slots inside them.</p>
            </div>
            <div className="space-y-3">
              {WEEKDAY_ORDER.map((day) => {
                const ranges = working.recurring.filter((item) => item.dayOfWeek === day)
                const enabled = ranges.some((item) => item.isActive)
                return (
                  <Card key={day} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm font-semibold text-navy-950">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => {
                            if (!event.target.checked) {
                              setDraft({
                                ...working,
                                recurring: working.recurring.map((item) =>
                                  item.dayOfWeek === day ? { ...item, isActive: false } : item,
                                ),
                              })
                              return
                            }
                            const next = working.recurring.map((item) =>
                              item.dayOfWeek === day ? { ...item, isActive: true } : item,
                            )
                            if (!next.some((item) => item.dayOfWeek === day)) addRange(day)
                            else setDraft({ ...working, recurring: next })
                          }}
                        />
                        {WEEKDAY_LABELS[day]}
                      </label>
                      <span className="text-xs text-slate-500">{enabled ? 'Available' : 'Unavailable'}</span>
                    </div>
                    {enabled ? (
                      <div className="mt-3 space-y-2">
                        {ranges
                          .filter((item) => item.isActive)
                          .map((range) => (
                            <div key={range.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                              <SelectInput
                                value={range.startTime}
                                onChange={(event) => updateRange(range.id, { startTime: event.target.value })}
                              >
                                {TIME_OPTIONS.map((time) => (
                                  <option key={time} value={time}>
                                    {formatClock(time)}
                                  </option>
                                ))}
                              </SelectInput>
                              <SelectInput
                                value={range.endTime}
                                onChange={(event) => updateRange(range.id, { endTime: event.target.value })}
                              >
                                {TIME_OPTIONS.map((time) => (
                                  <option key={time} value={time}>
                                    {formatClock(time)}
                                  </option>
                                ))}
                              </SelectInput>
                              <Button size="sm" variant="ghost" onClick={() => removeRange(range.id)}>
                                Remove
                              </Button>
                            </div>
                          ))}
                        <Button size="sm" variant="outline" onClick={() => addRange(day)}>
                          + Add Time Range
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </section>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-navy-950">Booking buffer</h2>
            <p className="mt-1 text-sm text-slate-500">Buffer time prevents back-to-back sessions.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="duration">Interview duration</FieldLabel>
                <SelectInput
                  id="duration"
                  value={String(working.settings.defaultDurationMin)}
                  onChange={(event) =>
                    setDraft({
                      ...working,
                      settings: { ...working.settings, defaultDurationMin: Number(event.target.value) },
                    })
                  }
                >
                  {[45, 60, 90].map((item) => (
                    <option key={item} value={item}>
                      {item} minutes
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="buffer">Buffer between interviews</FieldLabel>
                <SelectInput
                  id="buffer"
                  value={String(working.settings.bufferMin)}
                  onChange={(event) =>
                    setDraft({
                      ...working,
                      settings: { ...working.settings, bufferMin: Number(event.target.value) as BufferMinutes },
                    })
                  }
                >
                  {BUFFER_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item} min
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Slot generation uses each service’s duration. A 90-minute Full Interview only appears if the whole window
              fits.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-navy-950">Service-specific availability</h2>
            <p className="mt-1 text-sm text-slate-500">
              Global availability applies to every service today. Each window can later target a single service (for
              example System Design on Saturday 6–9 PM, Coding on Sunday 10 AM–1 PM).
            </p>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy-950">Custom Availability</h2>
                <Button size="sm" variant="outline" onClick={() => setCustomOpen(true)}>
                  + Add Custom Slot
                </Button>
              </div>
              <p className="mt-1 text-sm text-slate-500">One-time windows even when the weekly schedule is closed.</p>
              <ul className="mt-4 space-y-3">
                {schedule?.customSlots.map((slot) => (
                  <li key={slot.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <p className="font-medium text-navy-950">{formatDateLong(combineIso(slot.date))}</p>
                    <p className="text-slate-600">{formatClockRange(slot.startTime, slot.endTime)}</p>
                    {slot.note ? <p className="mt-1 text-xs text-slate-500">{slot.note}</p> : null}
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => deleteCustomSlot(slot.id).then(() => scheduleState.reload())}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy-950">Blocked Dates</h2>
                <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}>
                  + Block Date
                </Button>
              </div>
              <p className="mt-1 text-sm text-slate-500">Blocked times override recurring availability.</p>
              <ul className="mt-4 space-y-3">
                {schedule?.blockedTimes.map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <p className="font-medium text-navy-950">{formatDateLong(combineIso(item.date))}</p>
                    <p className="text-slate-600">
                      {item.allDay ? 'All day' : formatClockRange(item.startTime ?? '00:00', item.endTime ?? '23:59')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Reason: {item.reason}</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => deleteBlockedTime(item.id).then(() => scheduleState.reload())}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy-950">Calendar</h2>
                <p className="text-sm text-slate-500">Available, booked, and blocked periods in your timezone.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setWeekOffset((value) => value - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
                  This week
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setWeekOffset((value) => value + 1)}>
                  Next
                </Button>
                <Tabs
                  value={view}
                  onChange={(id) => setView(id as 'week' | 'month')}
                  items={[
                    { id: 'week', label: 'Week' },
                    { id: 'month', label: 'Month' },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Legend color="bg-blue-50 text-blue-800 ring-1 ring-blue-100" label="Available" />
              <Legend color="bg-navy-950 text-white" label="Booked" />
              <Legend color="bg-slate-100 text-slate-600 ring-1 ring-slate-200" label="Blocked" />
            </div>
            {liveSchedule && view === 'week' ? (
              <WeekView days={days} schedule={liveSchedule} bookings={bookings} onSelectDate={setPreviewDate} />
            ) : null}
            {liveSchedule && view === 'month' ? (
              <MonthView schedule={liveSchedule} bookings={bookings} onSelectDate={setPreviewDate} />
            ) : null}
          </section>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-navy-950">Preview what candidates will see</h2>
            <p className="mt-1 text-sm text-slate-500">
              Candidates can only select these generated slots. They cannot choose an arbitrary date or time.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="inline-preview-date">Date</FieldLabel>
                <TextInput
                  id="inline-preview-date"
                  type="date"
                  value={previewDate}
                  onChange={(event) => setPreviewDate(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="inline-preview-service">Service</FieldLabel>
                <SelectInput
                  id="inline-preview-service"
                  value={previewService?.id ?? ''}
                  onChange={(event) => setPreviewServiceId(event.target.value)}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.durationMin} min
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-navy-950">
              {previewDate ? formatDateLong(combineIso(previewDate)) : 'Select a date'}
            </p>
            {previewSlots.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No candidate-visible slots on this date.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {previewSlots.map((slot) => (
                  <li key={slot.id} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                    {formatClock(slot.startTime)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      <SlideOver title="Preview what candidates will see" open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <p className="text-sm text-slate-600">
          These are the only times a candidate can select for the chosen service duration. They cannot pick an arbitrary
          time.
        </p>
        <div className="mt-4 grid gap-3">
          <div>
            <FieldLabel htmlFor="preview-date">Date</FieldLabel>
            <TextInput id="preview-date" type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="preview-service">Service duration</FieldLabel>
            <SelectInput
              id="preview-service"
              value={previewService?.id ?? ''}
              onChange={(event) => setPreviewServiceId(event.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.durationMin} min
                </option>
              ))}
            </SelectInput>
          </div>
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold text-navy-950">
            {previewDate ? formatDateLong(combineIso(previewDate)) : 'Select a date'}
          </p>
          {previewSlots.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No candidate-visible slots on this date.</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {previewSlots.map((slot) => (
              <li key={slot.id} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                {formatClock(slot.startTime)}
              </li>
            ))}
          </ul>
        </div>
      </SlideOver>

      <SlideOver title="Add custom availability" open={customOpen} onClose={() => setCustomOpen(false)}>
        <div className="grid gap-4">
          <div>
            <FieldLabel htmlFor="custom-date">Date</FieldLabel>
            <TextInput id="custom-date" type="date" value={customForm.date} onChange={(event) => setCustomForm({ ...customForm, date: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="custom-start">Start</FieldLabel>
              <SelectInput id="custom-start" value={customForm.startTime} onChange={(event) => setCustomForm({ ...customForm, startTime: event.target.value })}>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {formatClock(time)}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="custom-end">End</FieldLabel>
              <SelectInput id="custom-end" value={customForm.endTime} onChange={(event) => setCustomForm({ ...customForm, endTime: event.target.value })}>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {formatClock(time)}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="custom-note">Reason / note</FieldLabel>
            <TextInput id="custom-note" value={customForm.note} onChange={(event) => setCustomForm({ ...customForm, note: event.target.value })} />
          </div>
          <Button onClick={onAddCustom}>Add custom slot</Button>
        </div>
      </SlideOver>

      <SlideOver title="Block date" open={blockOpen} onClose={() => setBlockOpen(false)}>
        <div className="grid gap-4">
          <div>
            <FieldLabel htmlFor="block-date">Date</FieldLabel>
            <TextInput id="block-date" type="date" value={blockForm.date} onChange={(event) => setBlockForm({ ...blockForm, date: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={blockForm.allDay}
              onChange={(event) => setBlockForm({ ...blockForm, allDay: event.target.checked })}
            />
            All day
          </label>
          {blockForm.allDay ? null : (
            <div className="grid grid-cols-2 gap-3">
              <SelectInput value={blockForm.startTime} onChange={(event) => setBlockForm({ ...blockForm, startTime: event.target.value })}>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {formatClock(time)}
                  </option>
                ))}
              </SelectInput>
              <SelectInput value={blockForm.endTime} onChange={(event) => setBlockForm({ ...blockForm, endTime: event.target.value })}>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {formatClock(time)}
                  </option>
                ))}
              </SelectInput>
            </div>
          )}
          <div>
            <FieldLabel htmlFor="block-reason">Reason</FieldLabel>
            <TextInput
              id="block-reason"
              value={blockForm.reason}
              onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}
            />
          </div>
          <Button onClick={onAddBlock}>Block date</Button>
        </div>
      </SlideOver>
    </div>
  )
}

const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => minutesToTime(8 * 60 + index * 30))

function combineIso(ymd: string) {
  return `${ymd}T00:00:00`
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className={cn('rounded-full px-2.5 py-1 font-medium', color)}>{label}</span>
}

function WeekView({
  days,
  schedule,
  bookings,
  onSelectDate,
}: {
  days: Date[]
  schedule: AvailabilitySchedule
  bookings: Awaited<ReturnType<typeof listBookings>>
  onSelectDate: (ymd: string) => void
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <div className="grid min-w-[860px] grid-cols-7 divide-x divide-slate-100">
          {days.map((day) => {
            const ymd = toISODate(day)
            const periods = buildDayPeriods({
              schedule,
              bookings,
              date: ymd,
              durationMin: schedule.settings.defaultDurationMin,
            })
            return (
              <button key={ymd} type="button" className="min-h-80 p-3 text-left" onClick={() => onSelectDate(ymd)}>
                <p className="text-xs font-semibold uppercase text-slate-500">{weekdayShort(day)}</p>
                <p className="text-sm font-semibold text-navy-950">{day.getDate()}</p>
                <div className="mt-3 space-y-2">
                  {periods.length === 0 ? <p className="text-xs text-slate-400">Unavailable</p> : null}
                  {periods.map((period) => (
                    <PeriodBar key={`${period.startMin}-${period.state}`} period={period} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {days.map((day) => {
          const ymd = toISODate(day)
          const periods = buildDayPeriods({
            schedule,
            bookings,
            date: ymd,
            durationMin: schedule.settings.defaultDurationMin,
          })
          return (
            <Card key={ymd} className="p-4">
              <button type="button" className="w-full text-left" onClick={() => onSelectDate(ymd)}>
                <p className="font-semibold text-navy-950">
                  {weekdayShort(day)} {day.getDate()}
                </p>
                <div className="mt-3 space-y-2">
                  {periods.map((period) => (
                    <PeriodBar key={`${period.startMin}-${period.state}`} period={period} />
                  ))}
                </div>
              </button>
            </Card>
          )
        })}
      </div>
    </>
  )
}

function PeriodBar({ period }: { period: CalendarPeriod }) {
  const allDay = period.startMin <= 0 && period.endMin >= 24 * 60
  return (
    <div
      className={cn(
        'rounded-lg px-2 py-2 text-[11px] font-medium',
        period.state === 'available' && 'bg-blue-50 text-blue-800',
        period.state === 'booked' && 'bg-navy-950 text-white',
        period.state === 'blocked' && 'bg-slate-100 text-slate-600',
      )}
    >
      <p>
        {allDay
          ? 'All day'
          : `${formatClock(minutesToTime(period.startMin))} → ${formatClock(minutesToTime(Math.min(period.endMin, 24 * 60 - 1)))}`}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <SlotBadge state={period.state} />
        {period.label ? <span className="truncate opacity-80">{period.label}</span> : null}
      </div>
    </div>
  )
}

function MonthView({
  schedule,
  bookings,
  onSelectDate,
}: {
  schedule: AvailabilitySchedule
  bookings: Awaited<ReturnType<typeof listBookings>>
  onSelectDate: (ymd: string) => void
}) {
  const start = startOfWeek(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const cells = useMemo(() => Array.from({ length: 35 }, (_, index) => addDays(start, index)), [start])
  const upcoming = generateUpcomingSlots(schedule, bookings, schedule.settings.defaultDurationMin, 40)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="px-2 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const ymd = toISODate(day)
          const periods = buildDayPeriods({
            schedule,
            bookings,
            date: ymd,
            durationMin: schedule.settings.defaultDurationMin,
          })
          const hasSlots = upcoming.some((slot) => slot.date === ymd)
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelectDate(ymd)}
              className="min-h-24 border-t border-r border-slate-100 p-2 text-left"
            >
              <p className="text-xs font-medium text-slate-500">{day.getDate()}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {periods.slice(0, 3).map((period) => (
                  <span
                    key={`${period.startMin}-${period.state}`}
                    className={cn(
                      'h-2 w-2 rounded-full',
                      period.state === 'available' && 'bg-blue-500',
                      period.state === 'booked' && 'bg-navy-950',
                      period.state === 'blocked' && 'bg-slate-400',
                    )}
                  />
                ))}
              </div>
              {hasSlots ? <p className="mt-2 text-[10px] text-blue-700">Bookable</p> : null}
              {sameDay(day, new Date()) ? <p className="text-[10px] text-slate-400">Today</p> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
