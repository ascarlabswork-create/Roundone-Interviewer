import { BadgeCheck, Briefcase, Shield } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { VerificationProfileChecklist } from '../components/verification/VerificationProfileChecklist.tsx'
import { Button } from '../components/ui/Button.tsx'
import { VerificationBadge } from '../components/ui/StatusBadge.tsx'
import { Card } from '../components/ui/primitives.tsx'
import {
  VERIFICATION_VERIFIED_PATH,
  verificationFullyVerified,
  verificationKindsRequested,
} from '../lib/verificationFlow.ts'
import { useSession } from '../state/session.tsx'

const steps = [
  { icon: Shield, title: 'Identity', kind: 'identity' as const },
  { icon: Briefcase, title: 'Employment', kind: 'employment' as const },
]

export function VerificationSubmittedPage() {
  const { account, refreshAccount } = useSession()

  useEffect(() => {
    void refreshAccount()
  }, [refreshAccount])

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-slate-600">
        <Link to="/interviewer/login" className="font-medium text-coral-700">
          Sign in
        </Link>{' '}
        to see your verification status.
      </div>
    )
  }

  if (verificationFullyVerified(account.verifications)) {
    return <Navigate to={VERIFICATION_VERIFIED_PATH} replace />
  }

  if (!verificationKindsRequested(account.verifications)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-slate-600">You have not submitted verification yet.</p>
        <Link to="/interviewer/verification" className="mt-4 inline-block">
          <Button>Go to verification</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-navy-950">Verification request received</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Thanks, {account.profile.full_name.split(' ')[0] || 'there'}. Our team will review your identity and employment
          details on jobround.ai. You will stay signed in and can use the dashboard while you wait.
        </p>
      </div>

      <Card className="mt-8 space-y-3 p-5">
        <p className="text-sm font-semibold text-navy-950">What we are reviewing</p>
        {steps.map((step) => {
          const row = account.verifications.find((item) => item.kind === step.kind)
          return (
            <div key={step.kind} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <step.icon className="h-5 w-5 text-navy-700" aria-hidden />
                <span className="text-sm font-medium text-navy-950">{step.title}</span>
              </div>
              <VerificationBadge status={row?.status ?? 'pending'} />
            </div>
          )
        })}
        <p className="text-xs text-slate-500">
          Professional email verification is not live yet. Status there will stay pending until that workflow ships.
        </p>
      </Card>

      <div className="mt-6">
        <VerificationProfileChecklist
          account={account}
          title="While you wait, keep your profile complete"
          description="Admins compare these fields on your Profile page with your request. Update them anytime, then watch status on Verification details."
        />
      </div>

      <Card className="mt-4 p-5 text-sm text-slate-600">
        <p className="font-semibold text-navy-950">How verification works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>You</strong> add name, role, company, skills, and summary on{' '}
            <Link to="/interviewer/profile" className="font-medium text-coral-700 hover:underline">
              Profile
            </Link>
            , then submit here.
          </li>
          <li>
            <strong>Admins</strong> on jobround.ai open Verifications and approve or reject identity and employment.
          </li>
          <li>
            When both are <strong>Verified</strong>, you are taken to the verified page and your badge shows to
            candidates.
          </li>
        </ul>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/interviewer/dashboard">
          <Button fullWidth className="sm:w-auto">
            Open dashboard
          </Button>
        </Link>
        <Link to="/interviewer/verification">
          <Button variant="outline" fullWidth className="sm:w-auto">
            Verification details
          </Button>
        </Link>
      </div>
    </div>
  )
}
