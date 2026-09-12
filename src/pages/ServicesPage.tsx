import { useState } from 'react'
import { deactivateService, duplicateService, listServices, platformFeeFor, saveService } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { SlideOver } from '../components/ui/dashboard.tsx'
import { Badge, Card, Chip, FieldLabel, PageHeader, SelectInput, Skeleton, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { CANDIDATE_LEVELS, INTERVIEW_TYPES, TARGET_ROLES, type InterviewType } from '../data/catalogs.ts'
import { formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { useToast } from '../state/toast.tsx'
import type { Service } from '../types.ts'

const emptyService = (): Service => ({
  id: `svc-${Date.now()}`,
  name: '',
  interviewType: 'Coding',
  durationMin: 60,
  price: 1000,
  description: '',
  candidateLevels: ['SDE 2'],
  targetRoles: ['Software Engineer'],
  cancellationPolicy: 'Full refund if cancelled 24 hours before the session.',
  isActive: true,
})

export function ServicesPage() {
  const state = useAsync(() => listServices(), [])
  const { pushToast } = useToast()
  const [editing, setEditing] = useState<Service | null>(null)

  async function onDuplicate(id: string) {
    await duplicateService(id)
    pushToast('Service duplicated')
    state.reload()
  }

  async function onToggle(id: string) {
    const next = await deactivateService(id)
    pushToast(next.isActive ? 'Service activated' : 'Service deactivated')
    state.reload()
  }

  async function onSave() {
    if (!editing) return
    await saveService(editing)
    pushToast('Service saved')
    setEditing(null)
    state.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Interview Services"
        subtitle="What candidates can book from your public profile."
        actions={
          <Button onClick={() => setEditing(emptyService())}>Create New Service</Button>
        }
      />

      {state.status === 'loading' ? <Skeleton className="h-48" /> : null}

      {state.status === 'success' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {state.data.map((service) => (
            <Card key={service.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-navy-950">{service.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {service.interviewType} · {service.durationMin} minutes
                  </p>
                </div>
                <p className="text-xl font-semibold text-navy-950">{formatINR(service.price)}</p>
              </div>
              <p className="mt-3 text-sm text-slate-600">{service.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Candidate pays {formatINR(service.price + platformFeeFor(service.price))} including platform fee.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {service.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                {service.candidateLevels.map((level) => (
                  <Badge key={level}>{level}</Badge>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(service)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDuplicate(service.id)}>
                  Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onToggle(service.id)}>
                  {service.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <SlideOver title={editing?.name ? 'Edit service' : 'Create New Service'} open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing ? (
          <div className="grid gap-4">
            <div>
              <FieldLabel htmlFor="name">Service Name</FieldLabel>
              <TextInput id="name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="type">Interview Type</FieldLabel>
              <SelectInput
                id="type"
                value={editing.interviewType}
                onChange={(event) => setEditing({ ...editing, interviewType: event.target.value as InterviewType })}
              >
                {INTERVIEW_TYPES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectInput>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="dur">Duration</FieldLabel>
                <TextInput
                  id="dur"
                  type="number"
                  value={editing.durationMin}
                  onChange={(event) => setEditing({ ...editing, durationMin: Number(event.target.value) })}
                />
              </div>
              <div>
                <FieldLabel htmlFor="price">Price</FieldLabel>
                <TextInput
                  id="price"
                  type="number"
                  value={editing.price}
                  onChange={(event) => setEditing({ ...editing, price: Number(event.target.value) })}
                />
              </div>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Candidate Levels</legend>
              <div className="flex flex-wrap gap-2">
                {CANDIDATE_LEVELS.map((level) => (
                  <Chip
                    key={level}
                    active={editing.candidateLevels.includes(level)}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        candidateLevels: toggle(editing.candidateLevels, level),
                      })
                    }
                  >
                    {level}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Target Roles</legend>
              <div className="flex flex-wrap gap-2">
                {TARGET_ROLES.map((role) => (
                  <Chip
                    key={role}
                    active={editing.targetRoles.includes(role)}
                    onClick={() => setEditing({ ...editing, targetRoles: toggle(editing.targetRoles, role) })}
                  >
                    {role}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div>
              <FieldLabel htmlFor="desc">Description</FieldLabel>
              <TextArea
                id="desc"
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="policy">Cancellation Policy</FieldLabel>
              <TextArea
                id="policy"
                value={editing.cancellationPolicy}
                onChange={(event) => setEditing({ ...editing, cancellationPolicy: event.target.value })}
              />
            </div>
            <Button onClick={onSave}>Save service</Button>
          </div>
        ) : null}
      </SlideOver>
    </div>
  )
}

function toggle<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
