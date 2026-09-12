import { type FormEvent, useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import type { SettingsDraft } from '../types.ts'

export function SettingsPage() {
  const { account } = useSession()
  const { pushToast } = useToast()
  const [form, setForm] = useState<SettingsDraft>({
    email: account?.email ?? '',
    phone: account?.phone ?? '',
    timezone: account?.profile.timezone ?? 'Asia/Kolkata',
    notifyBookings: true,
    notifyReviews: true,
    notifyPayouts: true,
    payoutMethod: 'upi',
    payoutDetail: 'rahul@upi',
    publicProfile: true,
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    pushToast('Settings saved locally')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Account, notifications, and payout preferences for this prototype." />
      <Card className="p-6">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput id="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <TextInput id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="tz">Timezone</FieldLabel>
            <SelectInput id="tz" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>
              <option value="Asia/Kolkata">India Standard Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="America/New_York">Eastern Time</option>
            </SelectInput>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-slate-800">Notifications</legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifyBookings}
                onChange={(event) => setForm({ ...form, notifyBookings: event.target.checked })}
              />
              Booking requests
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifyReviews}
                onChange={(event) => setForm({ ...form, notifyReviews: event.target.checked })}
              />
              New reviews
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifyPayouts}
                onChange={(event) => setForm({ ...form, notifyPayouts: event.target.checked })}
              />
              Payout updates
            </label>
          </fieldset>
          <div>
            <FieldLabel htmlFor="payout">Payout method</FieldLabel>
            <SelectInput
              id="payout"
              value={form.payoutMethod}
              onChange={(event) => setForm({ ...form, payoutMethod: event.target.value as SettingsDraft['payoutMethod'] })}
            >
              <option value="upi">UPI</option>
              <option value="bank">Bank transfer</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="detail">Payout detail</FieldLabel>
            <TextInput
              id="detail"
              value={form.payoutDetail}
              onChange={(event) => setForm({ ...form, payoutDetail: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.publicProfile}
              onChange={(event) => setForm({ ...form, publicProfile: event.target.checked })}
            />
            Show public profile to candidates
          </label>
          <Button type="submit">Save settings</Button>
        </form>
      </Card>
    </div>
  )
}
