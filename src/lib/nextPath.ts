const DEFAULT_NEXT = '/interviewer/dashboard'

export function safeNextPath(value: string | null, fallback = DEFAULT_NEXT) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }
  if (value.startsWith('/interviewer/login') || value.startsWith('/interviewer/register')) {
    return fallback
  }
  return value
}
