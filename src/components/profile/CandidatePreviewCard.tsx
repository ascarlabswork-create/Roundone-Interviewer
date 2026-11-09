import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
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

function PreviewSection({
  title,
  empty,
  items,
  tone,
  href,
}: {
  title: string
  empty: string
  items: string[]
  tone?: 'blue'
  href?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? (
        href ? (
          href.startsWith('#') ? (
            <a href={href} className="mt-2 inline-block text-sm font-medium text-coral-700 hover:underline">
              {empty}
            </a>
          ) : (
            <Link to={href} className="mt-2 inline-block text-sm font-medium text-coral-700 hover:underline">
              {empty}
            </Link>
          )
        ) : (
          <p className="mt-2 text-sm text-slate-400">{empty}</p>
        )
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
  const headline =
    interviewer.headline?.trim() && interviewer.headline.trim() !== interviewer.current_role
      ? interviewer.headline.trim()
      : ''
  const interviewTypes = unique(activeServices.map((service) => service.interview_type))
  const startingPaise =
    activeServices.length > 0 ? Math.min(...activeServices.map((service) => service.price_paise)) : null

  return (
    <Card className="h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-medium text-slate-500 sm:px-6">
        <Eye className="h-3.5 w-3.5" aria-hidden />
        How candidates see you
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={profile.avatar_url ?? ''} name={profile.full_name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">
                {profile.full_name || 'Your name'}
              </h2>
              {verified ? <VerifiedBadge /> : null}
            </div>
            {headline ? <p className="mt-1 font-medium text-slate-700">{headline}</p> : null}
            {roleLine ? (
              <p className="mt-1 text-sm text-slate-600 sm:text-base">{roleLine}</p>
            ) : (
              <p className="mt-1 text-sm sm:text-base">
                <a href="#section-professional" className="font-medium text-coral-700 hover:underline">
                  Add your current role and company
                </a>
              </p>
            )}
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
            <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left sm:text-right">
              <p className="text-xs text-slate-500">Sessions from</p>
              <p className="text-xl font-semibold text-navy-950">{formatINR(paiseToRupees(startingPaise))}</p>
            </div>
          ) : null}
        </div>

        {interviewer.bio?.trim() ? (
          <p className="mt-5 text-sm leading-relaxed text-slate-600">{interviewer.bio.trim()}</p>
        ) : (
          <p className="mt-5 text-sm">
            <a href="#section-professional" className="font-medium text-coral-700 hover:underline">
              Add a short bio about your background and how you run interviews
            </a>
          </p>
        )}

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <PreviewSection
            title="Skills"
            empty="Add skills"
            items={account.skills}
            tone="blue"
            href="#section-skills"
          />
          <PreviewSection title="Roles" empty="Add target roles" items={account.targetRoles} href="#section-roles" />
          <PreviewSection
            title="Interview formats"
            empty="Add a service"
            items={interviewTypes}
            href="/interviewer/services"
          />
        </div>
      </div>
    </Card>
  )
}
