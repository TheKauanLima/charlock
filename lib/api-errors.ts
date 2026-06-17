import { ZodError } from 'zod'

interface ErrorWithStatus {
  status?: number
  message?: string
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
    return Response.json({ error: getZodIssueMessage(error, 'Invalid request payload') }, { status: 400 })
  }

  if (error instanceof ApiRequestError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  if (isErrorWithStatus(error) && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    return Response.json({ error: getErrorMessage(error, fallback) }, { status: error.status })
  }

  const errorId = getErrorId()
  const message = getErrorMessage(error, fallback)

  console.error(`[api-error:${errorId}]`, error)

  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { error: 'Something went wrong. Please try again later.', errorId },
      { status: 500 },
    )
  }

  return Response.json(
    {
      error: message,
      errorId,
      stack: error instanceof Error ? error.stack : undefined,
    },
    { status: 500 },
  )
}
