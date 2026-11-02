import { GOOGLE_OAUTH_WEB_CLIENT_ID } from './googleAuthOrigins.ts'

/** Google Identity Services (One Tap) helpers. The OAuth client ID is public by design. */
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

export function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || GOOGLE_OAUTH_WEB_CLIENT_ID
}

export type GoogleCredentialResponse = { credential?: string }

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce: string
  auto_select: boolean
  cancel_on_tap_outside: boolean
  context: 'signin' | 'signup' | 'use'
  itp_support: boolean
  use_fedcm_for_prompt: boolean
}

export type GooglePromptNotification = {
  isNotDisplayed(): boolean
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
}

export type GoogleButtonConfiguration = {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

export type GoogleAccountsId = {
  initialize(config: GoogleIdConfiguration): void
  prompt(listener?: (notification: GooglePromptNotification) => void): void
  cancel(): void
  renderButton(parent: HTMLElement, config: GoogleButtonConfiguration): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let scriptPromise: Promise<GoogleAccountsId> | null = null

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else reject(new Error('Google sign-in did not load.'))
    }
    script.onerror = () => reject(new Error('Google sign-in could not be loaded.'))
    document.head.appendChild(script)
  })
  scriptPromise.catch(() => {
    scriptPromise = null
  })
  return scriptPromise
}

/**
 * Google embeds the hashed nonce in the ID token; Supabase receives the raw
 * nonce, hashes it and compares, so a stolen token cannot be replayed.
 */
export function googleIdentityConfig(
  nonceHashed: string,
  callback: (response: GoogleCredentialResponse) => void,
): GoogleIdConfiguration {
  return {
    client_id: googleClientId(),
    nonce: nonceHashed,
    auto_select: false,
    cancel_on_tap_outside: false,
    context: 'signin',
    itp_support: true,
    use_fedcm_for_prompt: false,
    callback,
  }
}

/** Opens Google's account picker on this site (jobround.ai), not *.supabase.co. */
export async function requestGoogleIdCredential(): Promise<{ credential: string; rawNonce: string }> {
  const google = await loadGoogleIdentity()
  const nonce = await createGoogleNonce()
  return new Promise((resolve, reject) => {
    google.initialize(
      googleIdentityConfig(nonce.hashed, (response) => {
        if (!response.credential) {
          reject(new Error('Google sign-in was cancelled.'))
          return
        }
        resolve({ credential: response.credential, rawNonce: nonce.raw })
      }),
    )
    google.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error('Google sign-in did not open. Check that this site is allowlisted as a JavaScript origin for jobround.ai.'))
      }
    })
  })
}

export async function createGoogleNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = btoa(String.fromCharCode(...bytes))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}
