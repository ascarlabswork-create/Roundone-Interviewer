import { type FormEvent, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SKILL_GROUPS, SKILLS } from '../../data/catalogs.ts'
import {
  addInterviewerSkill,
  deleteInterviewerSkill,
  type InterviewerSkillRecord,
  listInterviewerSkillRows,
  renameInterviewerSkill,
} from '../../services/interviewerProfile.ts'
import { useToast } from '../../state/toast.tsx'
import { Button } from '../ui/Button.tsx'
import { FieldLabel, Skeleton, TextInput } from '../ui/primitives.tsx'
import { QuickAdd } from './ExpertiseFields.tsx'

function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback
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
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

  async function reload() {
    setSkills(await listInterviewerSkillRows(interviewerProfileId))
    await onChanged()
  }

  async function add(value: string) {
    setAddError(null)
    setBusy(true)
    try {
      const added = await addInterviewerSkill(interviewerProfileId, value)
      setDraft('')
      await reload()
      pushToast(`${added.skill} added`)
    } catch (caught) {
      setAddError(errorText(caught, 'Could not save the skill. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    setEditError(null)
    setBusy(true)
    try {
      const saved = await renameInterviewerSkill(interviewerProfileId, editingId, editValue)
      setEditingId(null)
      await reload()
      pushToast(`Saved as ${saved.skill}`)
    } catch (caught) {
      setEditError(errorText(caught, 'Could not save the skill. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(skill: InterviewerSkillRecord) {
    setBusy(true)
    try {
      await deleteInterviewerSkill(interviewerProfileId, skill.id)
      setConfirmDeleteId(null)
      await reload()
      pushToast(`${skill.skill} removed`)
    } catch (caught) {
      pushToast(errorText(caught, 'Could not delete the skill. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <p className="text-sm text-red-700">{loadError}</p>
  if (!skills) return <Skeleton className="h-24" />

  const names = skills.map((item) => item.skill)

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          void add(draft)
        }}
      >
        <div className="flex-1">
          <FieldLabel htmlFor="skill-add">Add a skill</FieldLabel>
          <TextInput
            id="skill-add"
            list="skill-add-suggestions"
            placeholder="Type a skill, e.g. Python, Power BI, System Design"
            value={draft}
            maxLength={60}
            onChange={(event) => {
              setDraft(event.target.value)
              if (addError) setAddError(null)
            }}
          />
          <datalist id="skill-add-suggestions">
            {SKILLS.filter((item) => !names.some((name) => name.toLowerCase() === item.toLowerCase())).map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <Button type="submit" disabled={busy || !draft.trim()}>
          Add skill
        </Button>
      </form>
      {addError ? <p className="text-sm text-red-700">{addError}</p> : null}

      {skills.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No skills yet. Add the skills you can assess — candidates are matched to you on these.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {skills.map((item) => (
            <li key={item.id} className="px-4 py-3">
              {editingId === item.id ? (
                <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={saveEdit}>
                  <label htmlFor={`skill-edit-${item.id}`} className="sr-only">
                    Edit {item.skill}
                  </label>
                  <TextInput
                    id={`skill-edit-${item.id}`}
                    className="flex-1"
                    value={editValue}
                    maxLength={60}
                    autoFocus
                    onChange={(event) => setEditValue(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={busy || !editValue.trim()}>
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(null)
                        setEditError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {editError ? <p className="text-sm text-red-700 sm:basis-full">{editError}</p> : null}
                </form>
              ) : confirmDeleteId === item.id ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-navy-950">
                    Remove <strong>{item.skill}</strong> from your profile?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove(item)}>
                      Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Keep
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-navy-950">{item.skill}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${item.skill}`}
                      disabled={busy}
                      onClick={() => {
                        setEditingId(item.id)
                        setEditValue(item.skill)
                        setEditError(null)
                        setConfirmDeleteId(null)
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      aria-label={`Delete ${item.skill}`}
                      disabled={busy}
                      onClick={() => {
                        setConfirmDeleteId(item.id)
                        setEditingId(null)
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Popular with candidates</p>
        <div className="mt-3 grid gap-2.5">
          {SKILL_GROUPS.map((group) => (
            <QuickAdd
              key={group.label}
              label={group.label}
              options={group.skills}
              selected={names}
              onAdd={(skill) => {
                if (!busy) void add(skill)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
