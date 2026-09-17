import { getCurrentInterviewer } from './interviewer.ts'
import { TABLES } from './tables.ts'
import { supabase } from '../lib/supabase.ts'

export const SERVICE_CURRENCY = 'INR'
export const PAISE_PER_RUPEE = 100
export const SERVICE_DURATIONS = [30, 45, 60, 90, 120] as const

export type InterviewerServiceRecord = {
  id: string
  interviewer_profile_id: string
  name: string
  interview_type: string
  duration_min: number
  price_paise: number
  currency: string
  description: string | null
  is_active: boolean
  created_at: string
}

export type CreateServiceInput = {
  name: string
  interviewType: string
  durationMin: number
  priceRupees: number
  description?: string
  isActive?: boolean
}

export type UpdateServiceInput = {
  name?: string
  interviewType?: string
  durationMin?: number
  priceRupees?: number
  description?: string | null
  isActive?: boolean
}

const SERVICE_SELECT =
  'id, interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, description, is_active, created_at'

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export function rupeesToPaise(rupees: number) {
  if (!Number.isInteger(rupees) || rupees < 0) {
    throw new Error('Price must be a whole number of rupees, 0 or more.')
  }
  return rupees * PAISE_PER_RUPEE
}

export function paiseToRupees(paise: number) {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error('Stored price is invalid.')
  }
  return (paise - (paise % PAISE_PER_RUPEE)) / PAISE_PER_RUPEE
}

function mapService(row: {
  id: string
  interviewer_profile_id: string
  name: string
  interview_type: string
  duration_min: number
  price_paise: number
  currency: string
  description: string | null
  is_active: boolean
  created_at: string
}): InterviewerServiceRecord {
  return {
    id: row.id,
    interviewer_profile_id: row.interviewer_profile_id,
    name: row.name,
    interview_type: row.interview_type,
    duration_min: row.duration_min,
    price_paise: row.price_paise,
    currency: row.currency,
    description: row.description,
    is_active: row.is_active,
    created_at: row.created_at,
  }
}

function validateWritable(input: {
  name?: string
  interviewType?: string
  durationMin?: number
  priceRupees?: number
}) {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error('Service name is required.')
  }
  if (input.interviewType !== undefined && !input.interviewType.trim()) {
    throw new Error('Enter an interview type.')
  }
  if (input.durationMin !== undefined) {
    if (!Number.isInteger(input.durationMin) || input.durationMin <= 0) {
      throw new Error('Duration must be greater than 0 minutes.')
    }
  }
  if (input.priceRupees !== undefined) {
    rupeesToPaise(input.priceRupees)
  }
}

async function myInterviewerProfileId() {
  const account = await getCurrentInterviewer()
  return account.interviewer.id
}

async function getOwnedService(id: string, interviewerProfileId: string) {
  const { data, error } = await supabase
    .from(TABLES.interviewerServices)
    .select(SERVICE_SELECT)
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  if (!data) throw new Error('Service not found.')
  return mapService(data)
}

export async function getMyServices(): Promise<InterviewerServiceRecord[]> {
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerServices)
    .select(SERVICE_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []).map(mapService)
}

export async function createService(input: CreateServiceInput): Promise<InterviewerServiceRecord> {
  validateWritable({
    name: input.name,
    interviewType: input.interviewType,
    durationMin: input.durationMin,
    priceRupees: input.priceRupees,
  })
  const interviewerProfileId = await myInterviewerProfileId()
  const { data, error } = await supabase
    .from(TABLES.interviewerServices)
    .insert({
      interviewer_profile_id: interviewerProfileId,
      name: input.name.trim(),
      interview_type: input.interviewType.trim(),
      duration_min: input.durationMin,
      price_paise: rupeesToPaise(input.priceRupees),
      currency: SERVICE_CURRENCY,
      description: input.description?.trim() || null,
      is_active: input.isActive ?? true,
    })
    .select(SERVICE_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not create service.')
  return mapService(data)
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<InterviewerServiceRecord> {
  validateWritable({
    name: input.name,
    interviewType: input.interviewType,
    durationMin: input.durationMin,
    priceRupees: input.priceRupees,
  })
  const interviewerProfileId = await myInterviewerProfileId()
  await getOwnedService(id, interviewerProfileId)

  const patch: Record<string, string | number | boolean | null> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.interviewType !== undefined) patch.interview_type = input.interviewType.trim()
  if (input.durationMin !== undefined) patch.duration_min = input.durationMin
  if (input.priceRupees !== undefined) patch.price_paise = rupeesToPaise(input.priceRupees)
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.isActive !== undefined) patch.is_active = input.isActive

  if (Object.keys(patch).length === 0) {
    return getOwnedService(id, interviewerProfileId)
  }

  const { data, error } = await supabase
    .from(TABLES.interviewerServices)
    .update(patch)
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
    .select(SERVICE_SELECT)
    .single()
  fail(error)
  if (!data) throw new Error('Could not update service.')
  return mapService(data)
}

export async function setServiceActive(id: string, isActive: boolean): Promise<InterviewerServiceRecord> {
  return updateService(id, { isActive })
}

export async function deleteService(id: string): Promise<void> {
  const interviewerProfileId = await myInterviewerProfileId()
  await getOwnedService(id, interviewerProfileId)
  const { error } = await supabase
    .from(TABLES.interviewerServices)
    .delete()
    .eq('id', id)
    .eq('interviewer_profile_id', interviewerProfileId)
  fail(error)
}
