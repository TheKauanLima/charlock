import { ZodError } from 'zod'

interface ErrorWithStatus {
  status?: number
  message?: string
}

function getApiErrorCode(status: number) {
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 400 && status < 500) return 'INVALID_REQUEST'
  return 'SERVER_ERROR'
}

function getApiErrorPayload(message: string, status: number, errorId?: string) {
  return {
    error: message,
    code: getApiErrorCode(status),
    retryable: status >= 500 || status === 429,
    ...(errorId ? { errorId } : {}),
  }
}

function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
  return typeof error === 'object' && error !== null && 'status' in error
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function getErrorId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export function getZodIssueMessage(error: ZodError, fallback: string) {
  const issue = error.issues[0]

  if (!issue) {
    return fallback
  }

  const path = issue.path.length ? `${issue.path.join('.')}: ` : ''

  return `${path}${issue.message}`
}

export function toApiErrorResponse(error: unknown, fallback = 'Request failed') {
  if (error instanceof ZodError) {
    return Response.json(getApiErrorPayload(getZodIssueMessage(error, 'Invalid request payload'), 400), { status: 400 })
  }

  if (error instanceof ApiRequestError) {
    return Response.json(getApiErrorPayload(error.message, error.status), { status: error.status })
  }

  if (isErrorWithStatus(error) && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    return Response.json(getApiErrorPayload(getErrorMessage(error, fallback), error.status), { status: error.status })
  }

  const errorId = getErrorId()
  const message = getErrorMessage(error, fallback)

  console.error(`[api-error:${errorId}]`, error)

  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      getApiErrorPayload('Something went wrong. Please try again later.', 500, errorId),
      { status: 500 },
    )
  }

  return Response.json(
    {
      ...getApiErrorPayload(message, 500, errorId),
      stack: error instanceof Error ? error.stack : undefined,
    },
    { status: 500 },
  )
}
