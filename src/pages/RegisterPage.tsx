import { type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Stepper } from '../components/ui/dashboard.tsx'
import { Card, FieldLabel, TextInput } from '../components/ui/primitives.tsx'
import { ONBOARDING_STEPS } from '../data/catalogs.ts'
import { useOnboarding } from '../state/onboarding.tsx'

export function RegisterPage() {
  const navigate = useNavigate()
  const { draft, update } = useOnboarding()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    navigate('/interviewer/setup?step=professional')
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
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="name">Full Name</FieldLabel>
            <TextInput
              id="name"
              required
              value={draft.fullName}
              onChange={(event) => update({ fullName: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput
              id="email"
              type="email"
              required
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
              value={draft.password}
              onChange={(event) => update({ password: event.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <TextInput
              id="phone"
              required
              value={draft.phone}
              onChange={(event) => update({ phone: event.target.value })}
            />
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
            <FieldLabel htmlFor="linkedin">LinkedIn Profile</FieldLabel>
            <TextInput
              id="linkedin"
              required
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
            <p className="mt-2 text-xs text-slate-500">Stored locally in this prototype. Used for your public profile preview.</p>
          </div>
          <div className="sm:col-span-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Verification information: after you finish setup, we’ll ask for identity, LinkedIn,
            employment, and a professional email. Verified profiles build more trust with candidates.
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" fullWidth>
              Continue
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
