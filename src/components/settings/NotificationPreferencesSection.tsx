import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn.ts'
import {
  getMyNotificationPreferences,
  updateMyNotificationPreference,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from '../../services/interviewerNotificationPreferences.ts'
import { Card, ErrorState, Skeleton } from '../ui/primitives.tsx'

const OPTIONS: Array<{
  key: NotificationPreferenceKey
  label: string
  description: string
}> = [
  {
    key: 'bookingUpdates',
    label: 'Interview reminders',
    description: 'Get a reminder shortly before a confirmed interview starts.',
  },
  {
    key: 'feedbackUpdates',
    label: 'Feedback updates',
    description: 'Get notified when interview feedback is ready.',
  },
]

function PreferenceSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-navy-950' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left]',
          checked ? 'left-5' : 'left-0.5',
        )}
      />
    </button>
  )
}

export function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null)
  const [savedKey, setSavedKey] = useState<NotificationPreferenceKey | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function load() {
    setStatus('loading')
    setError(null)
    try {
      const next = await getMyNotificationPreferences()
      setPrefs(next)
      setStatus('success')
    } catch (caught) {
      setPrefs(null)
      setStatus('error')
      setError(
        caught instanceof Error ? caught.message : 'Could not load notification preferences. Check your connection and try again.',
      )
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!savedKey) return
    const timer = window.setTimeout(() => setSavedKey(null), 1600)
    return () => window.clearTimeout(timer)
  }, [savedKey])

  async function onToggle(key: NotificationPreferenceKey, next: boolean) {
    if (!prefs || savingKey) return
    const previous = prefs
    setPrefs({ ...prefs, [key]: next })
    setSavingKey(key)
    setSavedKey(null)
    setSaveError(null)
    try {
      const stored = await updateMyNotificationPreference(key, next)
      setPrefs(stored)
      setSavedKey(key)
    } catch (caught) {
      setPrefs(previous)
      setSaveError(caught instanceof Error ? caught.message : 'Could not save that preference. Try again.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <Card className="p-6">
      <div id="notification-preferences">
        <h2 className="text-lg font-semibold text-navy-950">Notification Preferences</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose optional alerts. Booking requests, cancellations, and reschedules are always sent.
        </p>
      </div>

      {status === 'loading' ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="mt-5">
          <ErrorState
            title="Could not load preferences"
            body={error ?? 'Could not load notification preferences. Check your connection and try again.'}
            onRetry={() => void load()}
          />
        </div>
      ) : null}

      {status === 'success' && prefs ? (
        <div className="mt-5 divide-y divide-slate-100">
          {OPTIONS.map((option) => {
            const checked = prefs[option.key]
            const saving = savingKey === option.key
            const saved = savedKey === option.key
            return (
              <div key={option.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-950">{option.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                  {saving ? <p className="mt-1 text-xs font-medium text-slate-500">Saving…</p> : null}
                  {saved ? <p className="mt-1 text-xs font-medium text-emerald-700">Saved</p> : null}
                </div>
                <PreferenceSwitch
                  checked={checked}
                  disabled={Boolean(savingKey)}
                  label={option.label}
                  onChange={(next) => void onToggle(option.key, next)}
                />
              </div>
            )
          })}
          {saveError ? <p className="pt-3 text-sm text-red-700">{saveError}</p> : null}
        </div>
      ) : null}
    </Card>
  )
}
