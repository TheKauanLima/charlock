import { ApiRequestError } from '@/lib/api-errors'

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value)

    return url.origin
  } catch {
    return value.replace(/\/+$/, '')
  }
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return request.headers.get('x-real-ip')
    ?? request.headers.get('cf-connecting-ip')
    ?? 'unknown'
}

export function requireJsonContentType(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiRequestError('Content-Type must be application/json', 415)
  }
}

export function verifyRequestOrigin(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
    : new URL(request.url).origin

  if (!requestOrigin || normalizeOrigin(requestOrigin) !== allowedOrigin) {
    throw new ApiRequestError('Request origin is not allowed', 403)
  }
}

export function enforceJsonMutationRequest(request: Request) {
  requireJsonContentType(request)
  verifyRequestOrigin(request)
}

export async function readJsonRequestBody(request: Request) {
  try {
    return await request.json() as unknown
  } catch {
    throw new ApiRequestError('Invalid JSON request body', 400)
  }
}
