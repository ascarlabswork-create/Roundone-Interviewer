import { TextInput } from './primitives.tsx'

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
  return (
    <TextInput
      id={id}
      type="time"
      step={60}
      value={value.slice(0, 5)}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.target.value
        if (!/^\d{2}:\d{2}$/.test(next)) return
        onChange(next)
      }}
    />
  )
}
