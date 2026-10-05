export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.'

const NETWORK_FAILURE = /^(TimeoutError|AbortError|TypeError|FetchError|AuthRetryableFetchError)\b|failed to fetch|networkerror|load failed|timed out|<html|<!doctype/i

/** Replaces transport failures (timeouts, dropped connections, gateway HTML pages) with a readable message. */
export function toDisplayError(message: string) {
  return NETWORK_FAILURE.test(message.trim()) ? NETWORK_ERROR_MESSAGE : message
}
