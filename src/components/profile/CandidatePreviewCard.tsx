import type { ReactNode } from 'react'
import { Briefcase, Clock, Eye, Languages } from 'lucide-react'
import { Avatar, StarRating, VerifiedBadge } from '../ui/identity.tsx'
import { Badge, Card } from '../ui/primitives.tsx'
import { timezoneLabel } from '../../lib/dates.ts'
import { effectiveSchedulingTimezone } from '../../lib/timezones.ts'
import { formatCount, formatINR } from '../../lib/format.ts'
import { isPlaceholderProfessional, type InterviewerAccount } from '../../services/interviewerProfile.ts'
import { paiseToRupees, type InterviewerServiceRecord } from '../../services/interviewerServices.ts'

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function PreviewSection({ title, empty, items, tone }: { title: string; empty: string; items: string[]; tone?: 'blue' }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} tone={tone}>
              {item}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  )
}

export function CandidatePreviewCard({
  account,
  activeServices,
  averageRating,
  reviewCount,
  completedCount,
  verified,
}: {
  account: InterviewerAccount
  activeServices: InterviewerServiceRecord[]
  averageRating: number | null
  reviewCount: number
  completedCount: number
  verified: boolean
}) {
  const { profile, interviewer } = account
  const hasProfessional = !isPlaceholderProfessional(interviewer)
  const roleLine = hasProfessional ? [interviewer.current_role, interviewer.company].filter(Boolean).join(' @ ') : ''
  const headline = interviewer.headline?.trim() && interviewer.headline.trim() !== interviewer.current_role
    ? interviewer.headline.trim()
    : ''
  const interviewTypes = unique(activeServices.map((service) => service.interview_type))
  const startingPaise = activeServices.length > 0 ? Math.min(...activeServices.map((service) => service.price_paise)) : null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-2.5 text-xs font-medium text-slate-500">
        <Eye className="h-3.5 w-3.5" aria-hidden />
        How candidates see you
      </div>
      <div className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={profile.avatar_url ?? ''} name={profile.full_name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-navy-950">{profile.full_name || 'Your name'}</h2>
              {verified ? <VerifiedBadge /> : null}
            </div>
            {headline ? <p className="mt-1 font-medium text-slate-700">{headline}</p> : null}
            <p className="mt-1 text-slate-600">{roleLine || 'Add your current role and company'}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
              {interviewer.experience_years > 0 ? (
                <Meta icon={<Briefcase className="h-4 w-4 text-slate-400" aria-hidden />}>
                  {interviewer.experience_years}+ years experience
                </Meta>
              ) : null}
              <Meta icon={<Clock className="h-4 w-4 text-slate-400" aria-hidden />}>
                {timezoneLabel(effectiveSchedulingTimezone(profile.timezone, interviewer.timezone))}
              </Meta>
              {interviewer.languages.length > 0 ? (
                <Meta icon={<Languages className="h-4 w-4 text-slate-400" aria-hidden />}>
                  {interviewer.languages.join(', ')}
                </Meta>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
              {averageRating ? (
                <span className="inline-flex items-center gap-2">
                  <StarRating value={averageRating} />
                  <span className="font-medium text-navy-950">{averageRating.toFixed(1)}</span>
                  <span>({formatCount(reviewCount)} reviews)</span>
                </span>
              ) : (
                <Badge tone="blue">New interviewer</Badge>
              )}
              {completedCount > 0 ? <span>{formatCount(completedCount)} interviews completed</span> : null}
            </div>
          </div>
          {startingPaise !== null ? (
            <div className="shrink-0 rounded-lg border border-slate-200 px-4 py-3 text-left sm:text-right">
              <p className="text-xs text-slate-500">Sessions from</p>
              <p className="text-xl font-semibold text-navy-950">{formatINR(paiseToRupees(startingPaise))}</p>
            </div>
          ) : null}
        </div>

        <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
          {interviewer.bio?.trim() || 'Add a short bio about your background and how you run interviews.'}
        </p>

        <div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <PreviewSection title="Skills" empty="No skills added yet" items={account.skills} tone="blue" />
          <PreviewSection title="Interview formats" empty="Add an active service" items={interviewTypes} />
          <PreviewSection title="Roles" empty="No target roles yet" items={account.targetRoles} />
        </div>
      </div>
    </Card>
  )
}
