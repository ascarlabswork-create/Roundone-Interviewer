import { useEffect } from 'react'
import { createGoogleNonce, googleClientId, loadGoogleIdentity } from '../../lib/googleOneTap.ts'
import { authErrorMessage, signInWithGoogleIdToken } from '../../services/auth.ts'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'

/**
 * Shows Google's "Sign in with Google" One Tap prompt to signed-out visitors.
 * The resulting session goes through the same SessionProvider path as the
 * redirect flow, including claim_interviewer_persona for brand-new accounts.
 */
export function GoogleOneTap() {
  const { status } = useSession()
  const { pushToast } = useToast()

  useEffect(() => {
    if (status !== 'anonymous') return
    let cancelled = false
    let api: Awaited<ReturnType<typeof loadGoogleIdentity>> | null = null

    void (async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])
        if (cancelled) return
        api = google
        google.initialize({
          client_id: googleClientId(),
          nonce: nonce.hashed,
          auto_select: false,
          cancel_on_tap_outside: false,
          context: 'signin',
          itp_support: true,
          use_fedcm_for_prompt: true,
          callback: (response) => {
            if (!response.credential) return
            signInWithGoogleIdToken(response.credential, nonce.raw).catch((caught: unknown) => {
              pushToast(authErrorMessage(caught))
            })
          },
        })
        google.prompt()
      } catch {
        // One Tap is optional; the Continue with Google button still works.
      }
    })()

    return () => {
      cancelled = true
      api?.cancel()
    }
  }, [status, pushToast])

  return null
}
