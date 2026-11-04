import { formatTimezoneLabel } from '../../lib/timezones.ts'

/** Read-only timezone from the user's device. No manual picker. */
export function DetectedTimezoneNote({ timezone }: { timezone: string }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-800">Timezone</p>
      <p className="rounded-xl border border-navy-950/12 bg-paper px-3 py-2.5 text-sm text-navy-950">
        {formatTimezoneLabel(timezone)}
      </p>
      <p className="mt-1.5 text-xs text-slate-500">Detected automatically from your location.</p>
    </div>
  )
}
