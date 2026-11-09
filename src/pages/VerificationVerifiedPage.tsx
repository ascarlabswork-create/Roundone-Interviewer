import { BadgeCheck, Calendar, LayoutDashboard, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { VerifiedBadge } from '../components/ui/identity.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'
import { verificationFullyVerified } from '../lib/verificationFlow.ts'
import { useSession } from '../state/session.tsx'

const nextSteps = [
  {
    icon: Calendar,
    title: 'Set your availability',
    body: 'Open the calendar so candidates can book you.',
    href: '/interviewer/calendar',
    label: 'Open calendar',
  },
  {
    icon: Sparkles,
    title: 'Activate a service',
    body: 'Matched candidates need an active service to book.',
    href: '/interviewer/services',
    label: 'Manage services',
  },
  {
    icon: LayoutDashboard,
    title: 'Run your practice',
    body: 'Bookings, sessions, and earnings live on the dashboard.',
    href: '/interviewer/dashboard',
    label: 'Open dashboard',
  },
]

export function VerificationVerifiedPage() {
  const { account } = useSession()

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-slate-600">
        <Link to="/interviewer/login" className="font-medium text-coral-700">
          Sign in
        </Link>{' '}
        to see verification status.
      </div>
    )
  }

  if (!verificationFullyVerified(account.verifications)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-slate-600">Your identity and employment checks are not fully verified yet.</p>
        <Link to="/interviewer/verification" className="mt-4 inline-block">
          <Button>View verification</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <BadgeCheck className="mx-auto h-16 w-16 text-emerald-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-navy-950">You&apos;re verified</h1>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600">
          <span>{account.profile.full_name}</span>
          <VerifiedBadge />
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Identity and employment were approved on jobround.ai. Candidates can see your verified badge on your public
          profile.
        </p>
      </div>

      <Card className="mt-8 p-5">
        <p className="text-sm font-semibold text-navy-950">Your next steps</p>
        <ul className="mt-4 space-y-4">
          {nextSteps.map((step) => (
            <li key={step.href} className="flex gap-3">
              <step.icon className="mt-0.5 h-5 w-5 shrink-0 text-coral-700" aria-hidden />
              <div className="flex-1">
                <p className="font-medium text-navy-950">{step.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{step.body}</p>
                <Link to={step.href} className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    {step.label}
                  </Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
