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
 * Continue with Google via Google Identity on this origin (experts.jobround.ai).
 * Renders Google's real button (not an opacity-0 overlay) so clicks work inside auth modals.
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
  const [failed, setFailed] = useState(false)
  const originAllowed = isGoogleIdentityOriginAllowed()

  useEffect(() => {
    if (disabled || busy || !originAllowed || failed) return
    const parent = hostRef.current
    if (!parent) return

    let cancelled = false

    void (async () => {
      try {
        // Wait for auth-modal layout/animation so the host has a real width.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        await new Promise((resolve) => window.setTimeout(resolve, 80))
        if (cancelled || !hostRef.current) return

        const [google, nonce] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])
        if (cancelled || !hostRef.current) return

        hostRef.current.replaceChildren()
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

        const width = Math.max(Math.floor(hostRef.current.getBoundingClientRect().width), 280)
        google.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width,
        })
      } catch (caught) {
        if (!cancelled) {
          setFailed(true)
          onErrorRef.current(authErrorMessage(caught))
        }
      }
    })()

    return () => {
      cancelled = true
      parent.replaceChildren()
    }
  }, [busy, disabled, failed, originAllowed, refreshAccount])

  if (!originAllowed) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" fullWidth disabled>
          <GoogleIcon className="h-4 w-4" />
          Continue with Google
        </Button>
        <p className="text-center text-xs text-slate-500">
          Google sign-in is only available on experts.jobround.ai and local dev.
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        className={`flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl ${
          disabled || busy ? 'pointer-events-none opacity-60' : ''
        }`}
      />
      {busy ? <p className="mt-2 text-center text-xs text-slate-500">Signing in with Google…</p> : null}
      {failed ? (
        <p className="mt-2 text-center text-xs text-red-700">
          Google button could not load. Use email sign-in, or refresh and try again.
        </p>
      ) : null}
    </div>
  )
}
