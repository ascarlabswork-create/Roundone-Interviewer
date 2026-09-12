import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAvailability, listInterviewerReviews, listServices } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Avatar, StarRating, VerifiedBadge } from '../components/ui/identity.tsx'
import { Badge, Card, Chip, EmptyState, ErrorState, FieldLabel, PageHeader, SelectInput, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { CANDIDATE_LEVELS, REVIEW_DIMENSIONS, SKILLS, TARGET_ROLES, TIMEZONES } from '../data/catalogs.ts'
import { currentInterviewer } from '../data/interviewer.ts'
import { formatReviewDate, formatTime, timezoneLabel } from '../lib/dates.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  profileCompleteness,
  updateInterviewerProfile,
  updateInterviewerRoles,
  updateInterviewerSkills,
} from '../services/interviewerProfile.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

function toggleValue<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function ProfilePage() {
  const { account, error, refreshAccount, status } = useSession()
  const { pushToast } = useToast()
  const reviewsState = useAsync(() => listInterviewerReviews(currentInterviewer.id), [])
  const availState = useAsync(() => listAvailability(), [])
  const servicesState = useAsync(() => listServices(), [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    avatarUrl: '',
    timezone: 'Asia/Kolkata',
    headline: '',
    bio: '',
    currentRole: '',
    company: '',
    experienceYears: '',
    languages: '',
    linkedin: '',
    skills: [] as string[],
    targetRoles: [] as string[],
    candidateLevels: [] as string[],
  })

  useEffect(() => {
    if (!account) return
    setForm({
      fullName: account.profile.full_name,
      avatarUrl: account.profile.avatar_url ?? '',
      timezone: account.profile.timezone,
      headline: account.interviewer.headline ?? '',
      bio: account.interviewer.bio ?? '',
      currentRole: account.interviewer.current_role === 'Pending' ? '' : account.interviewer.current_role,
      company: account.interviewer.company === 'Pending' ? '' : account.interviewer.company,
      experienceYears: String(account.interviewer.experience_years || ''),
      languages: account.interviewer.languages.join(', '),
      linkedin: account.linkedin,
      skills: account.skills,
      targetRoles: account.targetRoles,
      candidateLevels: account.candidateLevels,
    })
  }, [account])

  if (status === 'loading') return <Skeleton className="h-96" />
  if (!account) {
    return <ErrorState title="Could not load profile" body={error ?? 'Your interviewer profile is not ready yet.'} onRetry={() => void refreshAccount()} />
  }

  const slots = availState.status === 'success' ? availState.data.filter((item) => item.state === 'available').slice(0, 6) : []
  const allReviews = reviewsState.status === 'success' ? reviewsState.data : []
  const reviews = allReviews.slice(0, 3)
  const services = servicesState.status === 'success' ? servicesState.data.filter((item) => item.isActive) : []
  const identityVerified = account.verifications.some((item) => item.kind === 'identity' && item.status === 'verified')
  const employmentVerified = account.verifications.some((item) => item.kind === 'employment' && item.status === 'verified')
  const verified = identityVerified && employmentVerified
  const completeness = profileCompleteness(account)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    setSaving(true)
    try {
      await updateInterviewerProfile({
        fullName: form.fullName,
        avatarUrl: form.avatarUrl.trim() || null,
        timezone: form.timezone,
        headline: form.headline,
        bio: form.bio,
        currentRole: form.currentRole,
        company: form.company,
        experienceYears: Number(form.experienceYears) || 0,
        languages: form.languages
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        linkedin: form.linkedin,
      })
      await updateInterviewerSkills(form.skills)
      await updateInterviewerRoles({
        targetRoles: form.targetRoles,
        candidateLevels: form.candidateLevels,
      })
      await refreshAccount()
      pushToast('Saved successfully')
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Public Profile"
        subtitle="This is how candidates see you. It is not your private dashboard."
        actions={
          <Link to="/interviewer/setup?step=professional">
            <Button variant="outline">Open setup</Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-navy-950">Profile completeness</p>
          <p className="text-sm font-semibold text-navy-950">{completeness}%</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completeness}%` }} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Avatar src={account.profile.avatar_url ?? ''} name={account.profile.full_name} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-navy-950">{account.profile.full_name}</h2>
              {verified ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-1 text-slate-600">
              {account.interviewer.current_role} @ {account.interviewer.company}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {account.interviewer.experience_years}+ years experience · {timezoneLabel(account.profile.timezone)}
            </p>
            {account.linkedin ? (
              <p className="mt-2 text-sm">
                <a className="font-medium text-blue-700" href={account.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              </p>
            ) : null}
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              {account.interviewer.bio || account.interviewer.headline || 'Add a bio so candidates understand your practice.'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-navy-950">Edit your profile</h3>
        <p className="mt-1 text-sm text-slate-500">Changes save to your RoundOne interviewer profile.</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
          <div>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <TextInput id="fullName" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
            <SelectInput id="timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>
              {TIMEZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="avatar">Avatar URL</FieldLabel>
            <TextInput
              id="avatar"
              value={form.avatarUrl}
              onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="currentRole">Current role</FieldLabel>
            <TextInput id="currentRole" value={form.currentRole} onChange={(event) => setForm({ ...form, currentRole: event.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="company">Current company</FieldLabel>
            <TextInput id="company" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="yoe">Years of experience</FieldLabel>
            <TextInput
              id="yoe"
              type="number"
              min={0}
              value={form.experienceYears}
              onChange={(event) => setForm({ ...form, experienceYears: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="languages">Languages</FieldLabel>
            <TextInput
              id="languages"
              placeholder="English, Hindi"
              value={form.languages}
              onChange={(event) => setForm({ ...form, languages: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="headline">Headline</FieldLabel>
            <TextInput id="headline" value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="bio">Bio</FieldLabel>
            <TextArea id="bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="linkedin">LinkedIn URL</FieldLabel>
            <TextInput id="linkedin" value={form.linkedin} onChange={(event) => setForm({ ...form, linkedin: event.target.value })} />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-slate-800">Skills</legend>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((item) => (
                <Chip key={item} active={form.skills.includes(item)} onClick={() => setForm({ ...form, skills: toggleValue(form.skills, item) })}>
                  {item}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-slate-800">Target roles</legend>
            <div className="flex flex-wrap gap-2">
              {TARGET_ROLES.map((item) => (
                <Chip
                  key={item}
                  active={form.targetRoles.includes(item)}
                  onClick={() => setForm({ ...form, targetRoles: toggleValue(form.targetRoles, item) })}
                >
                  {item}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-slate-800">Candidate levels</legend>
            <div className="flex flex-wrap gap-2">
              {CANDIDATE_LEVELS.map((item) => (
                <Chip
                  key={item}
                  active={form.candidateLevels.includes(item)}
                  onClick={() => setForm({ ...form, candidateLevels: toggleValue(form.candidateLevels, item) })}
                >
                  {item}
                </Chip>
              ))}
            </div>
          </fieldset>
          {saveError ? <p className="sm:col-span-2 text-sm text-red-700">{saveError}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold text-navy-950">Expertise</h3>
          {account.skills.length === 0 ? (
            <EmptyState title="No skills yet" body="Select the skills you interview on so candidates can find you." />
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {account.skills.map((item) => (
                <Badge key={item} tone="blue">
                  {item}
                </Badge>
              ))}
            </div>
          )}
          <h3 className="mt-5 font-semibold text-navy-950">Target roles</h3>
          {account.targetRoles.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No target roles selected.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {account.targetRoles.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          )}
          <h3 className="mt-5 font-semibold text-navy-950">Candidate levels</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {account.candidateLevels.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-navy-950">Candidate-visible slots</h3>
          <p className="mt-1 text-sm text-slate-500">
            Generated from your availability. Candidates cannot pick a time outside these slots.
          </p>
          {slots.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No upcoming bookable slots.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {slots.map((slot) => (
                <li key={slot.id}>
                  {formatTime(slot.start)} {timezoneLabel(account.profile.timezone)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-navy-950">Services & pricing</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {services.map((service) => (
            <div key={service.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <p className="font-medium text-navy-950">{service.name}</p>
                <p className="font-semibold text-navy-950">{formatINR(service.price)}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {service.durationMin} minutes · {service.interviewType}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-navy-950">Reviews & Reputation</h3>
          <VisibilityLabel visibility="public" topic="Candidate Review" />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Only public candidate reviews appear here. Private performance scores are never shown on this profile.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <span>{currentInterviewer.rating} / 5 overall</span>
          <span>{formatCount(currentInterviewer.reviewCount)} reviews</span>
          <span>{formatCount(currentInterviewer.completedInterviews)} interviews completed</span>
        </div>
        <div className="mt-5 space-y-3">
          {REVIEW_DIMENSIONS.map((item) => {
            const value =
              allReviews.length > 0
                ? allReviews.reduce((sum, review) => sum + review.dimensions[item.key], 0) / allReviews.length
                : 0
            return (
              <div key={item.key}>
                <div className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium text-navy-950">{value ? value.toFixed(1) : '—'}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-50">
                  <div className="h-2 rounded-full bg-navy-950" style={{ width: `${(value / 5) * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-6 space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-navy-950">{review.publicDisplayName}</p>
                <StarRating value={review.rating} />
              </div>
              <p className="mt-2 text-sm text-slate-600">“{review.text}”</p>
              <p className="mt-2 text-xs text-slate-500">{formatReviewDate(review.date)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
