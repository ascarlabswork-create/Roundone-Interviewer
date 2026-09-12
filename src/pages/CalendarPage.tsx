import { useEffect, useMemo, useState } from 'react'
import { listBookings, listServices } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { SlotBadge } from '../components/ui/StatusBadge.tsx'
import { SlideOver, Tabs } from '../components/ui/dashboard.tsx'
import {
  Card,
  ErrorState,
  FieldLabel,
  PageHeader,
  SelectInput,
  Skeleton,
  TextInput,
} from '../components/ui/primitives.tsx'
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
  timeToMinutes,
  timezoneLabel,
  toISODate,
  weekdayShort,
} from '../lib/dates.ts'
import { buildDayPeriods, defaultRangeForDay, generateBookableSlots, generateUpcomingSlots } from '../lib/slots.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  createAvailability,
  createBlockedTime,
  createCustomSlot,
  deleteAvailability,
  deleteBlockedTime,
  deleteCustomSlot,
  loadMyAvailabilityBoard,
  updateAvailability,
  updateBlockedTime,
  updateCustomSlot,
  updateMyBookingBuffer,
  updateMyTimezone,
  type AvailabilityBoard,
  type BlockedTimeRecord,
  type BookingBufferMinutes,
  type CustomSlotRecord,
  type Weekday,
} from '../services/interviewerAvailability.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import type { AvailabilitySchedule, CalendarPeriod } from '../types.ts'

type CustomForm = {
  id: string | null
  date: string
  startTime: string
  endTime: string
}

type BlockForm = {
  id: string | null
  date: string
  allDay: boolean
  startTime: string
  endTime: string
  reason: string
}

const emptyCustomForm = (): CustomForm => ({
  id: null,
  date: '',
  startTime: '14:00',
  endTime: '18:00',
})

const emptyBlockForm = (): BlockForm => ({
  id: null,
  date: '',
  allDay: true,
  startTime: '18:00',
  endTime: '21:00',
  reason: '',
})

