import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

export type AppRole = 'candidate' | 'interviewer' | 'admin'

export type SignUpInterviewerInput = {
  email: string
  password: string
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

export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (message.includes('email not confirmed') || message.includes('not confirmed')) {
    return 'Please confirm your email from the link we sent, then sign in.'
  }
  if (message.includes('invalid email') || message.includes('unable to validate email')) {
    return 'Enter a valid email address.'
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (message.includes('password')) {
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
  return raw || 'Something went wrong. Please try again.'
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
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        role: 'interviewer',
        timezone: 'Asia/Kolkata',
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
