import { describe, expect, it, beforeEach } from 'vitest'

import nextConfig from '@/next.config'
import { authEmailRequestSchema, customHeroSaveSchema, heroCommentRequestSchema } from '@/lib/custom-hero-schemas'
import { isDatabaseConnectionError } from '@/lib/dbConnect'
import { checkRateLimit, resetRateLimitStore } from '@/lib/rate-limit'

beforeEach(() => {
  resetRateLimitStore()
})

describe('security hardening', () => {
  it('adds the required security headers and CSP allowances', async () => {
    const headersConfig = await nextConfig.headers?.()
    const headers = new Map(headersConfig?.[0]?.headers.map(header => [header.key, header.value]))
    const csp = headers.get('Content-Security-Policy') ?? ''

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain('*.clerk.com')
    expect(csp).toContain('https://*.clerk.accounts.dev')
    expect(csp).toContain('*.uploadthing.com')
    expect(csp).toContain('fonts.googleapis.com')
    expect(csp).toContain('utfs.io')
  })

  it('rejects undocumented payload fields with strict Zod schemas', () => {
    expect(() => authEmailRequestSchema.parse({
      email: 'player@example.com',
      type: 'verify_email',
      role: 'admin',
    })).toThrow()

    expect(() => heroCommentRequestSchema.parse({
      content: 'Looks good.',
      createdByUserId: 'attacker',
    })).toThrow()

    expect(() => customHeroSaveSchema.parse({
      name: 'Strict Hero',
      hero: {
        render: '/render/strict.png',
        injected: true,
      },
    })).toThrow()
  })

  it('enforces local sliding-window request limits', () => {
    expect(checkRateLimit({ key: 'test:user', limit: 2, windowMs: 60_000 }).allowed).toBe(true)
    expect(checkRateLimit({ key: 'test:user', limit: 2, windowMs: 60_000 }).allowed).toBe(true)
    expect(checkRateLimit({ key: 'test:user', limit: 2, windowMs: 60_000 }).allowed).toBe(false)
  })

  it('classifies stale Mongoose initial connection errors as database connection errors', () => {
    expect(isDatabaseConnectionError(new Error('Cannot call `users.findOne()` before initial connection is complete if `bufferCommands = false`.'))).toBe(true)
  })
})