export function CalendarPage() {
  const { refreshAccount } = useSession()
  const boardState = useAsync(() => loadMyAvailabilityBoard(), [])
  const bookingsState = useAsync(() => listBookings(), [])
  const servicesState = useAsync(() => listServices(), [])
  const { pushToast } = useToast()
  const [board, setBoard] = useState<AvailabilityBoard | null>(null)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDate, setPreviewDate] = useState(nextDateWithWeekday(6))
  const [previewServiceId, setPreviewServiceId] = useState('rahul-coding')
  const [customForm, setCustomForm] = useState<CustomForm | null>(null)
  const [blockForm, setBlockForm] = useState<BlockForm | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (boardState.status === 'success') setBoard(boardState.data)
  }, [boardState.status, boardState.data])

  const bookings = bookingsState.status === 'success' ? bookingsState.data : []
  const services = servicesState.status === 'success' ? servicesState.data.filter((item) => item.isActive) : []
  const previewService = services.find((item) => item.id === previewServiceId) ?? services[0]
  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const liveSchedule = board ? toSchedule(board, previewService?.durationMin ?? 60) : null
  const timezoneOptions = board
    ? TIMEZONES.some((zone) => zone.id === board.timezone)
      ? TIMEZONES
      : [{ id: board.timezone, label: board.timezone }, ...TIMEZONES]
    : TIMEZONES

  const previewSlots = liveSchedule
    ? generateBookableSlots({
        schedule: liveSchedule,
        bookings,
        date: previewDate,
        durationMin: previewService?.durationMin ?? 60,
        serviceId: previewService?.id,
      })
    : []

  async function refreshBoard() {
    const next = await loadMyAvailabilityBoard()
    setBoard(next)
  }

  async function runMutation(action: () => Promise<unknown>, successMessage = 'Saved successfully') {
    setErrors([])
    setSaving(true)
    try {
      await action()
      await refreshBoard()
      pushToast(successMessage)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not save availability.'
      setErrors([message])
      pushToast(message)
    } finally {
      setSaving(false)
    }
  }

  async function onToggleDay(day: Weekday, enabled: boolean) {
    if (!board) return
    await runMutation(async () => {
      if (!enabled) {
        const rows = board.availability.filter((item) => item.weekday === day)
        for (const row of rows) {
          await deleteAvailability(row.id)
        }
        return
      }
      if (board.availability.some((item) => item.weekday === day)) return
      const defaults = defaultRangeForDay(day)
      await createAvailability({
        weekday: day,
        startTime: defaults.startTime,
        endTime: defaults.endTime,
      })
    })
  }

  async function onAddRange(day: Weekday) {
    if (!board) return
    const next = nextRangeForDay(day, board)
    await runMutation(() =>
      createAvailability({
        weekday: day,
        startTime: next.startTime,
        endTime: next.endTime,
      }),
    )
  }

  async function onUpdateRange(id: string, patch: { startTime?: string; endTime?: string }) {
    await runMutation(() => updateAvailability(id, patch))
  }

  async function onRemoveRange(id: string) {
    await runMutation(() => deleteAvailability(id))
  }

  async function onTimezoneChange(timezone: string) {
    await runMutation(async () => {
      await updateMyTimezone(timezone)
      await refreshAccount()
    })
  }

  async function onBufferChange(bufferMin: BookingBufferMinutes) {
    await runMutation(() => updateMyBookingBuffer(bufferMin))
  }

  async function onSaveCustom() {
    if (!customForm) return
    await runMutation(async () => {
      const payload = {
        onDate: customForm.date,
        startTime: customForm.startTime,
        endTime: customForm.endTime,
      }
      if (customForm.id) await updateCustomSlot(customForm.id, payload)
      else await createCustomSlot(payload)
      setCustomForm(null)
    })
  }

  async function onSaveBlock() {
    if (!blockForm) return
    await runMutation(async () => {
      const payload = {
        onDate: blockForm.date,
        allDay: blockForm.allDay,
        startTime: blockForm.allDay ? null : blockForm.startTime,
        endTime: blockForm.allDay ? null : blockForm.endTime,
        reason: blockForm.reason,
      }
      if (blockForm.id) await updateBlockedTime(blockForm.id, payload)
      else await createBlockedTime(payload)
      setBlockForm(null)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        subtitle="Set when candidates can book your interview sessions."
        actions={
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            Preview Candidate View
          </Button>
        }
      />

      {boardState.status === 'loading' && !board ? <Skeleton className="h-64" /> : null}
      {boardState.status === 'error' ? <ErrorState body={boardState.error} onRetry={boardState.reload} /> : null}

      {errors.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {board ? (
        <>
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-navy-950">Timezone</h2>
            <p className="mt-1 text-sm text-slate-500">
              Availability times are interpreted in your timezone ({timezoneLabel(board.timezone)}).
            </p>
            <div className="mt-4 max-w-md">
              <SelectInput
                value={board.timezone}
                disabled={saving}
                onChange={(event) => void onTimezoneChange(event.target.value)}
              >
                {timezoneOptions.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </SelectInput>
            </div>
          </Card>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Weekly Availability</h2>
              <p className="text-sm text-slate-500">Enable a day and add one or more time ranges. Times use your timezone.</p>
            </div>
            {board.availability.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                No weekly availability yet. Enable a weekday and add a time range.
              </p>
            ) : null}
            <div className="space-y-3">
              {WEEKDAY_ORDER.map((day) => {
                const ranges = board.availability.filter((item) => item.weekday === day)
                const enabled = ranges.length > 0
                return (
                  <Card key={day} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm font-semibold text-navy-950">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={saving}
                          onChange={(event) => void onToggleDay(day, event.target.checked)}
                        />
                        {WEEKDAY_LABELS[day]}
                      </label>
                      <span className="text-xs text-slate-500">{enabled ? 'Available' : 'Unavailable'}</span>
                    </div>
                    {enabled ? (
                      <div className="mt-3 space-y-2">
                        {ranges.map((range) => (
                          <div key={range.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                            <SelectInput
                              value={range.start_time}
                              disabled={saving}
                              onChange={(event) => void onUpdateRange(range.id, { startTime: event.target.value })}
                            >
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {formatClock(time)}
                                </option>
                              ))}
                            </SelectInput>
                            <SelectInput
                              value={range.end_time}
                              disabled={saving}
                              onChange={(event) => void onUpdateRange(range.id, { endTime: event.target.value })}
                            >
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {formatClock(time)}
                                </option>
                              ))}
                            </SelectInput>
                            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void onRemoveRange(range.id)}>
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => void onAddRange(day)}>
                          Add time
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy-950">Custom Availability</h2>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => setCustomForm(emptyCustomForm())}>
                  Add custom slot
                </Button>
              </div>
              <p className="mt-1 text-sm text-slate-500">One-time windows even when the weekly schedule is closed.</p>
              {board.customSlots.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  No custom slots yet. Add a one-time window for a specific date.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {board.customSlots.map((slot) => (
                    <li key={slot.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                      <p className="font-medium text-navy-950">{formatDateLong(combineIso(slot.on_date))}</p>
                      <p className="text-slate-600">{formatClockRange(slot.start_time, slot.end_time)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => setCustomForm(toCustomForm(slot))}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => void runMutation(() => deleteCustomSlot(slot.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy-950">Blocked Dates</h2>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => setBlockForm(emptyBlockForm())}>
                  Add blocked date/time
                </Button>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Blocked times override recurring availability. Reasons stay private and are never shown to candidates.
              </p>
              {board.blockedTimes.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  No blocked dates yet. Block a full day or a partial time when you cannot take interviews.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {board.blockedTimes.map((item) => (
                    <li key={item.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                      <p className="font-medium text-navy-950">{formatDateLong(combineIso(item.on_date))}</p>
                      <p className="text-slate-600">
                        {item.all_day
                          ? 'All day'
                          : formatClockRange(item.start_time ?? '00:00', item.end_time ?? '23:59')}
                      </p>
                      {item.reason ? (
                        <p className="mt-1 text-xs text-slate-500">Private reason: {item.reason}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => setBlockForm(toBlockForm(item))}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => void runMutation(() => deleteBlockedTime(item.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-navy-950">Booking Buffer</h2>
            <p className="mt-1 text-sm text-slate-500">Buffer time helps prevent back-to-back sessions.</p>
            <div className="mt-4 max-w-md">
              <FieldLabel htmlFor="buffer">Buffer between interviews</FieldLabel>
              <SelectInput
                id="buffer"
                value={String(board.bookingBufferMin)}
                disabled={saving}
                onChange={(event) => void onBufferChange(Number(event.target.value) as BookingBufferMinutes)}
              >
                {BUFFER_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item} minutes
                  </option>
                ))}
              </SelectInput>
            </div>
            <p className="mt-3 text-xs text-slate-500">This value is private and is not shown to candidates.</p>
          </Card>

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
              Local preview from your live windows, blocked times, and mock bookings. Candidate-visible slots will later
              come from the slot-generation RPC. This preview is not stored.
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
          Local preview only. Candidate booking will use generated slots from the database RPC later.
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

      <SlideOver
        title={customForm?.id ? 'Edit custom availability' : 'Add custom availability'}
        open={Boolean(customForm)}
        onClose={() => setCustomForm(null)}
      >
        {customForm ? (
          <div className="grid gap-4">
            <div>
              <FieldLabel htmlFor="custom-date">Date</FieldLabel>
              <TextInput
                id="custom-date"
                type="date"
                value={customForm.date}
                onChange={(event) => setCustomForm({ ...customForm, date: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="custom-start">Start</FieldLabel>
                <SelectInput
                  id="custom-start"
                  value={customForm.startTime}
                  onChange={(event) => setCustomForm({ ...customForm, startTime: event.target.value })}
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {formatClock(time)}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="custom-end">End</FieldLabel>
                <SelectInput
                  id="custom-end"
                  value={customForm.endTime}
                  onChange={(event) => setCustomForm({ ...customForm, endTime: event.target.value })}
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {formatClock(time)}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
            <Button onClick={() => void onSaveCustom()} disabled={saving}>
              {customForm.id ? 'Save custom slot' : 'Add custom slot'}
            </Button>
          </div>
        ) : null}
      </SlideOver>

      <SlideOver
        title={blockForm?.id ? 'Edit blocked date/time' : 'Block date'}
        open={Boolean(blockForm)}
        onClose={() => setBlockForm(null)}
      >
        {blockForm ? (
          <div className="grid gap-4">
            <div>
              <FieldLabel htmlFor="block-date">Date</FieldLabel>
              <TextInput
                id="block-date"
                type="date"
                value={blockForm.date}
                onChange={(event) => setBlockForm({ ...blockForm, date: event.target.value })}
              />
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
                <SelectInput
                  value={blockForm.startTime}
                  onChange={(event) => setBlockForm({ ...blockForm, startTime: event.target.value })}
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {formatClock(time)}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput
                  value={blockForm.endTime}
                  onChange={(event) => setBlockForm({ ...blockForm, endTime: event.target.value })}
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {formatClock(time)}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
            <div>
              <FieldLabel htmlFor="block-reason">Private reason</FieldLabel>
              <TextInput
                id="block-reason"
                value={blockForm.reason}
                onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Candidates never see this reason.</p>
            </div>
            <Button onClick={() => void onSaveBlock()} disabled={saving}>
              {blockForm.id ? 'Save blocked time' : 'Block date'}
            </Button>
          </div>
        ) : null}
      </SlideOver>
    </div>
  )
}

const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => minutesToTime(8 * 60 + index * 30))

function combineIso(ymd: string) {
  return `${ymd}T00:00:00`
}

function toCustomForm(slot: CustomSlotRecord): CustomForm {
  return {
    id: slot.id,
    date: slot.on_date,
    startTime: slot.start_time,
    endTime: slot.end_time,
  }
}

function toBlockForm(item: BlockedTimeRecord): BlockForm {
  return {
    id: item.id,
    date: item.on_date,
    allDay: item.all_day,
    startTime: item.start_time ?? '18:00',
    endTime: item.end_time ?? '21:00',
    reason: item.reason ?? '',
  }
}

function toSchedule(board: AvailabilityBoard, defaultDurationMin: number): AvailabilitySchedule {
  return {
    settings: {
      interviewerId: board.interviewerProfileId,
      timezone: board.timezone,
      defaultDurationMin,
      bufferMin: board.bookingBufferMin,
    },
    recurring: board.availability.map((item) => ({
      id: item.id,
      interviewerId: item.interviewer_profile_id,
      dayOfWeek: item.weekday,
      startTime: item.start_time,
      endTime: item.end_time,
      timezone: board.timezone,
      isActive: true,
      serviceId: null,
    })),
    customSlots: board.customSlots.map((item) => ({
      id: item.id,
      interviewerId: item.interviewer_profile_id,
      date: item.on_date,
      startTime: item.start_time,
      endTime: item.end_time,
      timezone: board.timezone,
      serviceId: null,
    })),
    blockedTimes: board.blockedTimes.map((item) => ({
      id: item.id,
      interviewerId: item.interviewer_profile_id,
      date: item.on_date,
      startTime: item.start_time,
      endTime: item.end_time,
      allDay: item.all_day,
      reason: item.reason ?? '',
      timezone: board.timezone,
    })),
  }
}

function nextRangeForDay(day: Weekday, board: AvailabilityBoard) {
  const existing = board.availability
    .filter((item) => item.weekday === day)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  if (existing.length === 0) return defaultRangeForDay(day)
  const last = existing[existing.length - 1]
  const startMin = timeToMinutes(last.end_time)
  const endMin = startMin + 180
  if (endMin <= 22 * 60) {
    return { startTime: minutesToTime(startMin), endTime: minutesToTime(endMin) }
  }
  return { startTime: '10:00', endTime: '14:00' }
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
