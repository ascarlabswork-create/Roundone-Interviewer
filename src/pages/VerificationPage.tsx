import { BadgeCheck, Briefcase, Link2, Mail, Shield } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { VerificationBadge } from '../components/ui/StatusBadge.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { VerifiedBadge } from '../components/ui/identity.tsx'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import type { DisplayVerificationStatus } from '../services/interviewerProfile.ts'
import type { VerificationStatus } from '../types.ts'

const cards: Array<{
  key: 'identity' | 'linkedin' | 'employment' | 'professionalEmail'
  title: string
  body: string
  icon: typeof Shield
}> = [
  { key: 'identity', title: 'Identity', body: 'Government ID check. Document upload is not connected yet.', icon: Shield },
  { key: 'linkedin', title: 'LinkedIn', body: 'Confirm the public profile that candidates will see.', icon: Link2 },
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

  async function onSubmit() {
    setSubmitting(true)
    try {
      pushToast('Submitted for review. Interviewers cannot change verification status directly.')
      navigate('/interviewer/dashboard')
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
        Status is read from RoundOne. You can submit a request, but you cannot change Pending, Verified, or Rejected
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

      <div className="mt-8">
        <Button onClick={onSubmit} disabled={submitting} fullWidth>
          Submit for Verification
        </Button>
      </div>
    </div>
  )
}
