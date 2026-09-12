import { Link } from 'react-router-dom'
import { getProfile, listAvailability, listInterviewerReviews } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { VisibilityLabel } from '../components/ui/VisibilityLabel.tsx'
import { Avatar, StarRating, VerifiedBadge } from '../components/ui/identity.tsx'
import { Badge, Card, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { REVIEW_DIMENSIONS } from '../data/catalogs.ts'
import { currentInterviewer, isFullyVerified } from '../data/interviewer.ts'
import { formatReviewDate, formatTime, timezoneLabel } from '../lib/dates.ts'
import { formatCount, formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

export function ProfilePage() {
  const profileState = useAsync(() => getProfile(), [])
  const reviewsState = useAsync(() => listInterviewerReviews(currentInterviewer.id), [])
  const availState = useAsync(() => listAvailability(), [])

  if (profileState.status === 'loading') return <Skeleton className="h-96" />
  if (profileState.status === 'error') return <ErrorState body={profileState.error} onRetry={profileState.reload} />

  const profile = profileState.data
  const slots = availState.status === 'success' ? availState.data.filter((item) => item.state === 'available').slice(0, 6) : []
  const allReviews = reviewsState.status === 'success' ? reviewsState.data : []
  const reviews = allReviews.slice(0, 3)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Public Profile"
        subtitle="This is how candidates see you. It is not your private dashboard."
        actions={
          <Link to="/interviewer/setup?step=professional">
            <Button>Edit Profile</Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-navy-950">Profile completeness</p>
          <p className="text-sm font-semibold text-navy-950">{profile.profileCompleteness}%</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${profile.profileCompleteness}%` }} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Avatar src={profile.photo} name={profile.name} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-navy-950">{profile.name}</h2>
              {isFullyVerified(profile) ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-1 text-slate-600">
              {profile.currentRole} @ {profile.company}
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{profile.experienceYears}+ years experience</span>
              <span>{formatCount(profile.completedInterviews)} interviews</span>
              <span className="inline-flex items-center gap-1">
                <StarRating value={profile.rating} />
                {profile.rating} ({formatCount(profile.reviewCount)} reviews)
              </span>
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{profile.bio}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold text-navy-950">Expertise</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.skills.map((item) => (
              <Badge key={item} tone="blue">
                {item}
              </Badge>
            ))}
          </div>
          <h3 className="mt-5 font-semibold text-navy-950">Interview types</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.interviewTypes.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-navy-950">Candidate-visible slots</h3>
          <p className="mt-1 text-sm text-slate-500">
            Generated from your availability. Candidates cannot pick a time outside these slots.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {slots.map((slot) => (
              <li key={slot.id}>
                {formatTime(slot.start)} {timezoneLabel(profile.timezone)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-navy-950">Services & pricing</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {profile.services.filter((item) => item.isActive).map((service) => (
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
          <span>{profile.rating} / 5 overall</span>
          <span>{formatCount(profile.reviewCount)} reviews</span>
          <span>{formatCount(profile.completedInterviews)} interviews completed</span>
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
