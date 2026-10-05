import { clock24hFromParts, clockPartsFrom24h, type ClockPeriod } from '../../lib/dates.ts'
import { SelectInput } from './primitives.tsx'

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)

/**
 * 12-hour time entry (hour, minute, AM/PM). Values are stored and sent to the server as 24-hour HH:MM.
 */
export function ClockTimeInput({
  id,
  value,
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: {
  id?: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  'aria-label'?: string
}) {
  const { hour12, minute, period } = clockPartsFrom24h(value)

  function update(patch: Partial<{ hour12: number; minute: number; period: ClockPeriod }>) {
    onChange(
      clock24hFromParts(
        patch.hour12 ?? hour12,
        patch.minute ?? minute,
        patch.period ?? period,
      ),
    )
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      className="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      <SelectInput
        aria-label={ariaLabel ? `${ariaLabel} hour` : 'Hour'}
        disabled={disabled}
        className="h-11 w-[4.25rem] shrink-0 px-2"
        value={String(hour12)}
        onChange={(event) => update({ hour12: Number(event.target.value) })}
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </SelectInput>
      <span className="text-sm font-medium text-slate-500" aria-hidden>
        :
      </span>
      <SelectInput
        aria-label={ariaLabel ? `${ariaLabel} minute` : 'Minute'}
        disabled={disabled}
        className="h-11 w-[4.25rem] shrink-0 px-2"
        value={String(minute)}
        onChange={(event) => update({ minute: Number(event.target.value) })}
      >
        {MINUTES.map((min) => (
          <option key={min} value={min}>
            {String(min).padStart(2, '0')}
          </option>
        ))}
      </SelectInput>
      <SelectInput
        aria-label={ariaLabel ? `${ariaLabel} AM or PM` : 'AM or PM'}
        disabled={disabled}
        className="h-11 w-[4.5rem] shrink-0 px-2"
        value={period}
        onChange={(event) => update({ period: event.target.value as ClockPeriod })}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </SelectInput>
    </div>
  )
}
