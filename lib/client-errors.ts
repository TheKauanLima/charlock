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
    return 'Your session has expired. Sign in again, then retry; your draft is still saved locally.'
  }

  if (code === 'SERVER_ERROR') {
    return 'The server could not save your character. Your draft is safe; please retry.'
  }

  if (/ability[1-4]Icon/i.test(message)) {
    return 'One or more ability icons were missing. Default icons have been restored; retry the save.'
  }

  if (/validation failed/i.test(message)) {
    return 'Character data is incomplete. Review the editor fields and retry the save.'
  }

  return message
}
