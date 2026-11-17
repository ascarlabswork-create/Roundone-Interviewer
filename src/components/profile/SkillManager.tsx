import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { SKILL_GROUPS, SKILLS } from '../../data/catalogs.ts'
import {
  type InterviewerSkillRecord,
  listInterviewerSkillRows,
  saveInterviewerSkillSet,
} from '../../services/interviewerProfile.ts'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'
import { SuggestionChips } from '../ui/suggestions.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { QuickAdd } from './ExpertiseFields.tsx'

type DraftSkill = { id: string | null; skill: string }

function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

const sameSkill = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function draftFromNames(next: string[], previous: DraftSkill[]): DraftSkill[] {
  return next.map((skill) => {
    const existing = previous.find((item) => sameSkill(item.skill, skill))
    if (existing) return existing
    const canonical = SKILLS.find((item) => sameSkill(item, skill)) ?? skill
    return { id: null, skill: canonical }
  })
}

export function SkillManager({
  interviewerProfileId,
  onChanged,
}: {
  interviewerProfileId: string
  onChanged: () => void | Promise<void>
}) {
  const { pushToast } = useToast()
  const [skills, setSkills] = useState<InterviewerSkillRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DraftSkill[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    listInterviewerSkillRows(interviewerProfileId)
      .then((rows) => {
        if (!cancelled) setSkills(rows)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadError(errorText(caught, 'Could not load your skills.'))
      })
    return () => {
      cancelled = true
    }
  }, [interviewerProfileId])

  if (loadError) return <p className="text-sm text-red-700">{loadError}</p>
  if (!skills) return <Skeleton className="h-24" />

  function startEditing() {
    setDraft((skills ?? []).map((item) => ({ id: item.id, skill: item.skill })))
    setError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setError(null)
  }

  function setDraftFromNames(next: string[]) {
    setError(null)
    setDraft((previous) => draftFromNames(next, previous))
  }

  function addPopularSkill(skill: string) {
    if (saving) return
    setError(null)
    setDraft((current) => {
      if (current.some((item) => sameSkill(item.skill, skill))) return current
      return [...current, { id: null, skill }]
    })
  }

  async function save() {
    const current = skills ?? []
    const removeIds = current.filter((row) => !draft.some((item) => item.id === row.id)).map((row) => row.id)
    const additions = draft.filter((item) => item.id === null).map((item) => item.skill)
    if (removeIds.length === 0 && additions.length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const rows = await saveInterviewerSkillSet(interviewerProfileId, removeIds, additions)
      setSkills(rows)
      setEditing(false)
      await onChanged()
      pushToast('Skills saved')
    } catch (caught) {
      setError(errorText(caught, 'Could not save your skills. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        {skills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No skills yet. Add the skills you can assess — candidates are matched to you on these.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((item) => (
              <span
                key={item.id}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-navy-950"
              >
                {item.skill}
              </span>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={startEditing}>
          <Pencil className="h-4 w-4" aria-hidden />
          {skills.length === 0 ? 'Add skills' : 'Edit skills'}
        </Button>
      </div>
    )
  }

  const names = draft.map((item) => item.skill)
  const dirty =
    draft.some((item) => item.id === null) || skills.some((row) => !draft.some((item) => item.id === row.id))

  return (
    <div className="space-y-4">
      {draft.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No skills selected. Add at least one so candidates can be matched to you.
        </p>
      ) : null}

      <SuggestionChips
        id="skill-add"
        suggestions={SKILLS}
        value={names}
        onChange={(next) => {
          if (!saving) setDraftFromNames(next)
        }}
        placeholder="Type skills, e.g. Python, SQL, Power BI"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Popular with candidates</p>
        <div className="mt-3 grid gap-2.5">
          {SKILL_GROUPS.map((group) => (
            <QuickAdd
              key={group.label}
              label={group.label}
              options={group.skills}
              selected={names}
              onAdd={addPopularSkill}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save skills'}
        </Button>
        <Button variant="outline" disabled={saving} onClick={cancelEditing}>
          Cancel
        </Button>
        {dirty ? <span className="text-sm text-amber-700">You have unsaved skill changes</span> : null}
      </div>
    </div>
  )
}
