import { useEffect, useRef, useState } from 'react'
import { isGoogleIdentityOriginAllowed } from '../../lib/googleAuthOrigins.ts'
import {
  createGoogleNonce,
  googleIdentityConfig,
  loadGoogleIdentity,
} from '../../lib/googleOneTap.ts'
import { authErrorMessage, signInWithGoogleIdToken } from '../../services/auth.ts'
import { useSession } from '../../state/session.tsx'
import { Button } from '../ui/Button.tsx'
import { GoogleIcon } from '../ui/GoogleIcon.tsx'

/**
 * Continue with Google via Google Identity on this origin (jobround.ai),
 * not the Supabase redirect that shows fhcrxjrqtojixgqemofp.supabase.co.
 */
export function GoogleContinueButton({
  disabled,
  onError,
}: {
  disabled?: boolean
  onError: (message: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const { refreshAccount } = useSession()
  const [busy, setBusy] = useState(false)
  const originAllowed = isGoogleIdentityOriginAllowed()

  useEffect(() => {
    if (disabled || busy || !originAllowed) return
    const parent = hostRef.current
    if (!parent) return

    let cancelled = false
    parent.replaceChildren()

    void (async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])
        if (cancelled) return
        google.initialize(
          googleIdentityConfig(nonce.hashed, (response) => {
            if (!response.credential) return
            setBusy(true)
            void signInWithGoogleIdToken(response.credential, nonce.raw)
              .then(() => refreshAccount())
              .catch((caught: unknown) => {
                setBusy(false)
                onErrorRef.current(authErrorMessage(caught))
              })
          }),
        )
        google.renderButton(parent, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: Math.max(parent.offsetWidth, 320),
        })
      } catch (caught) {
        if (!cancelled) onErrorRef.current(authErrorMessage(caught))
      }
    })()

    return () => {
      cancelled = true
      parent.replaceChildren()
    }
  }, [busy, disabled, originAllowed, refreshAccount])

  return (
    <div className="relative">
      <Button type="button" variant="outline" fullWidth disabled={disabled || busy || !originAllowed}>
        <GoogleIcon className="h-4 w-4" />
        {busy ? 'Signing in…' : 'Continue with Google'}
      </Button>
      {disabled || busy || !originAllowed ? null : (
        <div
          ref={hostRef}
          className="absolute inset-0 z-10 overflow-hidden opacity-0"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
