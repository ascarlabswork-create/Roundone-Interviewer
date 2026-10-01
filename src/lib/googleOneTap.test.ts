import { describe, expect, it } from 'vitest'
import { createGoogleNonce, googleClientId } from './googleOneTap.ts'

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('createGoogleNonce', () => {
  it('gives Google the SHA-256 hex of the raw nonce that Supabase verifies', async () => {
    const { raw, hashed } = await createGoogleNonce()
    expect(raw.length).toBeGreaterThanOrEqual(43)
    expect(hashed).toMatch(/^[0-9a-f]{64}$/)
    expect(hashed).toBe(await sha256Hex(raw))
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('is different every time', async () => {
    const [a, b] = await Promise.all([createGoogleNonce(), createGoogleNonce()])
    expect(a.raw).not.toBe(b.raw)
  })
})

describe('googleClientId', () => {
  it('returns a Google web client ID', () => {
    expect(googleClientId()).toMatch(/\.apps\.googleusercontent\.com$/)
  })
})
