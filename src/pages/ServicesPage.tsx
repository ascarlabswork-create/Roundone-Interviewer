import { useState } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { SlideOver } from '../components/ui/dashboard.tsx'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FieldLabel,
  PageHeader,
  SelectInput,
  Skeleton,
  TextArea,
  TextInput,
} from '../components/ui/primitives.tsx'
import { INTERVIEW_TYPES, type InterviewType } from '../data/catalogs.ts'
import { formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  SERVICE_CURRENCY,
  SERVICE_DURATIONS,
  createService,
  getMyServices,
  paiseToRupees,
  setServiceActive,
  updateService,
  type InterviewerServiceRecord,
} from '../services/interviewerServices.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'

type ServiceForm = {
  id: string | null
  name: string
  interviewType: InterviewType
  durationMin: number
  priceRupees: string
  description: string
  isActive: boolean
}

const emptyForm = (): ServiceForm => ({
  id: null,
  name: '',
  interviewType: 'Coding',
  durationMin: 60,
  priceRupees: '1000',
  description: '',
  isActive: true,
})

function toForm(service: InterviewerServiceRecord): ServiceForm {
  const type = INTERVIEW_TYPES.includes(service.interview_type as InterviewType)
    ? (service.interview_type as InterviewType)
    : 'Coding'
  return {
    id: service.id,
    name: service.name,
    interviewType: type,
    durationMin: service.duration_min,
    priceRupees: String(paiseToRupees(service.price_paise)),
    description: service.description ?? '',
    isActive: service.is_active,
  }
}

function parseRupees(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Price must be a whole number of rupees, with no decimals.')
  }
  return Number(trimmed)
}

export function ServicesPage() {
  const { account } = useSession()
  const state = useAsync(() => getMyServices(), [])
  const { pushToast } = useToast()
  const [form, setForm] = useState<ServiceForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function onToggle(service: InterviewerServiceRecord) {
    try {
      await setServiceActive(service.id, !service.is_active)
      pushToast(service.is_active ? 'Service deactivated' : 'Service activated')
      state.reload()
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update service')
    }
  }

  async function onSave() {
    if (!form) return
    setFormError(null)
    setSaving(true)
    try {
      const priceRupees = parseRupees(form.priceRupees)
      const payload = {
        name: form.name,
        interviewType: form.interviewType,
        durationMin: form.durationMin,
        priceRupees,
        description: form.description,
        isActive: form.isActive,
      }
      if (form.id) {
        await updateService(form.id, payload)
        pushToast('Service saved')
      } else {
        await createService(payload)
        pushToast('Service created')
      }
      setForm(null)
      state.reload()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save service.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Interview Services"
        subtitle="What candidates can book from your public profile. Inactive services stay saved but cannot be booked."
        actions={<Button onClick={() => setForm(emptyForm())}>Create New Service</Button>}
      />

      {account && (account.targetRoles.length > 0 || account.candidateLevels.length > 0) ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-navy-950">Profile expertise used for all services</p>
          <p className="mt-1 text-xs text-slate-500">
            The services table does not store per-service roles or levels. Candidates will later see these from your
            interviewer profile.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {account.targetRoles.map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
            {account.candidateLevels.map((level) => (
              <Badge key={level} tone="blue">
                {level}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {state.status === 'loading' ? <Skeleton className="h-48" /> : null}
      {state.status === 'error' ? <ErrorState body={state.error} onRetry={state.reload} /> : null}
      {state.status === 'success' && state.data.length === 0 ? (
        <EmptyState
          title="No services yet"
          body="Create a mock interview service with a duration and price. Candidates will only be able to book active services."
          action={<Button onClick={() => setForm(emptyForm())}>Create New Service</Button>}
        />
      ) : null}

      {state.status === 'success' && state.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {state.data.map((service) => (
            <Card key={service.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-navy-950">{service.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {service.interview_type} · {service.duration_min} minutes
                  </p>
                </div>
                <p className="text-xl font-semibold text-navy-950">{formatINR(paiseToRupees(service.price_paise))}</p>
              </div>
              <p className="mt-3 text-sm text-slate-600">{service.description || 'No description yet.'}</p>
              <p className="mt-2 text-xs text-slate-500">
                {service.currency || SERVICE_CURRENCY} · stored as {service.price_paise} paise
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {service.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setForm(toForm(service))}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onToggle(service)}>
                  {service.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <SlideOver title={form?.id ? 'Edit service' : 'Create New Service'} open={Boolean(form)} onClose={() => setForm(null)}>
        {form ? (
          <div className="grid gap-4">
            <div>
              <FieldLabel htmlFor="name">Service Name</FieldLabel>
              <TextInput id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="type">Interview Type</FieldLabel>
              <SelectInput
                id="type"
                value={form.interviewType}
                onChange={(event) => setForm({ ...form, interviewType: event.target.value as InterviewType })}
              >
                {INTERVIEW_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="dur">Duration</FieldLabel>
                <SelectInput
                  id="dur"
                  value={String(form.durationMin)}
                  onChange={(event) => setForm({ ...form, durationMin: Number(event.target.value) })}
                >
                  {SERVICE_DURATIONS.map((item) => (
                    <option key={item} value={item}>
                      {item} minutes
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="price">Price (₹)</FieldLabel>
                <TextInput
                  id="price"
                  inputMode="numeric"
                  value={form.priceRupees}
                  onChange={(event) => setForm({ ...form, priceRupees: event.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">Whole rupees only. ₹1,500 is stored as 150000 paise.</p>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="desc">Description</FieldLabel>
              <TextArea
                id="desc"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Active
            </label>
            {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save service'}
            </Button>
          </div>
        ) : null}
      </SlideOver>
    </div>
  )
}
