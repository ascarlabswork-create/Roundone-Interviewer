import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn.ts'
import { Button } from './Button.tsx'
import { Chip, TextInput } from './primitives.tsx'

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

function matchesQuery(text: string, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  return text.toLowerCase().includes(needle)
}

function labelForValue(options: readonly SuggestionOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function matchOption(options: readonly SuggestionOption[], query: string) {
  const normalized = normalizeLabel(query)
  if (!normalized) return undefined
  const lower = normalized.toLowerCase()
  return options.find((option) => option.value.toLowerCase() === lower || option.label.toLowerCase() === lower)
}

function SuggestionMenu({
  id,
  items,
  highlightIndex,
  onPick,
}: {
  id: string
  items: readonly SuggestionOption[]
  highlightIndex: number
  onPick: (item: SuggestionOption) => void
}) {
  if (items.length === 0) return null

  return (
    <ul
      id={id}
      role="listbox"
      className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
    >
      {items.map((item, index) => {
        const active = index === highlightIndex
        return (
          <li key={item.value} role="presentation">
            <button
              type="button"
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={active}
              className={cn(
                'flex w-full px-3 py-2 text-left text-sm',
                active ? 'bg-slate-100 text-navy-950' : 'text-slate-700 hover:bg-slate-50',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(item)}
            >
              {item.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function useTypeaheadHighlight(itemCount: number) {
  const [highlightIndex, setHighlightIndexState] = useState(-1)
  const highlightRef = useRef(-1)

  function setHighlightIndex(index: number) {
    highlightRef.current = index
    setHighlightIndexState(index)
  }

  useEffect(() => {
    setHighlightIndex(-1)
  }, [itemCount])

  function handleTypeaheadKey(
    event: KeyboardEvent<HTMLInputElement>,
    onPickHighlighted: (index: number) => void,
    onEnter: () => void,
  ) {
    if (event.key === 'ArrowDown') {
      if (itemCount === 0) return
      event.preventDefault()
      const current = highlightRef.current
      setHighlightIndex(current < 0 ? 0 : (current + 1) % itemCount)
      return
    }
    if (event.key === 'ArrowUp') {
      if (itemCount === 0) return
      event.preventDefault()
      const current = highlightRef.current
      setHighlightIndex(current < 0 ? itemCount - 1 : (current - 1 + itemCount) % itemCount)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const current = highlightRef.current
      if (current >= 0 && current < itemCount) {
        onPickHighlighted(current)
        return
      }
      onEnter()
    }
  }

  return { highlightIndex, setHighlightIndex, handleTypeaheadKey }
}

export function SuggestionChips({
  id,
  suggestions,
  value,
  onChange,
  placeholder = 'Type to add',
}: {
  id: string
  suggestions: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const listId = useId()
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [typed, setTyped] = useState(false)
  const selected = uniqueKeepOrder(value)

  const matches = useMemo(() => {
    const query = draft.trim()
    if (!query) return []
    return suggestions
      .filter((item) => !matchExisting(selected, item) && matchesQuery(item, query))
      .map((item) => ({ value: item, label: item }))
  }, [draft, selected, suggestions])

  const { highlightIndex, setHighlightIndex, handleTypeaheadKey } = useTypeaheadHighlight(matches.length)
  const open = focused && typed && !dismissed && matches.length > 0

  function remove(item: string) {
    onChange(selected.filter((entry) => entry !== item))
  }

  function addValue(raw: string) {
    const next = normalizeLabel(raw)
    if (!next) return
    if (matchExisting(selected, next)) {
      setDraft('')
      setTyped(false)
      setDismissed(false)
      setHighlightIndex(-1)
      return
    }
    const canonical = matchExisting(suggestions, next) ?? next
    onChange([...selected, canonical])
    setDraft('')
    setTyped(false)
    setDismissed(false)
    setHighlightIndex(-1)
  }

  function pick(option: SuggestionOption) {
    addValue(option.value)
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <Chip key={item} active onClick={() => remove(item)}>
              <span className="inline-flex items-center gap-1">
                {item}
                <X className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Chip>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <TextInput
            id={id}
            value={draft}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && highlightIndex >= 0 ? `${listId}-option-${highlightIndex}` : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              setTyped(false)
              setDismissed(false)
            }}
            onChange={(event) => {
              setDraft(event.target.value)
              setTyped(true)
              setDismissed(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setDismissed(true)
                setHighlightIndex(-1)
                return
              }
              handleTypeaheadKey(event, (index) => pick(matches[index]), () => addValue(draft))
            }}
          />
          {open ? <SuggestionMenu id={listId} items={matches} highlightIndex={highlightIndex} onPick={pick} /> : null}
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={() => addValue(draft)}>
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
  customPlaceholder = 'Type to search or enter your own',
  required,
}: {
  id: string
  options: readonly SuggestionOption[]
  value: string
  onChange: (next: string) => void
  customPlaceholder?: string
  required?: boolean
}) {
  const listId = useId()
  const committedLabel = labelForValue(options, value)
  const [draft, setDraft] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [typed, setTyped] = useState(false)
  const query = draft ?? committedLabel

  const matches = useMemo(() => {
    if (draft === null) return []
    return options.filter((option) => matchesQuery(option.label, draft) || matchesQuery(option.value, draft))
  }, [draft, options])

  const { highlightIndex, setHighlightIndex, handleTypeaheadKey } = useTypeaheadHighlight(matches.length)
  const open = focused && typed && !dismissed && draft !== null && draft.trim() !== '' && matches.length > 0

  function commit(raw: string) {
    const next = normalizeLabel(raw)
    const matched = matchOption(options, next)
    onChange(matched?.value ?? next)
    setDraft(null)
    setTyped(false)
    setDismissed(false)
    setHighlightIndex(-1)
  }

  function pick(option: SuggestionOption) {
    onChange(option.value)
    setDraft(null)
    setTyped(false)
    setDismissed(false)
    setHighlightIndex(-1)
  }

  return (
    <div className="relative">
      <TextInput
        id={id}
        required={required}
        value={query}
        placeholder={customPlaceholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && highlightIndex >= 0 ? `${listId}-option-${highlightIndex}` : undefined}
        onFocus={() => {
          setFocused(true)
          setTyped(false)
          setDraft(committedLabel)
        }}
        onBlur={() => {
          setFocused(false)
          if (draft !== null) commit(draft)
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          setTyped(true)
          setDismissed(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setDismissed(true)
            setHighlightIndex(-1)
            return
          }
          handleTypeaheadKey(
            event,
            (index) => pick(matches[index]),
            () => commit(draft ?? query),
          )
        }}
      />
      {open ? <SuggestionMenu id={listId} items={matches} highlightIndex={highlightIndex} onPick={pick} /> : null}
    </div>
  )
}
