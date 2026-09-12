import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Stepper } from '../components/ui/dashboard.tsx'
import { Card, FieldLabel, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { ONBOARDING_STEPS, TIMEZONES } from '../data/catalogs.ts'
import { fullNameFromParts, signUpInterviewer } from '../services/auth.ts'
import { updateInterviewerProfile } from '../services/interviewerProfile.ts'
import { safeNextPath } from '../lib/nextPath.ts'
import { useOnboarding } from '../state/onboarding.tsx'
import { useSession } from '../state/session.tsx'

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'), '/interviewer/setup?step=professional')
  const { status, user, refreshAccount } = useSession()
  const { draft, update } = useOnboarding()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (status === 'authenticated' && user && !submitting) {
    return <Navigate to={nextPath} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const firstName = draft.firstName.trim()
      const lastName = draft.lastName.trim()
      const fullName = fullNameFromParts(firstName, lastName)
      update({ fullName })
      const result = await signUpInterviewer({
        firstName,
        lastName,
        email: draft.email,
        password: draft.password,
        linkedin: draft.linkedin,
        phone: draft.phone,
        timezone: draft.timezone,
        currentRole: draft.role,
        company: draft.company,
        experienceYears: Number(draft.experienceYears) || 0,
      })
      if (result.needsEmailConfirmation) {
        setInfo('Check your email to confirm your account, then sign in to finish setup.')
        return
      }
      await refreshAccount()
      await updateInterviewerProfile({
        fullName,
        timezone: draft.timezone,
        currentRole: draft.role,
        company: draft.company,
        experienceYears: Number(draft.experienceYears) || 0,
        linkedin: draft.linkedin,
        phone: draft.phone,
      })
      await refreshAccount()
      navigate('/interviewer/setup?step=professional')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Stepper steps={[...ONBOARDING_STEPS]} current={0} />
      <h1 className="mt-8 text-2xl font-semibold text-navy-950">Create your interviewer account</h1>
      <p className="mt-2 text-sm text-slate-600">
        We’ll use this to start your professional profile. Verification comes after setup.
      </p>

      <Card className="mt-8 p-6">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <TextInput
              id="firstName"
              required
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(event) => update({ firstName: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <TextInput
              id="lastName"
              required
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(event) => update({ lastName: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput
              id="email"
              type="email"
              required
              autoComplete="email"
              value={draft.email}
              onChange={(event) => update({ email: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <TextInput
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={draft.password}
              onChange={(event) => update({ password: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <TextInput
              id="phone"
              value={draft.phone}
              onChange={(event) => update({ phone: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
            <SelectInput
              id="timezone"
              value={draft.timezone}
              onChange={(event) => update({ timezone: event.target.value })}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="company">Current Company</FieldLabel>
            <TextInput
              id="company"
              required
              value={draft.company}
              onChange={(event) => update({ company: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="role">Current Role</FieldLabel>
            <TextInput
              id="role"
              required
              value={draft.role}
              onChange={(event) => update({ role: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="yoe">Years of Experience</FieldLabel>
            <TextInput
              id="yoe"
              type="number"
              min={0}
              required
              value={draft.experienceYears}
              onChange={(event) => update({ experienceYears: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="linkedin">LinkedIn Profile URL</FieldLabel>
            <TextInput
              id="linkedin"
              type="url"
              required
              placeholder="https://www.linkedin.com/in/you"
              value={draft.linkedin}
              onChange={(event) => update({ linkedin: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="photo">Profile photo</FieldLabel>
            <TextInput
              id="photo"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                update({ photo: URL.createObjectURL(file) })
              }}
            />
            <p className="mt-2 text-xs text-slate-500">
              Local preview only for now. Add an image URL on your profile after signup.
            </p>
          </div>
          <div className="sm:col-span-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Verification information: after you finish setup, we’ll show identity, LinkedIn, and
            employment status. Interviewers cannot change those statuses themselves.
          </div>
          {error ? <p className="sm:col-span-2 text-sm text-red-700">{error}</p> : null}
          {info ? <p className="sm:col-span-2 text-sm text-emerald-700">{info}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </div>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-medium text-blue-700" to="/interviewer/login">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
