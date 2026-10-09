import {
  getNetworkRequestError,
  parseClientRequestError,
  readApiResponse,
  type ApiErrorPayload,
  type ClientRequestError,
} from '@/lib/client-errors'

export type HeroActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClientRequestError; aborted: boolean }

/** Same-origin JSON POST used by the public hero islands (like, bookmark, comments). */
export async function postHeroAction<T>(
  url: string,
  options: { body?: unknown; signal?: AbortSignal; fallback: string },
): Promise<HeroActionResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: options.signal,
    })
    const payload = await readApiResponse<T & ApiErrorPayload>(response)

    if (!response.ok || response.redirected || !payload) {
      return { ok: false, error: parseClientRequestError(response, payload, options.fallback), aborted: false }
    }

    return { ok: true, data: payload }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'

    return { ok: false, error: getNetworkRequestError(error, options.fallback), aborted }
  }
}

export function getHeroActionErrorMessage(error: ClientRequestError, fallback: string) {
  if (error.isSessionExpired) return 'Your session expired. Sign in again to continue.'
  if (error.code === 'RATE_LIMITED') return 'Too many requests. Wait a moment, then try again.'

  return error.message || fallback
}
