import { describe, expect, it, beforeEach } from 'vitest'
import {
  acceptAllConsent,
  buildConsentRecord,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  parseConsentRecord,
  rejectOptionalConsent,
} from './consentModel.ts'
import { createConsentStorageAdapter } from './consentStorage.ts'
import {
  ANALYTICS_INTEGRATION_CONFIGURED,
  getIntegrationSnapshot,
  resetOptionalIntegrationsForTests,
  syncOptionalIntegrations,
} from './optionalIntegrations.ts'

describe('cookie consent model and storage', () => {
  it('defaults to no consent on first visit', () => {
    const store = new Map<string, string>()
    const adapter = createConsentStorageAdapter(store)
    expect(adapter.read()).toBeNull()
  })

  it('persists accept all while keeping unavailable optional categories off', () => {
    const store = new Map<string, string>()
    const adapter = createConsentStorageAdapter(store)
    const accepted = acceptAllConsent(new Date('2026-01-01T00:00:00.000Z'))
    expect(accepted.analytics).toBe(false)
    expect(accepted.marketing).toBe(false)
    expect(adapter.write(accepted)).toBe(true)
    expect(adapter.read()?.updatedAt).toBe(accepted.updatedAt)
  })

  it('persists reject optional', () => {
    const rejected = rejectOptionalConsent()
    expect(rejected.analytics).toBe(false)
    expect(rejected.marketing).toBe(false)
  })

  it('keeps unavailable integrations off when selected in custom preferences', () => {
    const custom = buildConsentRecord({ analytics: true, marketing: true })
    expect(custom.analytics).toBe(false)
    expect(custom.marketing).toBe(false)
  })

  it('restores preferences after reload', () => {
    const store = new Map<string, string>()
    const adapter = createConsentStorageAdapter(store)
    const rejected = rejectOptionalConsent()
    expect(adapter.write(rejected)).toBe(true)
    expect(adapter.read()?.marketing).toBe(false)
  })

  it('rejects invalid or outdated records', () => {
    const rejected = rejectOptionalConsent()
    expect(parseConsentRecord(null)).toBeNull()
    expect(
      parseConsentRecord({
        version: COOKIE_CONSENT_VERSION - 1,
        essential: true,
        analytics: false,
        marketing: false,
        updatedAt: rejected.updatedAt,
      }),
    ).toBeNull()
    expect(
      parseConsentRecord({
        version: COOKIE_CONSENT_VERSION,
        essential: false,
        analytics: false,
        marketing: false,
        updatedAt: rejected.updatedAt,
      }),
    ).toBeNull()
  })

  it('handles storage write failures without throwing', () => {
    class FailingStore extends Map<string, string> {
      override set(_key: string, _value: string): this {
        throw new Error('quota')
      }
    }
    const failing = createConsentStorageAdapter(new FailingStore())
    expect(failing.write(rejectOptionalConsent())).toBe(false)
  })

  it('updates stored record when preferences are withdrawn', () => {
    const store = new Map<string, string>()
    const adapter = createConsentStorageAdapter(store)
    adapter.write(acceptAllConsent())
    adapter.write(rejectOptionalConsent())
    expect(adapter.read()?.marketing).toBe(false)
  })

  it('uses an isolated consent key that does not overlap Supabase auth storage', () => {
    const store = new Map<string, string>()
    const adapter = createConsentStorageAdapter(store)
    adapter.write(rejectOptionalConsent())
    expect(COOKIE_CONSENT_STORAGE_KEY).toBe('roundone-cookie-consent')
    expect([...store.keys()].some((key) => key.startsWith('sb-'))).toBe(false)
  })
})

describe('optional integrations', () => {
  beforeEach(() => {
    resetOptionalIntegrationsForTests()
  })

  it('does not initialize analytics without valid consent', () => {
    syncOptionalIntegrations(null)
    expect(getIntegrationSnapshot().analyticsInitialized).toBe(false)
  })

  it('does not initialize analytics when optional consent is rejected', () => {
    syncOptionalIntegrations(rejectOptionalConsent())
    expect(getIntegrationSnapshot().analyticsInitialized).toBe(false)
  })

  it('does not initialize analytics before consent even when analytics would be allowed', () => {
    syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
    if (ANALYTICS_INTEGRATION_CONFIGURED) {
      expect(getIntegrationSnapshot().analyticsInitialized).toBe(true)
      syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
      expect(getIntegrationSnapshot().analyticsInitialized).toBe(true)
    } else {
      expect(getIntegrationSnapshot().analyticsInitialized).toBe(false)
    }
  })

  it('shuts down optional integrations when consent is withdrawn', () => {
    if (!ANALYTICS_INTEGRATION_CONFIGURED) {
      syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
      syncOptionalIntegrations(rejectOptionalConsent())
      expect(getIntegrationSnapshot().analyticsInitialized).toBe(false)
      return
    }
    syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
    expect(getIntegrationSnapshot().analyticsInitialized).toBe(true)
    syncOptionalIntegrations(rejectOptionalConsent())
    expect(getIntegrationSnapshot().analyticsInitialized).toBe(false)
  })
})
