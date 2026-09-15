import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Stepper } from '../components/ui/dashboard.tsx'
import { Card, Chip, FieldLabel, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { SuggestedSelect, SuggestionChips } from '../components/ui/suggestions.tsx'
import {
  CANDIDATE_LEVELS,
  INDUSTRIES,
  INTERVIEW_TYPES,
  ONBOARDING_STEPS,
  SKILLS,
  TARGET_ROLES,
  TECHNOLOGIES,
  TIMEZONES,
} from '../data/catalogs.ts'
import { updateInterviewerProfile, updateInterviewerRoles, updateInterviewerSkills } from '../services/interviewerProfile.ts'
import { useOnboarding } from '../state/onboarding.tsx'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

const stepIndex: Record<string, number> = {
  professional: 1,
  expertise: 2,
  services: 3,
  availability: 4,
  review: 5,
}

const order = ['professional', 'expertise', 'services', 'availability', 'review'] as const

function toggleValue<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function SetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { draft, update } = useOnboarding()
  const { account, refreshAccount } = useSession()
  const { pushToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const step = params.get('step') ?? 'professional'
  const current = stepIndex[step] ?? 1

  useEffect(() => {
    if (!account || hydrated) return
    const [firstName, ...rest] = account.profile.full_name.split(' ')
    update({
      firstName: firstName || '',
      lastName: rest.join(' '),
      fullName: account.profile.full_name,
      email: account.email,
      company: account.interviewer.company === 'Pending' ? '' : account.interviewer.company,
      role: account.interviewer.current_role === 'Pending' ? '' : account.interviewer.current_role,
      experienceYears: String(account.interviewer.experience_years || ''),
      professionalSummary: account.interviewer.bio || account.interviewer.headline || '',
      timezone: account.profile.timezone,
      languages: account.interviewer.languages.join(', '),
      phone: account.phone,
      skills: account.skills,
      targetRoles: account.targetRoles,
      candidateLevels: account.candidateLevels,
    })
    setHydrated(true)
  }, [account, hydrated, update])

  function go(next: (typeof order)[number]) {
    navigate(`/interviewer/setup?step=${next}`)
  }

  async function persistCurrentStep() {
    if (step === 'professional') {
      await updateInterviewerProfile({
        fullName: `${draft.firstName} ${draft.lastName}`.trim() || draft.fullName,
        timezone: draft.timezone,
        headline: draft.role,
        bio: draft.professionalSummary,
        currentRole: draft.role,
        company: draft.company,
        experienceYears: Number(draft.experienceYears) || 0,
        phone: draft.phone,
        languages: draft.languages
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
    }
    if (step === 'expertise') {
      await updateInterviewerSkills(draft.skills)
      await updateInterviewerRoles({
        targetRoles: draft.targetRoles,
        candidateLevels: draft.candidateLevels,
      })
    }
    await refreshAccount()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await persistCurrentStep()
      if (step === 'professional' || step === 'expertise') {
        pushToast('Saved successfully')
      }
      const index = order.indexOf(step as (typeof order)[number])
      if (index < order.length - 1) go(order[index + 1])
      else navigate('/interviewer/verification')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Stepper steps={[...ONBOARDING_STEPS]} current={current} />
      <h1 className="mt-8 text-2xl font-semibold text-navy-950">Build your interviewer profile</h1>
      <p className="mt-2 text-sm text-slate-600">This is how candidates will understand your practice.</p>

      <Card className="mt-8 p-6">
        <form className="grid gap-5" onSubmit={onSubmit}>
          {step === 'professional' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="firstName">First name</FieldLabel>
                  <TextInput
                    id="firstName"
                    required
                    value={draft.firstName}
                    onChange={(event) => update({ firstName: event.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                  <TextInput
                    id="lastName"
                    required
                    value={draft.lastName}
                    onChange={(event) => update({ lastName: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                  <SuggestedSelect
                    id="timezone"
                    options={TIMEZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
                    value={draft.timezone}
                    onChange={(timezone) => update({ timezone })}
                    customPlaceholder="Type a timezone, e.g. Europe/Berlin"
                    required
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="phone">Phone (optional)</FieldLabel>
                  <TextInput
                    id="phone"
                    type="tel"
                    value={draft.phone}
                    onChange={(event) => update({ phone: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="summary">Professional Summary</FieldLabel>
                <TextArea
                  id="summary"
                  required
                  value={draft.professionalSummary}
                  onChange={(event) => update({ professionalSummary: event.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="role">Current Role</FieldLabel>
                  <TextInput id="role" value={draft.role} onChange={(event) => update({ role: event.target.value })} />
                </div>
                <div>
                  <FieldLabel htmlFor="company">Current Company</FieldLabel>
                  <TextInput
                    id="company"
                    value={draft.company}
                    onChange={(event) => update({ company: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="yoe">Years of Experience</FieldLabel>
                <TextInput
                  id="yoe"
                  type="number"
                  value={draft.experienceYears}
                  onChange={(event) => update({ experienceYears: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="languages">Languages</FieldLabel>
                <TextInput
                  id="languages"
                  placeholder="English, Hindi"
                  value={draft.languages}
                  onChange={(event) => update({ languages: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="prev">Previous Companies</FieldLabel>
                <TextInput
                  id="prev"
                  value={draft.previousCompanies}
                  onChange={(event) => update({ previousCompanies: event.target.value })}
                />
              </div>
            </>
          ) : null}

          {step === 'expertise' ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Skills</legend>
                <SuggestionChips
                  id="setup-skill"
                  suggestions={SKILLS}
                  value={draft.skills}
                  onChange={(skills) => update({ skills })}
                  placeholder="Type to add a skill"
                />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Technologies</legend>
                <SuggestionChips
                  id="setup-tech"
                  suggestions={TECHNOLOGIES}
                  value={draft.technologies}
                  onChange={(technologies) => update({ technologies })}
                  placeholder="Type to add a technology"
                />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Industries</legend>
                <SuggestionChips
                  id="setup-industry"
                  suggestions={INDUSTRIES}
                  value={draft.industries}
                  onChange={(industries) => update({ industries })}
                  placeholder="Type to add an industry"
                />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Interview expertise</legend>
                <SuggestionChips
                  id="setup-interview-type"
                  suggestions={INTERVIEW_TYPES}
                  value={draft.interviewTypes}
                  onChange={(interviewTypes) => update({ interviewTypes })}
                  placeholder="Type to add an interview type"
                />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Candidate levels</legend>
                <SuggestionChips
                  id="setup-level"
                  suggestions={CANDIDATE_LEVELS}
                  value={draft.candidateLevels}
                  onChange={(candidateLevels) => update({ candidateLevels })}
                  placeholder="Type to add a candidate level"
                />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Target roles</legend>
                <SuggestionChips
                  id="setup-role"
                  suggestions={TARGET_ROLES}
                  value={draft.targetRoles}
                  onChange={(targetRoles) => update({ targetRoles })}
                  placeholder="Type to add a target role"
                />
              </fieldset>
            </>
          ) : null}

          {step === 'services' ? (
            <>
              <div>
                <FieldLabel htmlFor="sname">Service Name</FieldLabel>
                <TextInput
                  id="sname"
                  value={draft.firstService.name}
                  onChange={(event) => update({ firstService: { ...draft.firstService, name: event.target.value } })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="stype">Interview Type</FieldLabel>
                  <SuggestedSelect
                    id="stype"
                    options={INTERVIEW_TYPES.map((item) => ({ value: item, label: item }))}
                    value={draft.firstService.interviewType}
                    onChange={(interviewType) =>
                      update({ firstService: { ...draft.firstService, interviewType } })
                    }
                    customPlaceholder="Type an interview type"
                    required
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="sdur">Duration (minutes)</FieldLabel>
                  <TextInput
                    id="sdur"
                    value={draft.firstService.durationMin}
                    onChange={(event) => update({ firstService: { ...draft.firstService, durationMin: event.target.value } })}
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="sprice">Price (INR)</FieldLabel>
                <TextInput
                  id="sprice"
                  value={draft.firstService.price}
                  onChange={(event) => update({ firstService: { ...draft.firstService, price: event.target.value } })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="sdesc">Description</FieldLabel>
                <TextArea
                  id="sdesc"
                  value={draft.firstService.description}
                  onChange={(event) => update({ firstService: { ...draft.firstService, description: event.target.value } })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="spolicy">Cancellation Policy</FieldLabel>
                <TextArea
                  id="spolicy"
                  value={draft.firstService.cancellationPolicy}
                  onChange={(event) =>
                    update({ firstService: { ...draft.firstService, cancellationPolicy: event.target.value } })
                  }
                />
              </div>
            </>
          ) : null}

          {step === 'availability' ? (
            <>
              <p className="text-sm text-slate-600">Timezone: India Standard Time</p>
              <p className="text-sm font-medium text-navy-950">Saturday evening example</p>
              <div className="flex flex-wrap gap-2">
                {['18:00', '19:00', '20:00'].map((hour) => (
                  <Chip
                    key={hour}
                    active={draft.saturdayHours.includes(hour)}
                    onClick={() => update({ saturdayHours: toggleValue(draft.saturdayHours, hour) })}
                  >
                    Saturday {hour === '18:00' ? '6 PM' : hour === '19:00' ? '7 PM' : '8 PM'}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-slate-500">You can refine week and month views after you join the dashboard.</p>
            </>
          ) : null}

          {step === 'review' ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <strong>{draft.fullName}</strong> · {draft.role} @ {draft.company}
              </p>
              <p>{draft.experienceYears} years · {draft.interviewTypes.join(', ')}</p>
              <p>Levels: {draft.candidateLevels.join(', ')}</p>
              <p>
                First service: {draft.firstService.name} · {draft.firstService.durationMin} min · ₹
                {draft.firstService.price}
              </p>
              <p>Saturday slots: {draft.saturdayHours.join(', ') || 'None selected'}</p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const index = order.indexOf(step as (typeof order)[number])
                if (index <= 0) navigate('/interviewer/dashboard')
                else go(order[index - 1])
              }}
            >
              Back
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : step === 'review' ? 'Continue to verification' : 'Save & Continue'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
