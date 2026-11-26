import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { QUICK_ROLES, QUICK_SKILLS, SKILLS, TARGET_ROLES } from '../../data/catalogs.ts'
import { RoleSuggestInput } from '../ui/RoleSuggestInput.tsx'
import { SuggestionChips } from '../ui/suggestions.tsx'
import { Button } from '../ui/Button.tsx'

export type ExpertiseValue = {
  skills: string[]
  targetRoles: string[]
  candidateLevels: string[]
}

function includesIgnoreCase(list: readonly string[], item: string) {
  const lower = item.toLowerCase()
  return list.some((entry) => entry.toLowerCase() === lower)
}

export function QuickAdd({
  label,
  options,
  selected,
  onAdd,
}: {
  label?: string
  options: readonly string[]
  selected: string[]
  onAdd: (item: string) => void
}) {
  const available = options.filter((item) => !includesIgnoreCase(selected, item))
  if (available.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label ? <span className="mr-1 text-xs font-medium text-slate-500">{label}</span> : null}
      {available.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onAdd(item)}
          aria-label={`Add ${item}`}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-navy-700 hover:text-navy-900"
        >
          <Plus className="h-3 w-3" aria-hidden />
          {item}
        </button>
      ))}
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-navy-950">{title}</legend>
      <p className="-mt-2 text-xs text-slate-500">{description}</p>
      {children}
    </fieldset>
  )
}

export function ExpertiseFields({
  idPrefix,
  value,
  onChange,
  showSkills = true,
}: {
  idPrefix: string
  value: ExpertiseValue
  onChange: (next: ExpertiseValue) => void
  showSkills?: boolean
}) {
  const [roleDraft, setRoleDraft] = useState('')

  function addRole(role: string) {
    const next = role.trim().replace(/\s+/g, ' ')
    if (next.length < 2 || includesIgnoreCase(value.targetRoles, next)) return
    onChange({ ...value, targetRoles: [...value.targetRoles, next] })
    setRoleDraft('')
  }

  return (
    <div className="grid gap-8">
      {showSkills ? (
        <Section
          title="Skills you interview on"
          description="Candidates list skills like these on their profiles and resumes. Add the ones you can assess with confidence."
        >
          <SuggestionChips
            id={`${idPrefix}-skill`}
            suggestions={SKILLS}
            value={value.skills}
            onChange={(skills) => onChange({ ...value, skills })}
            placeholder="Type skills, e.g. Python, SQL, Power BI"
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested skills</p>
            <div className="mt-2">
              <QuickAdd
                options={QUICK_SKILLS}
                selected={value.skills}
                onAdd={(skill) => onChange({ ...value, skills: [...value.skills, skill] })}
              />
            </div>
          </div>
        </Section>
      ) : null}

      <Section title="Roles you interview for" description="Match the roles candidates are preparing for. Pick one or more.">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <RoleSuggestInput
              id={`${idPrefix}-role`}
              value={roleDraft}
              exclude={value.targetRoles}
              options={TARGET_ROLES}
              placeholder="Software Engineer, ML Engineer…"
              onChange={setRoleDraft}
              onCommit={addRole}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={!roleDraft.trim()}
              className="shrink-0 border border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-600/25 hover:border-sky-700 hover:bg-sky-700 disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              onClick={() => addRole(roleDraft)}
            >
              Add
            </Button>
          </div>
        </div>

        {value.targetRoles.length > 0 ? (
          <div className="rounded-2xl border border-navy-950/8 bg-slate-50/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your roles</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {value.targetRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-label={`Remove ${role}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      targetRoles: value.targetRoles.filter((item) => item.toLowerCase() !== role.toLowerCase()),
                    })
                  }
                  className="inline-flex h-7 max-w-full items-center gap-1 truncate rounded-full bg-navy-950 px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-navy-800"
                >
                  {role} ×
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested roles</p>
          <div className="mt-2">
            <QuickAdd
              options={QUICK_ROLES}
              selected={value.targetRoles}
              onAdd={(role) => onChange({ ...value, targetRoles: [...value.targetRoles, role] })}
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
