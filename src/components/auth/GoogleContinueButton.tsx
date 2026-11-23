import { useEffect, useRef, useState } from 'react'
import { isGoogleIdentityOriginAllowed } from '../../lib/googleAuthOrigins.ts'
import { mountGoogleContinueButton } from '../../lib/googleOneTap.ts'
import { authErrorMessage, signInWithGoogleIdToken, signInWithGoogleOAuth } from '../../services/auth.ts'
import { useSession } from '../../state/session.tsx'
import { Button } from '../ui/Button.tsx'
import { GoogleIcon } from '../ui/GoogleIcon.tsx'

/**
 * Continue with Google on this origin (experts.jobround.ai).
 * Prefers Google's official Identity button; falls back to OAuth redirect if
 * the iframe cannot mount or receive clicks inside the auth modal.
 */
export function GoogleContinueButton({
  disabled,
  onError,
  nextPath,
}: {
  disabled?: boolean
  onError: (message: string) => void
  nextPath?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  const { refreshAccount } = useSession()
  const refreshRef = useRef(refreshAccount)
  onErrorRef.current = onError
  refreshRef.current = refreshAccount

  const [busy, setBusy] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const originAllowed = isGoogleIdentityOriginAllowed()

  useEffect(() => {
    const host = hostRef.current
    if (!host || disabled || !originAllowed) return

    let disposed = false
    let cleanup: (() => void) | undefined

    void (async () => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 150))
        if (disposed || !hostRef.current) return

        cleanup = await mountGoogleContinueButton({
          parent: hostRef.current,
          text: 'continue_with',
          onCredential: async (credential, nonce) => {
            setBusy(true)
            try {
              await signInWithGoogleIdToken(credential, nonce)
              await refreshRef.current()
            } catch (caught) {
              setBusy(false)
              onErrorRef.current(authErrorMessage(caught))
            }
          },
          onError: (message) => onErrorRef.current(message),
        })
        if (disposed) {
          cleanup()
          return
        }
        setGisReady(Boolean(hostRef.current?.querySelector('iframe, div[role="button"]')))
      } catch {
        if (!disposed) setGisReady(false)
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [disabled, originAllowed])

  async function continueWithOAuth() {
    if (disabled || busy) return
    setBusy(true)
    try {
      await signInWithGoogleOAuth(nextPath)
    } catch (caught) {
      setBusy(false)
      onErrorRef.current(authErrorMessage(caught))
    }
  }

  return (
    <div className="w-full space-y-2">
      <div
        ref={hostRef}
        className={`flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl ${
          disabled || busy ? 'pointer-events-none opacity-60' : ''
        } ${gisReady ? '' : 'sr-only'}`}
        aria-hidden={!gisReady}
      />

      {!gisReady ? (
        <Button type="button" variant="outline" fullWidth disabled={disabled || busy} onClick={() => void continueWithOAuth()}>
          <GoogleIcon className="h-4 w-4" />
          {busy ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>
      ) : null}

      {gisReady ? (
        <button
          type="button"
          className="w-full text-center text-xs font-medium text-coral-700 hover:underline"
          disabled={disabled || busy}
          onClick={() => void continueWithOAuth()}
        >
          {busy ? 'Redirecting…' : 'Having trouble? Continue with Google redirect'}
        </button>
      ) : null}

      {busy ? <p className="text-center text-xs text-slate-500">Signing in with Google…</p> : null}
    </div>
  )
}
