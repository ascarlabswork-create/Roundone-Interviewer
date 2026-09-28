const E164_PATTERN = /^\+[1-9]\d{7,14}$/

export const WHATSAPP_PHONE_INVALID =
  'Enter a valid WhatsApp number with country code, for example +91 98765 43210.'
export const WHATSAPP_PHONE_MISSING_COUNTRY_CODE =
  'Include your country code, starting with + (for example +91 98765 43210).'

export type WhatsappPhoneResult = { ok: true; value: string | null } | { ok: false; error: string }

/** Normalizes user input to E.164. Empty input clears the number; a country code is never guessed. */
export function normalizeWhatsappPhone(input: string): WhatsappPhoneResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: true, value: null }
  if (/[^\d+\s().-]/.test(trimmed)) return { ok: false, error: WHATSAPP_PHONE_INVALID }

  let compact = trimmed.replace(/[\s().-]/g, '')
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`
  if (!compact.startsWith('+')) return { ok: false, error: WHATSAPP_PHONE_MISSING_COUNTRY_CODE }
  if (!E164_PATTERN.test(compact)) return { ok: false, error: WHATSAPP_PHONE_INVALID }
  return { ok: true, value: compact }
}
