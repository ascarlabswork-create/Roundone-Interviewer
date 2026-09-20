import { type FormEvent, useEffect, useState } from 'react'
import { NotificationPreferencesSection } from '../components/settings/NotificationPreferencesSection.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, FieldLabel, PageHeader, Skeleton, TextInput } from '../components/ui/primitives.tsx'
import { SuggestedSelect } from '../components/ui/suggestions.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import { updateInterviewerProfile } from '../services/interviewerProfile.ts'

export function SettingsPage() {
  const { account, error, refreshAccount, status } = useSession()
  const { pushToast } = useToast()
  const [timezone, setTimezone] = useState(account?.profile.timezone ?? 'Asia/Kolkata')
  const [phone, setPhone] = useState(account?.phone ?? '')
  const [isListed, setIsListed] = useState(account?.interviewer.is_listed ?? false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return
    setTimezone(account.profile.timezone)
    setPhone(account.phone)
    setIsListed(account.interviewer.is_listed)
  }, [account])

  if (status === 'loading') return <Skeleton className="h-64" />
  if (!account) {
    return <ErrorState title="Could not load settings" body={error ?? 'Your interviewer profile is not ready yet.'} />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await updateInterviewerProfile({ timezone, phone, isListed })
      await refreshAccount()
      pushToast('Settings saved')
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Account and optional notification preferences. Payouts are not managed here." />
      <NotificationPreferencesSection />
      <Card className="p-6">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput id="email" value={account.email} disabled />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <TextInput id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="tz">Timezone</FieldLabel>
            <SuggestedSelect
              id="tz"
              options={TIMEZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
              value={timezone}
              onChange={setTimezone}
              customPlaceholder="Type a timezone, e.g. Europe/Berlin"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isListed} onChange={(event) => setIsListed(event.target.checked)} />
            List my profile to candidates
          </label>
          {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
