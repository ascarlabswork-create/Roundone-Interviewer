import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { CandidatePreviewCard } from '../components/profile/CandidatePreviewCard.tsx'
import { ExpertiseFields, type ExpertiseValue } from '../components/profile/ExpertiseFields.tsx'
import { ReadinessCard } from '../components/profile/ReadinessCard.tsx'
import { SkillManager } from '../components/profile/SkillManager.tsx'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { StarRating } from '../components/ui/identity.tsx'
import { Badge, Card, ErrorState, FieldLabel, PageHeader, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { REVIEW_DIMENSIONS } from '../data/catalogs.ts'
import { DetectedTimezoneNote } from '../components/ui/TimezoneSelect.tsx'
import { cn } from '../lib/cn.ts'
import { formatReviewDate, timezoneLabel } from '../lib/dates.ts'
import { effectiveSchedulingTimezone } from '../lib/timezones.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { loadMyAvailabilityBoard } from '../services/interviewerAvailability.ts'
import { getMyBookings } from '../services/interviewerBookings.ts'
import {
  type InterviewerAccount,
  profileChecklist,
  profileCompleteness,
  updateInterviewerProfile,
  updateInterviewerRoles,
} from '../services/interviewerProfile.ts'
import { loadMyPublicReviewSummary, listMyPublicReviews } from '../services/interviewerReviews.ts'
import { getMyServices, paiseToRupees } from '../services/interviewerServices.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-slate-100 pb-4">
      <h2 className="text-lg font-semibold text-navy-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

type ProfileForm = {
  fullName: string
  timezone: string
  headline: string
  bio: string
  currentRole: string
  company: string
  experienceYears: string
  languages: string
}

const EMPTY_FORM: ProfileForm = {
  fullName: '',
  timezone: 'Asia/Kolkata',
  headline: '',
  bio: '',
  currentRole: '',
  company: '',
  experienceYears: '',
  languages: '',
}

function formFromAccount(account: InterviewerAccount): ProfileForm {
  return {
    fullName: account.profile.full_name,
    timezone: effectiveSchedulingTimezone(account.profile.timezone, account.interviewer.timezone),
    headline: account.interviewer.headline ?? '',
    bio: account.interviewer.bio ?? '',
    currentRole: account.interviewer.current_role === 'Pending' ? '' : account.interviewer.current_role,
    company: account.interviewer.company === 'Pending' ? '' : account.interviewer.company,
    experienceYears: String(account.interviewer.experience_years || ''),
    languages: account.interviewer.languages.join(', '),
  }
}

function expertiseFromAccount(account: InterviewerAccount): ExpertiseValue {
  return {
    skills: account.skills,
    targetRoles: account.targetRoles,
    candidateLevels: account.candidateLevels,
  }
}

export function ProfilePage() {
  const { account, error, refreshAccount, status } = useSession()
  const { pushToast } = useToast()
  const reviewsState = useAsync(() => listMyPublicReviews(), [])
  const summaryState = useAsync(() => loadMyPublicReviewSummary(), [])
  const availState = useAsync(() => loadMyAvailabilityBoard(), [])
  const servicesState = useAsync(() => getMyServices(), [])
  const bookingsState = useAsync(() => getMyBookings(), [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [expertise, setExpertise] = useState<ExpertiseValue>({ skills: [], targetRoles: [], candidateLevels: [] })

  useEffect(() => {
    if (!account) return
    setForm(formFromAccount(account))
    setExpertise(expertiseFromAccount(account))
  }, [account])

  if (status === 'loading') return <Skeleton className="h-96" />
  if (!account) {
    return (
      <ErrorState
        title="Could not load profile"
        body={error ?? 'Your interviewer profile is not ready yet.'}
        onRetry={() => void refreshAccount()}
      />
    )
  }

  const slots =
    availState.status === 'success' && availState.data.availability.length > 0
      ? availState.data.availability.slice(0, 6).map((item) => ({
          id: item.id,
          label: `${item.start_time.slice(0, 5)}–${item.end_time.slice(0, 5)}`,
        }))
      : []
  const allReviews = reviewsState.status === 'success' ? reviewsState.data : []
  const reviews = allReviews.slice(0, 3)
  const services = servicesState.status === 'success' ? servicesState.data.filter((item) => item.is_active) : []
  const completedCount =
    bookingsState.status === 'success'
      ? bookingsState.data.filter((item) => item.status === 'completed').length
      : 0
  const identityVerified = account.verifications.some((item) => item.kind === 'identity' && item.status === 'verified')
  const employmentVerified = account.verifications.some(
    (item) => item.kind === 'employment' && item.status === 'verified',
  )
  const verified = identityVerified && employmentVerified
  const completeness = profileCompleteness(account)
  const checklist = profileChecklist(account)
  const summary = summaryState.status === 'success' ? summaryState.data : null
  const interviewTypes = [...new Set(services.map((service) => service.interview_type))]
  const savedExpertise = expertiseFromAccount(account)
  const dirty =
    JSON.stringify(form) !== JSON.stringify(formFromAccount(account)) ||
    JSON.stringify([expertise.targetRoles, expertise.candidateLevels]) !==
      JSON.stringify([savedExpertise.targetRoles, savedExpertise.candidateLevels])
  const missingCount = checklist.filter((item) => !item.done).length

  function onCancel() {
    if (!account) return
    setForm(formFromAccount(account))
    setExpertise(expertiseFromAccount(account))
    setSaveError(null)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    setSaving(true)
    try {
      await updateInterviewerProfile({
        fullName: form.fullName,
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
      })
      await updateInterviewerRoles({
        targetRoles: expertise.targetRoles,
        candidateLevels: expertise.candidateLevels,
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
    <div className={cn('space-y-6', dirty && 'pb-24')}>
      <PageHeader
        title="Your Public Profile"
        subtitle="Present your experience and expertise so the right candidates find and book you."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/interviewer/verification">
              <Button variant="outline">Verification</Button>
            </Link>
            <Link to="/interviewer/setup?step=professional">
              <Button variant="outline">Open setup</Button>
            </Link>
          </div>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <CandidatePreviewCard
            account={account}
            activeServices={services}
            averageRating={summary?.averageRating ?? null}
            reviewCount={summary?.count ?? 0}
            completedCount={completedCount}
            verified={verified}
          />

          <form id="profile-form" className="space-y-6" onSubmit={onSave}>
            <Card id="section-professional" className="scroll-mt-24 p-5 sm:p-6">
              <SectionHeader
                title="Professional details"
                description="Your background and credibility. Candidates see this at the top of your profile."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <TextInput
                    id="fullName"
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  />
                </div>
                <DetectedTimezoneNote timezone={form.timezone} />
                <div>
                  <FieldLabel htmlFor="currentRole">Current role</FieldLabel>
                  <TextInput
                    id="currentRole"
                    placeholder="e.g. Senior Data Scientist"
                    value={form.currentRole}
                    onChange={(event) => setForm({ ...form, currentRole: event.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="company">Current company</FieldLabel>
                  <TextInput
                    id="company"
                    placeholder="e.g. Flipkart"
                    value={form.company}
                    onChange={(event) => setForm({ ...form, company: event.target.value })}
                  />
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
                  <FieldLabel htmlFor="languages">Interview languages</FieldLabel>
                  <TextInput
                    id="languages"
                    placeholder="English, Hindi"
                    value={form.languages}
                    onChange={(event) => setForm({ ...form, languages: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="headline">Headline</FieldLabel>
                  <TextInput
                    id="headline"
                    placeholder="e.g. Data Scientist helping analysts crack SQL and ML interviews"
                    value={form.headline}
                    onChange={(event) => setForm({ ...form, headline: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="bio">Bio</FieldLabel>
                  <TextArea
                    id="bio"
                    placeholder="Your background, what you have hired for, and how you run a mock interview."
                    value={form.bio}
                    onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  />
                </div>
              </div>
            </Card>

            <Card id="section-skills" className="scroll-mt-24 p-5 sm:p-6">
              <SectionHeader
                title="Skills you interview on"
                description="Candidates are matched to you on these skills, even before you create a service."
              />
              <div className="mt-5">
                <SkillManager interviewerProfileId={account.interviewer.id} onChanged={refreshAccount} />
              </div>
            </Card>

            <Card id="section-roles" className="scroll-mt-24 p-5 sm:p-6">
              <SectionHeader
                title="Roles you interview for"
                description="Compared with the roles candidates are preparing for."
              />
              <div className="mt-5">
                <ExpertiseFields idPrefix="profile" value={expertise} onChange={setExpertise} showSkills={false} />
              </div>
              <div className="mt-8 border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-navy-950">Interview formats</p>
                <p className="mt-0.5 text-xs text-slate-500">Taken from your active services.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {interviewTypes.length === 0 ? (
                    <span className="text-sm text-slate-500">No active services yet.</span>
                  ) : (
                    interviewTypes.map((type) => <Badge key={type}>{type}</Badge>)
                  )}
                  <Link to="/interviewer/services" className="text-sm font-medium text-coral-700 hover:underline">
                    Manage services
                  </Link>
                </div>
              </div>
            </Card>
          </form>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold text-navy-950">Candidate-visible slots</h3>
              <p className="mt-1 text-sm text-slate-500">
                Generated from your availability. Candidates cannot pick a time outside these slots.
              </p>
              {slots.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No weekly availability windows yet.{' '}
                  <Link to="/interviewer/calendar" className="font-medium text-coral-700 hover:underline">
                    Set availability
                  </Link>
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {slots.map((slot) => (
                    <li key={slot.id}>
                      {slot.label}{' '}
                      {timezoneLabel(
                        effectiveSchedulingTimezone(account.profile.timezone, account.interviewer.timezone),
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-navy-950">Services & pricing</h3>
              <div className="mt-4 grid gap-3">
                {services.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No active services yet.{' '}
                    <Link to="/interviewer/services" className="font-medium text-coral-700 hover:underline">
                      Add a service
                    </Link>
                  </p>
                ) : (
                  services.map((service) => (
                    <div key={service.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-navy-950">{service.name}</p>
                        <p className="font-semibold text-navy-950">{formatINR(paiseToRupees(service.price_paise))}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {service.duration_min} minutes · {service.interview_type}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-navy-950">Reviews & Reputation</h3>
              <VisibilityLabel visibility="public" topic="Candidate Review" />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Only public candidate reviews appear here. Private performance scores are never shown on this profile.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <span>
                {summary?.averageRating ? `${summary.averageRating.toFixed(1)} / 5 overall` : 'No public rating yet'}
              </span>
              <span>{formatCount(summary?.count ?? 0)} public reviews</span>
              <span>{formatCount(completedCount)} interviews completed</span>
            </div>
            <div className="mt-5 space-y-3">
              {REVIEW_DIMENSIONS.map((item) => {
                const value = summary?.dimensionAverages?.[item.key] ?? 0
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
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">Approved public reviews will appear here.</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-navy-950">{review.displayName}</p>
                      <StarRating value={review.overallRating} />
                    </div>
                    {review.writtenReview ? (
                      <p className="mt-2 text-sm text-slate-600">“{review.writtenReview}”</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">{formatReviewDate(review.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24">
          {servicesState.status === 'success' && availState.status === 'success' ? (
            <ReadinessCard account={account} services={servicesState.data} board={availState.data} />
          ) : (
            <Card className="p-5">
              <Skeleton className="h-28" />
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold text-navy-950">Profile strength</h2>
              <p className="text-sm font-semibold text-navy-950">{completeness}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-600 transition-[width] duration-500 ease-out"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {missingCount > 0
                ? `${missingCount} item${missingCount === 1 ? '' : 's'} left. Tap any missing item to jump there.`
                : 'Profile looks complete for candidate trust and matching.'}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-50',
                      item.done ? 'text-slate-600' : 'font-medium text-navy-950',
                    )}
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    )}
                    <span>{item.label}</span>
                    <span className="sr-only">{item.done ? 'complete' : 'missing'}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-navy-950/10 bg-paper/95 px-4 py-3 shadow-[0_-12px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur transition-transform duration-300 sm:px-6 lg:left-64 xl:left-72',
          dirty ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saveError ? <p className="text-sm text-red-700 sm:mr-auto">{saveError}</p> : null}
          {!saveError && dirty ? <p className="text-sm text-slate-500 sm:mr-auto">You have unsaved changes.</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving || !dirty} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" form="profile-form" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
