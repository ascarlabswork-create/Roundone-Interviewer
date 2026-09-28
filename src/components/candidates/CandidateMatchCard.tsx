import { Check, Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { initials } from '../../lib/format.ts'
import { formatSkillPercent, type DiscoveredCandidate } from '../../services/candidateDiscovery.ts'
import { Button } from '../ui/Button.tsx'
import { Badge, Card } from '../ui/primitives.tsx'

type SkillTone = 'matched' | 'missing' | 'extra'

const toneStyles: Record<SkillTone, { chip: string; icon: ReactNode; srPrefix: string }> = {
  matched: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: <Check className="h-3 w-3" aria-hidden />,
    srPrefix: 'Matched',
  },
  missing: {
    chip: 'border-red-200 bg-red-50 text-red-700',
    icon: <X className="h-3 w-3" aria-hidden />,
    srPrefix: 'Missing',
  },
  extra: {
    chip: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: <Plus className="h-3 w-3" aria-hidden />,
    srPrefix: 'Additional',
  },
}

function SkillGroup({ title, skills, tone }: { title: string; skills: string[]; tone: SkillTone }) {
  const style = toneStyles[tone]
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="font-normal normal-case text-slate-400">({skills.length})</span>
      </p>
      {skills.length === 0 ? (
        <p className="mt-1.5 text-sm text-slate-400">None</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li
              key={skill}
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                style.chip,
              )}
            >
              {style.icon}
              <span className="sr-only">{style.srPrefix}: </span>
              <span className="break-words">{skill}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function matchTone(percent: number) {
  if (percent >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-700' }
  if (percent >= 40) return { bar: 'bg-blue-500', text: 'text-blue-700' }
  if (percent > 0) return { bar: 'bg-amber-500', text: 'text-amber-700' }
  return { bar: 'bg-slate-300', text: 'text-slate-500' }
}

export function CandidateMatchCard({
  candidate,
  rank,
  hasInterviewerSkills,
}: {
  candidate: DiscoveredCandidate
  rank: number
  hasInterviewerSkills: boolean
}) {
  const percentLabel = formatSkillPercent(candidate.skillPercent)
  const tone = matchTone(candidate.skillPercent)
  const subtitle = [candidate.targetRole, candidate.candidateLevel].filter(Boolean).join(' · ')

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white"
        >
          {initials(candidate.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-semibold text-navy-950">{candidate.name}</h3>
            {candidate.bookedSessionsCount > 0 ? (
              <Badge tone="blue">
                {candidate.bookedSessionsCount} {candidate.bookedSessionsCount === 1 ? 'session' : 'sessions'} with you
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{subtitle || 'No role details provided'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-xl font-semibold leading-none', tone.text)}>{percentLabel}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Skill match</p>
        </div>
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${candidate.name} skill match`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={candidate.skillPercent}
        aria-valuetext={`${percentLabel} skill match, rank ${rank}`}
      >
        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.min(100, candidate.skillPercent)}%` }} />
      </div>
      {hasInterviewerSkills ? (
        <p className="mt-1.5 text-xs text-slate-500">
          {candidate.matchedSkills.length} of{' '}
          {candidate.matchedSkills.length + candidate.missingInterviewerSkills.length} of your skills
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <SkillGroup title="Matched" skills={candidate.matchedSkills} tone="matched" />
        {hasInterviewerSkills ? (
          <SkillGroup title="Missing interviewer skills" skills={candidate.missingInterviewerSkills} tone="missing" />
        ) : null}
        <SkillGroup title="Additional candidate skills" skills={candidate.extraCandidateSkills} tone="extra" />
      </div>

      {candidate.bookedSessionsCount > 0 ? (
        <div className="mt-auto pt-5">
          <Link to={`/interviewer/candidates/${candidate.candidateProfileId}`}>
            <Button size="sm" variant="outline" fullWidth>
              View booking history
            </Button>
          </Link>
        </div>
      ) : null}
    </Card>
  )
}
