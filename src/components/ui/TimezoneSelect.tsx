import { useMemo } from 'react'
import {
  formatTimezoneLabel,
  getTimezoneOptions,
  POPULAR_TIMEZONE_IDS,
} from '../../lib/timezones.ts'
import { SelectInput } from './primitives.tsx'

/** Scrollable dropdown of every supported IANA timezone (common zones listed first). */
export function TimezoneSelect({
  id,
  value,
  onChange,
  disabled,
  required,
  className,
}: {
  id?: string
  value: string
  onChange: (timezone: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
}) {
  const { popular, rest, known } = useMemo(() => {
    const options = getTimezoneOptions()
    const popularSet = new Set<string>(POPULAR_TIMEZONE_IDS)
    const popularOptions = options.filter((zone) => popularSet.has(zone.id))
    const restOptions = options.filter((zone) => !popularSet.has(zone.id))
    return {
      popular: popularOptions,
      rest: restOptions,
      known: new Set(options.map((zone) => zone.id)),
    }
  }, [])

  return (
    <SelectInput
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      className={className}
      onChange={(event) => onChange(event.target.value)}
    >
      {!known.has(value) && value ? (
        <option value={value}>{formatTimezoneLabel(value)}</option>
      ) : null}
      <optgroup label="Common time zones">
        {popular.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="All time zones">
        {rest.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.label}
          </option>
        ))}
      </optgroup>
    </SelectInput>
  )
}
