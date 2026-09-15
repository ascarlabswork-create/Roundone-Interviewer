import { useState } from 'react'
import { Button } from './Button.tsx'
import { Chip, SelectInput, TextInput } from './primitives.tsx'

const OTHER_VALUE = '__other__'

export type SuggestionOption = {
  value: string
  label: string
}

function uniqueKeepOrder(items: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function matchExisting(list: readonly string[], value: string) {
  const lower = value.toLowerCase()
  return list.find((item) => item.toLowerCase() === lower)
}

export function SuggestionChips({
  id,
  suggestions,
  value,
  onChange,
  placeholder = 'Add your own',
}: {
  id: string
  suggestions: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const shown = uniqueKeepOrder([...suggestions, ...value])

  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter((entry) => entry !== item) : [...value, item])
  }

  function addCustom() {
    const next = normalizeLabel(draft)
    if (!next) return
    const existingSelected = matchExisting(value, next)
    if (existingSelected) {
      setDraft('')
      return
    }
    const existingShown = matchExisting(shown, next)
    onChange([...value, existingShown ?? next])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {shown.map((item) => (
          <Chip key={item} active={value.includes(item)} onClick={() => toggle(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <TextInput
          id={id}
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            addCustom()
          }}
        />
        <Button type="button" variant="outline" className="shrink-0" onClick={addCustom}>
          Add
        </Button>
      </div>
    </div>
  )
}

export function SuggestedSelect({
  id,
  options,
  value,
  onChange,
  customPlaceholder = 'Type your own',
}: {
  id: string
  options: readonly SuggestionOption[]
  value: string
  onChange: (next: string) => void
  customPlaceholder?: string
}) {
  const isKnown = options.some((option) => option.value === value)
  const selectValue = isKnown ? value : OTHER_VALUE

  return (
    <div className="grid gap-2">
      <SelectInput
        id={id}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value
          if (next === OTHER_VALUE) {
            if (isKnown) onChange('')
            return
          }
          onChange(next)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other (type your own)</option>
      </SelectInput>
      {selectValue === OTHER_VALUE ? (
        <TextInput
          id={`${id}-custom`}
          required
          value={value}
          placeholder={customPlaceholder}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  )
}
