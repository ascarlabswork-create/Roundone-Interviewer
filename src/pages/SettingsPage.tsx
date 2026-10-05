import { type FormEvent, useEffect, useState } from 'react'
import { DeleteAccountCard } from '../components/settings/DeleteAccountCard.tsx'
import { NotificationPreferencesSection } from '../components/settings/NotificationPreferencesSection.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, FieldLabel, PageHeader, Skeleton, TextInput } from '../components/ui/primitives.tsx'
import { SuggestedSelect } from '../components/ui/suggestions.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import { updateInterviewerProfile } from '../services/interviewerProfile.ts'
import {
  normalizeWhatsappPhone,
  WHATSAPP_PHONE_INVALID,
  WHATSAPP_PHONE_MISSING_COUNTRY_CODE,
} from '../lib/whatsappPhone.ts'

const FRIENDLY_SAVE_ERRORS = new Set([WHATSAPP_PHONE_INVALID, WHATSAPP_PHONE_MISSING_COUNTRY_CODE])

export function SettingsPage() {
  const { account, error, refreshAccount, status } = useSession()
  const { pushToast } = useToast()
  const [timezone, setTimezone] = useState(account?.profile.timezone ?? 'Asia/Kolkata')
  const [phone, setPhone] = useState(account?.phone ?? '')
  const [whatsappPhone, setWhatsappPhone] = useState(account?.interviewer.whatsapp_phone ?? '')
  const [whatsappError, setWhatsappError] = useState<string | null>(null)
  const [isListed, setIsListed] = useState(account?.interviewer.is_listed ?? false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return
    setTimezone(account.profile.timezone)
    setPhone(account.phone)
    setWhatsappPhone(account.interviewer.whatsapp_phone ?? '')
    setIsListed(account.interviewer.is_listed)
  }, [account])

  if (status === 'loading') return <Skeleton className="h-64" />
  if (!account) {
    return <ErrorState title="Could not load settings" body={error ?? 'Your interviewer profile is not ready yet.'} />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    const normalizedWhatsapp = normalizeWhatsappPhone(whatsappPhone)
    if (!normalizedWhatsapp.ok) {
      setWhatsappError(normalizedWhatsapp.error)
      return
    }
    setWhatsappError(null)
    setSaving(true)
    try {
      await updateInterviewerProfile({ timezone, phone, isListed, whatsappPhone: normalizedWhatsapp.value })
      await refreshAccount()
      pushToast('Settings saved')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : ''
      if (FRIENDLY_SAVE_ERRORS.has(message)) setWhatsappError(message)
      else setSaveError('Could not save settings. Try again.')
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
            <FieldLabel htmlFor="whatsapp-phone">WhatsApp Number</FieldLabel>
            <TextInput
              id="whatsapp-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={whatsappPhone}
              aria-invalid={whatsappError ? true : undefined}
              aria-describedby="whatsapp-phone-help"
              onChange={(event) => {
                setWhatsappPhone(event.target.value)
                if (whatsappError) setWhatsappError(null)
              }}
            />
            <p id="whatsapp-phone-help" className="mt-1 text-xs text-slate-500">
              Used for jobround.ai interview booking notifications. Include your country code. Kept private and never
              shown to candidates.
            </p>
            {whatsappError ? <p className="mt-1 text-sm text-red-700">{whatsappError}</p> : null}
          </div>
          <div>
            <FieldLabel htmlFor="tz">Timezone</FieldLabel>
            <SuggestedSelect
              id="tz"
              options={TIMEZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
              value={timezone}
              onChange={setTimezone}
              customPlaceholder="Search, e.g. America/Chicago or Asia/Kolkata"
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
      <DeleteAccountCard />
    </div>
  )
}
