import { BadgeCheck, Briefcase, Link2, Mail, Shield } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, submitVerification } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { VerificationBadge } from '../components/ui/StatusBadge.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { VerifiedBadge } from '../components/ui/identity.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { useToast } from '../state/toast.tsx'
import type { VerificationKey } from '../types.ts'

const cards: Array<{ key: VerificationKey; title: string; body: string; icon: typeof Shield }> = [
  { key: 'identity', title: 'Identity', body: 'Government ID check. Prototype only — no document is uploaded.', icon: Shield },
  { key: 'linkedin', title: 'LinkedIn', body: 'Confirm the public profile that candidates will see.', icon: Link2 },
  { key: 'employment', title: 'Employment', body: 'Current company and role, used for the verified badge.', icon: Briefcase },
  { key: 'professionalEmail', title: 'Professional Email', body: 'Work email at your current company.', icon: Mail },
]

export function VerificationPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const state = useAsync(() => getProfile(), [])
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit() {
    setSubmitting(true)
    try {
      await submitVerification()
      pushToast('Submitted for verification. Your badge will appear on the public profile.')
      navigate('/interviewer/dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-80" />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState body={state.error} onRetry={state.reload} />
      </div>
    )
  }

  const profile = state.data

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-navy-950">Verify your professional identity</h1>
      <p className="mt-2 text-sm text-slate-600">Verified profiles build more trust with candidates.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.key} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <card.icon className="h-5 w-5 text-navy-700" />
              <VerificationBadge status={profile.verification[card.key]} />
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
            {profile.name} <VerifiedBadge />
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
