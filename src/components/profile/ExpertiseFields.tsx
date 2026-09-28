import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { CANDIDATE_LEVELS, SKILL_GROUPS, SKILLS, TARGET_ROLES } from '../../data/catalogs.ts'
import { SuggestionChips } from '../ui/suggestions.tsx'

export type ExpertiseValue = {
  skills: string[]
  targetRoles: string[]
  candidateLevels: string[]
}

function includesIgnoreCase(list: readonly string[], item: string) {
  const lower = item.toLowerCase()
  return list.some((entry) => entry.toLowerCase() === lower)
}

function QuickAdd({
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
}: {
  idPrefix: string
  value: ExpertiseValue
  onChange: (next: ExpertiseValue) => void
}) {
  const [browseSkills, setBrowseSkills] = useState(true)

  return (
    <div className="grid gap-8">
      <Section
        title="Skills you interview on"
        description="Candidates list skills like these on their profiles and resumes. Add the ones you can assess with confidence."
      >
        <SuggestionChips
          id={`${idPrefix}-skill`}
          suggestions={SKILLS}
          value={value.skills}
          onChange={(skills) => onChange({ ...value, skills })}
          placeholder="Type a skill, e.g. Python, Power BI, System Design"
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Popular with candidates</p>
            <button
              type="button"
              className="text-xs font-medium text-blue-700"
              aria-expanded={browseSkills}
              onClick={() => setBrowseSkills((open) => !open)}
            >
              {browseSkills ? 'Hide' : 'Show'}
            </button>
          </div>
          {browseSkills ? (
            <div className="mt-3 grid gap-2.5">
              {SKILL_GROUPS.map((group) => (
                <QuickAdd
                  key={group.label}
                  label={group.label}
                  options={group.skills}
                  selected={value.skills}
                  onAdd={(skill) => onChange({ ...value, skills: [...value.skills, skill] })}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Roles you interview for" description="Match the roles candidates are preparing for.">
        <SuggestionChips
          id={`${idPrefix}-role`}
          suggestions={TARGET_ROLES}
          value={value.targetRoles}
          onChange={(targetRoles) => onChange({ ...value, targetRoles })}
          placeholder="Type a target role"
        />
        <QuickAdd
          options={TARGET_ROLES}
          selected={value.targetRoles}
          onAdd={(role) => onChange({ ...value, targetRoles: [...value.targetRoles, role] })}
        />
      </Section>

      <Section title="Candidate levels" description="Experience levels you are comfortable interviewing.">
        <SuggestionChips
          id={`${idPrefix}-level`}
          suggestions={CANDIDATE_LEVELS}
          value={value.candidateLevels}
          onChange={(candidateLevels) => onChange({ ...value, candidateLevels })}
          placeholder="Type a candidate level"
        />
        <QuickAdd
          options={CANDIDATE_LEVELS}
          selected={value.candidateLevels}
          onAdd={(level) => onChange({ ...value, candidateLevels: [...value.candidateLevels, level] })}
        />
      </Section>
    </div>
  )
}
