import { ApiRequestError } from '@/lib/api-errors'
import { getClientIp } from '@/lib/api-guards'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  retryAfter: number
}

const buckets = new Map<string, number[]>()

function pruneBucket(timestamps: number[], now: number, windowMs: number) {
  const windowStart = now - windowMs

  return timestamps.filter(timestamp => timestamp > windowStart)
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const timestamps = pruneBucket(buckets.get(key) ?? [], now, windowMs)

  if (timestamps.length >= limit) {
    const oldest = timestamps[0] ?? now

    buckets.set(key, timestamps)

    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  buckets.set(key, [...timestamps, now])

  return {
    allowed: true,
    retryAfter: 0,
  }
}

export function enforceRateLimit(options: RateLimitOptions) {
  const result = checkRateLimit(options)

  if (!result.allowed) {
    throw new ApiRequestError(`Too many requests. Try again in ${result.retryAfter} seconds.`, 429)
  }
}

export function enforceIpRateLimit(request: Request, options: Omit<RateLimitOptions, 'key'> & { namespace: string }) {
  enforceRateLimit({
    key: `${options.namespace}:ip:${getClientIp(request)}`,
    limit: options.limit,
    windowMs: options.windowMs,
  })
}

export function resetRateLimitStore() {
  buckets.clear()
}
