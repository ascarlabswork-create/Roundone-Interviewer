import { Check } from 'lucide-react'
import { EXPERIENCE_LEVELS } from '../../data/catalogs.ts'
import { cn } from '../../lib/cn.ts'

function includesIgnoreCase(list: readonly string[], item: string) {
  const lower = item.toLowerCase()
  return list.some((entry) => entry.toLowerCase() === lower)
}

export function ExperienceLevelPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  function toggle(levelId: string) {
    if (includesIgnoreCase(value, levelId)) {
      onChange(value.filter((item) => item.toLowerCase() !== levelId.toLowerCase()))
      return
    }
    onChange([...value, levelId])
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {EXPERIENCE_LEVELS.map((level) => {
        const selected = includesIgnoreCase(value, level.id)
        return (
          <button
            key={level.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(level.id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition',
              selected
                ? 'border-coral-500 bg-coral-50 shadow-sm shadow-coral-500/10'
                : 'border-navy-950/10 bg-white hover:border-coral-300 hover:bg-coral-50/40',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                selected ? 'border-coral-600 bg-coral-600 text-white' : 'border-slate-300 bg-white text-transparent',
              )}
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-navy-950">{level.label}</span>
              {level.description ? (
                <span className="mt-0.5 block text-xs text-slate-500">{level.description}</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
