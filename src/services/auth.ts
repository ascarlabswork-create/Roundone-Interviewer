import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

export type AppRole = 'candidate' | 'interviewer' | 'admin'

export type SignUpInterviewerInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  linkedin: string
  phone?: string
  timezone?: string
  currentRole?: string
  company?: string
  experienceYears?: number
}

export type SignInInput = {
  email: string
  password: string
}

export type SignUpResult = {
  user: User | null
  sessionCreated: boolean
  needsEmailConfirmation: boolean
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export function fullNameFromParts(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('session') || error.name === 'AuthSessionMissingError') return null
    throw new Error(error.message)
  }
  return data.user ?? null
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new Error('You need to sign in to continue.')
  return user
}

export async function signUpInterviewer(input: SignUpInterviewerInput): Promise<SignUpResult> {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const fullName = fullNameFromParts(firstName, lastName)
  if (!fullName) throw new Error('Enter your first and last name.')
  if (!input.linkedin.trim()) throw new Error('Enter your LinkedIn profile URL.')

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        role: 'interviewer',
        timezone: input.timezone?.trim() || 'Asia/Kolkata',
        linkedin: input.linkedin.trim(),
        phone: input.phone?.trim() || '',
        current_role: input.currentRole?.trim() || '',
        company: input.company?.trim() || '',
        experience_years: String(input.experienceYears ?? 0),
      },
    },
  })
  fail(error)

  return {
    user: data.user ?? null,
    sessionCreated: Boolean(data.session),
    needsEmailConfirmation: Boolean(data.user) && !data.session,
  }
}

export async function signInInterviewer(input: SignInInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })
  fail(error)
  if (!data.user || !data.session) {
    throw new Error('Sign in did not create a session.')
  }
  return data.user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  fail(error)
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => data.subscription.unsubscribe()
}

export async function updateAuthMetadata(data: Record<string, string>) {
  const { error } = await supabase.auth.updateUser({ data })
  fail(error)
}
