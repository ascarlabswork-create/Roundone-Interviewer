import { BadgeCheck, Briefcase, Mail, Shield } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { VerificationBadge } from '../components/ui/StatusBadge.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { VerifiedBadge } from '../components/ui/identity.tsx'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import { VERIFICATION_SUBMITTED_PATH, verificationKindsRequested } from '../lib/verificationFlow.ts'
import { submitInterviewerVerificationRequest, type DisplayVerificationStatus } from '../services/interviewerProfile.ts'
import type { VerificationStatus } from '../types.ts'

const cards: Array<{
  key: 'identity' | 'employment' | 'professionalEmail'
  title: string
  body: string
  icon: typeof Shield
}> = [
  { key: 'identity', title: 'Identity', body: 'Government ID check. Document upload is not connected yet.', icon: Shield },
  { key: 'employment', title: 'Employment', body: 'Current company and role, used for the verified badge.', icon: Briefcase },
  { key: 'professionalEmail', title: 'Professional Email', body: 'Work email is not in the current verification table. Status stays pending until that workflow exists.', icon: Mail },
]

function toBadgeStatus(status: DisplayVerificationStatus): VerificationStatus {
  return status
}

export function VerificationPage() {
  const navigate = useNavigate()
  const { account, error, refreshAccount, status } = useSession()
  const { pushToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const alreadySubmitted = account ? verificationKindsRequested(account.verifications) : false

  async function onSubmit() {
    if (!account || alreadySubmitted) {
      navigate(VERIFICATION_SUBMITTED_PATH, { replace: true })
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      await submitInterviewerVerificationRequest()
      await refreshAccount()
      navigate(VERIFICATION_SUBMITTED_PATH, { replace: true })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not submit for verification.'
      setSubmitError(message)
      pushToast(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-80" />
      </div>
    )
  }
  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState body={error ?? 'Could not load verification status.'} onRetry={() => void refreshAccount()} />
      </div>
    )
  }

  function statusFor(key: (typeof cards)[number]['key']): VerificationStatus {
    if (key === 'professionalEmail') return 'pending'
    const match = account?.verifications.find((item) => item.kind === key)
    return toBadgeStatus(match?.status ?? 'pending')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-navy-950">Verify your professional identity</h1>
      <p className="mt-2 text-sm text-slate-600">
        Status is read from jobround.ai. You can submit a request, but you cannot change Pending, Verified, or Rejected
        yourself.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.key} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <card.icon className="h-5 w-5 text-navy-700" />
              <VerificationBadge status={statusFor(card.key)} />
            </div>
            <h2 className="mt-3 font-semibold text-navy-950">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 flex items-center gap-3 p-5">
        <BadgeCheck className="h-8 w-8 text-emerald-600" />
        <div>
          <p className="font-semibold text-navy-950">Verified badge preview</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            {account.profile.full_name} <VerifiedBadge />
          </p>
        </div>
      </Card>

      {alreadySubmitted ? (
        <Card className="mt-8 border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-950">
          <p className="font-semibold">Your request is already with our team</p>
          <p className="mt-1 text-emerald-900">View status, what happens next, and links to the dashboard from your confirmation page.</p>
        </Card>
      ) : null}

      {submitError ? <p className="mt-4 text-sm text-red-700">{submitError}</p> : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {alreadySubmitted ? (
          <Link to={VERIFICATION_SUBMITTED_PATH} className="flex-1">
            <Button fullWidth>View verification status</Button>
          </Link>
        ) : (
          <Button onClick={() => void onSubmit()} disabled={submitting} fullWidth className="sm:flex-1">
            {submitting ? 'Submitting…' : 'Submit for Verification'}
          </Button>
        )}
      </div>
    </div>
  )
}
