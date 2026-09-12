import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

export type AppRole = 'candidate' | 'interviewer' | 'admin'

export type SignUpInterviewerInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  phone?: string
  timezone?: string
  currentRole: string
  company: string
  experienceYears: number
  linkedin: string
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

/** Path OAuth/redirect flows return to. Kept relative so the origin stays dynamic. */
export const OAUTH_CALLBACK_PATH = '/interviewer/auth/callback'

export function isUnconfirmedEmailError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.toLowerCase()
  return (
    message.includes('email not confirmed') ||
    message.includes('not confirmed') ||
    message.includes('confirm your email')
  )
}

export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (isUnconfirmedEmailError(error) || message.includes('confirm your email')) {
    return 'Please confirm your email from the link we sent, then sign in.'
  }
  if (message.includes('invalid email') || message.includes('unable to validate email')) {
    return 'Enter a valid email address.'
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (message.includes('do not match')) {
    return 'Passwords do not match.'
  }
  if (
    message.includes('password should be') ||
    message.includes('weak password') ||
    message.includes('password is known')
  ) {
    return 'Your password must be at least 6 characters.'
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Network error. Check your connection and try again.'
  }
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Google sign-in is not enabled yet. Use email and password, or ask an admin to enable Google in Auth providers.'
  }
  if (message.includes('exchange external code') || message.includes('unexpected_failure')) {
    return 'Google sign-in did not finish. Use email and password for now, or try Google again after the live site URL is allowed in Supabase Auth.'
  }
  return raw || 'Something went wrong. Please try again.'
}

export function oauthRedirectErrorMessage(params: URLSearchParams): string | null {
  const description = params.get('error_description')?.replace(/\+/g, ' ').trim() ?? ''
  const code = params.get('error_code')?.trim() ?? ''
  const error = params.get('error')?.trim() ?? ''
  if (!description && !code && !error) return null
  return authErrorMessage(description || code || error)
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function buildOAuthRedirect(nextPath?: string): string {
  const url = new URL(OAUTH_CALLBACK_PATH, window.location.origin)
  if (nextPath) url.searchParams.set('next', nextPath)
  return url.toString()
}

export function fullNameFromParts(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export function normalizeLinkedInUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter your LinkedIn profile URL.')
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error('Enter a valid LinkedIn URL, such as https://www.linkedin.com/in/your-name.')
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) {
    throw new Error('Enter a LinkedIn profile URL.')
  }
  return parsed.toString()
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
  if (!input.company.trim()) throw new Error('Enter your current company.')
  if (!input.currentRole.trim()) throw new Error('Enter your current role.')
  const linkedin = normalizeLinkedInUrl(input.linkedin)
  const experienceYears = Math.max(0, Math.round(input.experienceYears))
  if (!Number.isFinite(experienceYears) || experienceYears > 60) {
    throw new Error('Enter years of experience between 0 and 60.')
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: buildOAuthRedirect('/interviewer/setup?step=professional'),
      data: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        role: 'interviewer',
        timezone: input.timezone?.trim() || 'Asia/Kolkata',
        linkedin,
        phone: input.phone?.trim() || '',
        current_role: input.currentRole.trim(),
        company: input.company.trim(),
        experience_years: String(experienceYears),
      },
    },
  })
  if (error) throw new Error(authErrorMessage(error))

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
  if (error) throw new Error(authErrorMessage(error))
  if (!data.user || !data.session) {
    throw new Error('Sign in did not create a session.')
  }
  return data.user
}

/**
 * Start Google OAuth. New Google users are created as candidates by the
 * signup trigger (OAuth cannot set role metadata). The interviewer app
 * claims a brand-new empty Google account via claim_interviewer_persona.
 */
export async function signInWithGoogle(nextPath?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: buildOAuthRedirect(nextPath),
    },
  })
  if (error) throw new Error(authErrorMessage(error))
  return data
}

export async function sendPasswordReset(email: string) {
  const trimmed = email.trim()
  if (!trimmed) throw new Error('Enter your email above first, then choose “Forgot password?”.')
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: new URL('/interviewer/login', window.location.origin).toString(),
  })
  if (error) throw new Error(authErrorMessage(error))
}

export async function resendSignupEmail(email: string) {
  const trimmed = email.trim()
  if (!trimmed) throw new Error('Enter your email above first, then resend the confirmation link.')
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmed,
    options: {
      emailRedirectTo: buildOAuthRedirect('/interviewer/setup?step=professional'),
    },
  })
  if (error) throw new Error(authErrorMessage(error))
}

/** Convert a brand-new empty Google candidate stub into an interviewer. */
export async function claimInterviewerPersona(): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_interviewer_persona')
  if (error) return false
  return data === true
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
