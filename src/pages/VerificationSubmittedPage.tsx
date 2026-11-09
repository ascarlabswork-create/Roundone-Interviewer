import { BadgeCheck, Briefcase, Shield } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { VerificationProfileChecklist } from '../components/verification/VerificationProfileChecklist.tsx'
import { Button } from '../components/ui/Button.tsx'
import { VerificationBadge } from '../components/ui/StatusBadge.tsx'
import { Badge, Card } from '../components/ui/primitives.tsx'
import {
  INTERVIEWER_PROFILE_PATH,
  VERIFICATION_VERIFIED_PATH,
  verificationAnyDetailsIncomplete,
  verificationFullyVerified,
  verificationHasRejection,
  verificationKindDetailsComplete,
  verificationKindsRequested,
} from '../lib/verificationFlow.ts'
import { useSession } from '../state/session.tsx'

const steps = [
  { icon: Shield, title: 'Identity', kind: 'identity' as const },
  { icon: Briefcase, title: 'Employment', kind: 'employment' as const },
]

const STATUS_POLL_MS = 45_000

export function VerificationSubmittedPage() {
  const { account, refreshAccount } = useSession()

  useEffect(() => {
    void refreshAccount()
  }, [refreshAccount])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshAccount()
    }, STATUS_POLL_MS)
    return () => window.clearInterval(id)
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

  const needsProfileEdits = verificationAnyDetailsIncomplete(account)
  const hasRejection = verificationHasRejection(account.verifications)
  const rejectionNotes = account.verifications.filter((row) => row.status === 'rejected' && row.notes)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-navy-950">Verification request received</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Thanks, {account.profile.full_name.split(' ')[0] || 'there'}. Finish or update your profile details below —
          each section shows <strong>Completed</strong> when we have what admins need. Identity and employment stay{' '}
          <strong>Pending review</strong> until an admin approves on jobround.ai.
        </p>
      </div>

      {needsProfileEdits ? (
        <Card className="mt-6 border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">Some details are still incomplete</p>
          <p className="mt-1">
            Use <strong>Edit profile details</strong> to fill the checklist. That moves your rows from incomplete to{' '}
            completed; admin approval is the separate step that changes Pending review to Verified.
          </p>
        </Card>
      ) : null}

      {hasRejection ? (
        <Card className="mt-4 border-red-200 bg-red-50/80 p-4 text-sm text-red-950">
          <p className="font-semibold">Admin asked for changes</p>
          <ul className="mt-2 space-y-1">
            {rejectionNotes.map((row) => (
              <li key={row.kind}>
                <span className="font-medium capitalize">{row.kind}:</span> {row.notes}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            <Link to={INTERVIEWER_PROFILE_PATH} className="font-medium text-coral-700 hover:underline">
              Edit profile
            </Link>
            , then{' '}
            <Link to="/interviewer/verification" className="font-medium text-coral-700 hover:underline">
              submit again
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <div className="mt-6">
        <VerificationProfileChecklist
          account={account}
          title="Your verification details (edit on Profile)"
          description="Complete every item here first. Checkmarks mean your side is done; admin review is still required for the badge."
          alwaysShowEditButton
        />
      </div>

      <Card className="mt-6 space-y-3 p-5">
        <p className="text-sm font-semibold text-navy-950">Review status</p>
        {steps.map((step) => {
          const row = account.verifications.find((item) => item.kind === step.kind)
          const detailsComplete = verificationKindDetailsComplete(account, step.kind)
          const reviewStatus = row?.status ?? 'pending'
          return (
            <div key={step.kind} className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <step.icon className="h-5 w-5 text-navy-700" aria-hidden />
                  <span className="text-sm font-medium text-navy-950">{step.title}</span>
                </div>
                <VerificationBadge status={reviewStatus} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-8">
                <p className="text-xs text-slate-600">Your profile details</p>
                {detailsComplete ? (
                  <Badge tone="green">Completed</Badge>
                ) : (
                  <Link to={INTERVIEWER_PROFILE_PATH}>
                    <Button size="sm" variant="outline">
                      Add missing details
                    </Button>
                  </Link>
                )}
              </div>
              {reviewStatus === 'pending' && detailsComplete ? (
                <p className="mt-1 pl-8 text-xs text-slate-500">Waiting for admin review — no further edits required unless you want to update.</p>
              ) : null}
            </div>
          )
        })}
        <p className="text-xs text-slate-500">
          Professional email verification is not live yet. Status there will stay pending until that workflow ships.
        </p>
      </Card>

      <Card className="mt-4 p-5 text-sm text-slate-600">
        <p className="font-semibold text-navy-950">How verification works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>You</strong> complete the checklist on{' '}
            <Link to={INTERVIEWER_PROFILE_PATH} className="font-medium text-coral-700 hover:underline">
              Profile
            </Link>{' '}
            (each section shows Completed when done).
          </li>
          <li>
            <strong>Admins</strong> approve or reject identity and employment — that is what moves Pending to Verified.
          </li>
          <li>
            When both are <strong>Verified</strong>, you are taken to the success page and your badge shows to candidates.
          </li>
        </ul>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to={INTERVIEWER_PROFILE_PATH}>
          <Button fullWidth className="sm:w-auto">
            {needsProfileEdits ? 'Complete profile details' : 'Edit profile details'}
          </Button>
        </Link>
        <Link to="/interviewer/dashboard">
          <Button variant="outline" fullWidth className="sm:w-auto">
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
