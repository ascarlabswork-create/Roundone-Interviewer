import { type FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ExpertiseFields, type ExpertiseValue } from '../components/profile/ExpertiseFields.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { CANDIDATE_LEVELS, INTERVIEW_TYPES } from '../data/catalogs.ts'
import { needsInterviewWelcome, welcomeBio, welcomeHeadline } from '../lib/interviewWelcome.ts'
import { detectBrowserTimezone } from '../lib/timezones.ts'
import {
  updateInterviewerProfile,
  updateInterviewerRoles,
  updateInterviewerSkills,
} from '../services/interviewerProfile.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

const emptyExpertise = (): ExpertiseValue => ({ skills: [], targetRoles: [], candidateLevels: [] })

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

export function WelcomePage() {
  const navigate = useNavigate()
  const { account, refreshAccount } = useSession()
  const { pushToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [years, setYears] = useState('')
  const [interviewTypes, setInterviewTypes] = useState<string[]>([])
  const [expertise, setExpertise] = useState<ExpertiseValue>(emptyExpertise)
  const [note, setNote] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!account || hydrated) return
    const job = account.interviewer
    const pending = job.current_role === 'Pending' && job.company === 'Pending'
    setFullName(account.profile.full_name.trim())
    setRole(pending ? '' : job.current_role)
    setCompany(pending ? '' : job.company)
    setYears(job.experience_years > 0 ? String(job.experience_years) : '')
    setExpertise({
      skills: account.skills,
      targetRoles: account.targetRoles,
      candidateLevels: account.candidateLevels,
    })
    const savedBio = job.bio?.trim() ?? ''
    setNote(savedBio.startsWith('I interview candidates on ') ? '' : savedBio)
    setHydrated(true)
  }, [account, hydrated])

  if (account && !needsInterviewWelcome(account)) {
    return <Navigate to="/interviewer/dashboard" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!account) return
    setError(null)
    const currentRole = role.trim()
    const currentCompany = company.trim()
    const experience = Number(years)
    if (!currentRole || !currentCompany) {
      setError('Add your current role and company so candidates know who is interviewing them.')
      return
    }
    if (!Number.isFinite(experience) || experience < 0 || experience > 60) {
      setError('Enter years of experience as a number from 0 to 60.')
      return
    }
    if (interviewTypes.length === 0) {
      setError('Choose at least one kind of interview you want to run.')
      return
    }
    if (expertise.skills.length === 0) {
      setError('Add at least one skill you can assess.')
      return
    }
    if (expertise.targetRoles.length === 0) {
      setError('Add at least one role you interview for.')
      return
    }
    if (expertise.candidateLevels.length === 0) {
      setError('Choose the seniority levels you interview.')
      return
    }

    setSaving(true)
    try {
      const name = fullName.trim() || account.profile.full_name.trim()
      await updateInterviewerProfile({
        fullName: name || undefined,
        timezone: account.profile.timezone.trim() || detectBrowserTimezone(),
        currentRole,
        company: currentCompany,
        experienceYears: Math.round(experience),
        headline: welcomeHeadline(currentRole, interviewTypes, account.interviewer.headline),
        bio: welcomeBio(interviewTypes, note),
      })
      await Promise.all([
        updateInterviewerSkills(expertise.skills),
        updateInterviewerRoles({
          targetRoles: expertise.targetRoles,
          candidateLevels: expertise.candidateLevels,
        }),
      ])
      await refreshAccount()
      pushToast('Your interviewer profile is ready')
      navigate('/interviewer/dashboard')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your interviewer profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Before your dashboard</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">What will you interview?</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Candidates are matched to you from this. Tell us the work you do, the interviews you came to run, and the
        skills and roles you can assess. You can change it later from your profile.
      </p>

      <Card className="mt-8 p-6 sm:p-8">
        <form className="grid gap-8" onSubmit={onSubmit}>
          {!account?.profile.full_name.trim() ? (
            <div>
              <FieldLabel htmlFor="welcome-name">Your name</FieldLabel>
              <TextInput
                id="welcome-name"
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          ) : null}

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="col-span-full text-sm font-semibold text-navy-950">Your background</legend>
            <div>
              <FieldLabel htmlFor="welcome-role">Current role</FieldLabel>
              <TextInput
                id="welcome-role"
                required
                autoComplete="organization-title"
                placeholder="Staff Engineer"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="welcome-company">Current company</FieldLabel>
              <TextInput
                id="welcome-company"
                required
                autoComplete="organization"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="welcome-years">Years of experience</FieldLabel>
              <TextInput
                id="welcome-years"
                type="number"
                required
                min={0}
                max={60}
                step={1}
                value={years}
                onChange={(event) => setYears(event.target.value)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-navy-950">Interviews you came to run</legend>
            <p className="mt-1 text-xs text-slate-500">Pick every format you are ready to conduct.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTERVIEW_TYPES.map((item) => {
                const selected = interviewTypes.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setInterviewTypes((current) => toggle(current, item))}
                    className={
                      selected
                        ? 'rounded-full bg-navy-950 px-3 py-1.5 text-sm text-white'
                        : 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-navy-700'
                    }
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <ExpertiseFields idPrefix="welcome" value={expertise} onChange={setExpertise} />

          <fieldset>
            <legend className="text-sm font-semibold text-navy-950">Seniority you interview</legend>
            <p className="mt-1 text-xs text-slate-500">Candidates book the level they are preparing for.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CANDIDATE_LEVELS.map((item) => {
                const selected = expertise.candidateLevels.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setExpertise((current) => ({ ...current, candidateLevels: toggle(current.candidateLevels, item) }))
                    }
                    className={
                      selected
                        ? 'rounded-full bg-navy-950 px-3 py-1.5 text-sm text-white'
                        : 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-navy-700'
                    }
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div>
            <FieldLabel htmlFor="welcome-note">What candidates should know (optional)</FieldLabel>
            <TextArea
              id="welcome-note"
              placeholder="I run hiring loops for backend and system design, mostly for mid-level and senior candidates."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !account}>
              {saving ? 'Saving…' : 'Save and open dashboard'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
