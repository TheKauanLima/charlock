export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'

export interface ApiErrorPayload {
  error?: string
  code?: ApiErrorCode
  errorId?: string
  retryable?: boolean
}

export interface ClientRequestError {
  code: ApiErrorCode
  message: string
  retryable: boolean
  isSessionExpired: boolean
}

function getCodeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 400 && status < 500) return 'INVALID_REQUEST'
  if (status >= 500) return 'SERVER_ERROR'
  return 'UNKNOWN_ERROR'
}

function isAuthenticationRedirect(response: Response) {
  if (!response.redirected) return false

  try {
    const pathname = new URL(response.url).pathname

    return pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')
  } catch {
    return false
  }
}

export async function readApiResponse<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text()

    return text.trim() ? JSON.parse(text) as T : null
  } catch {
    return null
  }
}

export function parseClientRequestError(response: Response, payload: ApiErrorPayload | null, fallback: string): ClientRequestError {
  const code = payload?.code ?? (isAuthenticationRedirect(response) ? 'AUTH_REQUIRED' : getCodeFromStatus(response.status))
  const retryable = payload?.retryable ?? (response.status >= 500 || response.status === 429)

  return {
    code,
    message: payload?.error || fallback,
    retryable,
    isSessionExpired: code === 'AUTH_REQUIRED' || code === 'FORBIDDEN',
  }
}

export function getNetworkRequestError(error: unknown, fallback: string): ClientRequestError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  return {
    code: 'NETWORK_ERROR',
    message: offline ? 'Network connection is offline.' : error instanceof Error && error.message ? error.message : fallback,
    retryable: true,
    isSessionExpired: false,
  }
}

export function getUserFacingSaveError(message: string, code: ApiErrorCode = 'UNKNOWN_ERROR') {
  if (code === 'AUTH_REQUIRED' || code === 'FORBIDDEN') {
    return 'Your sign-in session expired. Sign in again, then retry saving; your draft is still stored locally.'
  }

  if (code === 'RATE_LIMITED') {
    return 'Too many save attempts were made in a short time. Wait about a minute, then retry saving.'
  }

  if (code === 'SERVER_ERROR') {
    return 'The server could not save your character. Your draft is safe; please retry.'
  }

  if (code === 'NETWORK_ERROR') {
    return message === 'Network connection is offline.'
      ? 'You are offline. Reconnect, then retry saving; your draft is still stored locally.'
      : 'The network request failed. Check your connection, then retry saving.'
  }

  if (code === 'INVALID_REQUEST') {
    return message || 'Some character fields need changes before this hero can be saved.'
  }

  if (/ability[1-4]Icon/i.test(message)) {
    return 'One or more ability icons were missing. Default icons have been restored; retry the save.'
  }

  if (/validation failed/i.test(message)) {
    return 'Character data is incomplete. Review the editor fields and retry the save.'
  }

  return message
}
