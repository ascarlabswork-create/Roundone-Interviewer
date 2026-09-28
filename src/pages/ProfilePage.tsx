import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { CandidatePreviewCard } from '../components/profile/CandidatePreviewCard.tsx'
import { ExpertiseFields, type ExpertiseValue } from '../components/profile/ExpertiseFields.tsx'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { StarRating } from '../components/ui/identity.tsx'
import { Badge, Card, ErrorState, FieldLabel, PageHeader, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { SuggestedSelect } from '../components/ui/suggestions.tsx'
import { REVIEW_DIMENSIONS, TIMEZONES } from '../data/catalogs.ts'
import { formatReviewDate, timezoneLabel } from '../lib/dates.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { loadMyAvailabilityBoard } from '../services/interviewerAvailability.ts'
import { getMyBookings } from '../services/interviewerBookings.ts'
import {
  profileChecklist,
  profileCompleteness,
  updateInterviewerProfile,
  updateInterviewerRoles,
  updateInterviewerSkills,
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
  })
  const [expertise, setExpertise] = useState<ExpertiseValue>({ skills: [], targetRoles: [], candidateLevels: [] })

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
    })
    setExpertise({
      skills: account.skills,
      targetRoles: account.targetRoles,
      candidateLevels: account.candidateLevels,
    })
  }, [account])

  if (status === 'loading') return <Skeleton className="h-96" />
  if (!account) {
    return <ErrorState title="Could not load profile" body={error ?? 'Your interviewer profile is not ready yet.'} onRetry={() => void refreshAccount()} />
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
  const employmentVerified = account.verifications.some((item) => item.kind === 'employment' && item.status === 'verified')
  const verified = identityVerified && employmentVerified
  const completeness = profileCompleteness(account)
  const checklist = profileChecklist(account)
  const summary = summaryState.status === 'success' ? summaryState.data : null
  const interviewTypes = [...new Set(services.map((service) => service.interview_type))]

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
      })
      await updateInterviewerSkills(expertise.skills)
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
    <div className="space-y-6">
      <PageHeader
        title="Your Public Profile"
        subtitle="Present your experience and expertise so the right candidates find and book you."
        actions={
          <Link to="/interviewer/setup?step=professional">
            <Button variant="outline">Open setup</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CandidatePreviewCard
            account={account}
            activeServices={services}
            averageRating={summary?.averageRating ?? null}
            reviewCount={summary?.count ?? 0}
            completedCount={completedCount}
            verified={verified}
          />
        </div>
        <Card className="h-fit p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-navy-950">Profile strength</h2>
            <p className="text-sm font-semibold text-navy-950">{completeness}%</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completeness}%` }} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Complete profiles are easier for candidates to trust and book.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                )}
                <span className={item.done ? 'text-slate-600' : 'font-medium text-navy-950'}>{item.label}</span>
                <span className="sr-only">{item.done ? 'complete' : 'missing'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <form className="space-y-6" onSubmit={onSave}>
        <Card className="p-6">
          <SectionHeader
            title="Professional details"
            description="Your background and credibility. Candidates see this at the top of your profile."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <TextInput id="fullName" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <SuggestedSelect
                id="timezone"
                options={TIMEZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
                value={form.timezone}
                onChange={(timezone) => setForm({ ...form, timezone })}
                customPlaceholder="Type a timezone, e.g. Europe/Berlin"
                required
              />
            </div>
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
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="avatar">Photo URL</FieldLabel>
              <TextInput
                id="avatar"
                placeholder="https://…"
                value={form.avatarUrl}
                onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader
            title="Interview expertise"
            description="What you interview on. This is compared with the skills, roles, and levels on candidate profiles."
          />
          <div className="mt-5">
            <ExpertiseFields idPrefix="profile" value={expertise} onChange={setExpertise} />
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
              <Link to="/interviewer/services" className="text-sm font-medium text-blue-700">
                Manage services
              </Link>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saveError ? <p className="text-sm text-red-700 sm:mr-auto">{saveError}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold text-navy-950">Candidate-visible slots</h3>
          <p className="mt-1 text-sm text-slate-500">
            Generated from your availability. Candidates cannot pick a time outside these slots.
          </p>
          {slots.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No weekly availability windows yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {slots.map((slot) => (
                <li key={slot.id}>
                  {slot.label} {timezoneLabel(account.profile.timezone)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-navy-950">Services & pricing</h3>
          <div className="mt-4 grid gap-3">
            {services.length === 0 ? (
              <p className="text-sm text-slate-500">No active services yet.</p>
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
          <span>{summary?.averageRating ? `${summary.averageRating.toFixed(1)} / 5 overall` : 'No public rating yet'}</span>
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
                {review.writtenReview ? <p className="mt-2 text-sm text-slate-600">“{review.writtenReview}”</p> : null}
                <p className="mt-2 text-xs text-slate-500">{formatReviewDate(review.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
