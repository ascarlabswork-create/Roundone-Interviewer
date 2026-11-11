import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import {
  INTERVIEWER_PROFILE_PATH,
  verificationProfileChecks,
  type VerificationProfileCheck,
} from '../../lib/verificationFlow.ts'
import type { InterviewerAccount } from '../../services/interviewerProfile.ts'
import { Button } from '../ui/Button.tsx'
import { Card } from '../ui/primitives.tsx'

function CheckRow({ item }: { item: VerificationProfileCheck }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      {item.done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      )}
      <span className={item.done ? 'text-slate-700' : 'font-medium text-navy-950'}>{item.label}</span>
    </li>
  )
}

export function VerificationProfileChecklist({
  account,
  title = 'Add these on your profile before we can verify you',
  description = 'Verification is reviewed by staff in the experts.jobround.ai admin console. They use the details below from your Profile page — not this screen. Government ID upload is not connected yet.',
  alwaysShowEditButton = false,
}: {
  account: InterviewerAccount
  title?: string
  description?: string
  /** Show “Edit profile” even when every checklist item is complete. */
  alwaysShowEditButton?: boolean
}) {
  const checks = verificationProfileChecks(account)
  const ready = checks.every((item) => item.done)
  const missing = checks.filter((item) => !item.done).length

  return (
    <Card className={`p-5 ${ready ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/40'}`}>
      <p className="font-semibold text-navy-950">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <ul className="mt-4 space-y-2">
        {checks.map((item) => (
          <CheckRow key={item.id} item={item} />
        ))}
      </ul>
      {!ready || alwaysShowEditButton ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!ready ? (
            <p className="text-xs text-amber-900">
              {missing} item{missing === 1 ? '' : 's'} still missing on your profile.
            </p>
          ) : (
            <p className="text-xs text-emerald-900">All items complete — you can still edit anytime.</p>
          )}
          <Link to={INTERVIEWER_PROFILE_PATH} className="shrink-0">
            <Button size="sm">{ready ? 'Edit profile details' : 'Complete profile'}</Button>
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-xs text-emerald-900">Profile looks ready for admin review.</p>
      )}
    </Card>
  )
}
