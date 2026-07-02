import { describe, expect, it, beforeEach } from 'vitest'

import nextConfig from '@/next.config'
import { authEmailRequestSchema, customHeroSaveSchema, heroCommentRequestSchema, stripDatabaseMetadata } from '@/lib/custom-hero-schemas'
import { isDatabaseConnectionError } from '@/lib/dbConnect'
import { checkRateLimit, resetRateLimitStore } from '@/lib/rate-limit'
import { contentReportRequestSchema, moderationResolveRequestSchema } from '@/lib/moderation-schemas'

beforeEach(() => {
  resetRateLimitStore()
})

describe('security hardening', () => {
  it('adds the required security headers and CSP allowances', async () => {
    const headersConfig = await nextConfig.headers?.()
    const headers = new Map(headersConfig?.[0]?.headers.map(header => [header.key, header.value]))
    const csp = headers.get('Content-Security-Policy') ?? ''
    const directives = new Map(csp.split('; ').map(directive => {
      const [name, ...sources] = directive.split(' ')

      return [name, sources]
    }))
    const scriptSrc = directives.get('script-src') ?? []
    const connectSrc = directives.get('connect-src') ?? []
    const imgSrc = directives.get('img-src') ?? []
    const frameSrc = directives.get('frame-src') ?? []

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(csp).toContain("default-src 'self'")
    expect(scriptSrc).toEqual(expect.arrayContaining(['*.clerk.com', 'https://clerk.cursedconcepts.xyz', 'https://challenges.cloudflare.com']))
    expect(connectSrc).toEqual(expect.arrayContaining(['*.clerk.com', 'https://clerk.cursedconcepts.xyz', 'https://cursedconcepts.xyz', 'https://challenges.cloudflare.com']))
    expect(imgSrc).toEqual(expect.arrayContaining(['https://clerk.cursedconcepts.xyz']))
    expect(frameSrc).toEqual(expect.arrayContaining(['*.clerk.com', 'https://clerk.cursedconcepts.xyz', 'https://cursedconcepts.xyz', 'https://challenges.cloudflare.com']))
    expect(csp).toContain('https://*.clerk.accounts.dev')
    expect(csp).toContain('*.uploadthing.com')
    expect(csp).toContain('fonts.googleapis.com')
    expect(csp).toContain('utfs.io')
  })

  it('allows production Clerk avatar images through Next image remote patterns', () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: 'https',
          hostname: 'clerk.cursedconcepts.xyz',
        }),
        expect.objectContaining({
          protocol: 'https',
          hostname: 'utfs.io',
        }),
      ]),
    )
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

    expect(() => contentReportRequestSchema.parse({
      reason: 'Spam / Irrelevant',
      reporterId: 'attacker-selected-id',
    })).toThrow()

    expect(() => moderationResolveRequestSchema.parse({
      type: 'hero',
      id: 'hero_1',
      action: 'approve',
      moderationStatus: 'clean',
    })).toThrow()
  })

  it('removes leaked Mongo metadata without weakening strict payload validation', () => {
    const sanitized = stripDatabaseMetadata({
      name: 'Loaded Hero',
      hero: { render: '/render/loaded.png' },
      weapon: {
        stats: [{
          _id: 'mongo-subdocument-id',
          __v: 0,
          label: 'Weapon Damage',
          value: '22',
        }],
      },
    })
    const parsed = customHeroSaveSchema.parse(sanitized)

    expect(parsed.weapon.stats?.[0]).toEqual({ label: 'Weapon Damage', value: '22' })
    expect(() => customHeroSaveSchema.parse(stripDatabaseMetadata({
      name: 'Still Strict',
      hero: { render: '/render/strict.png', injected: true },
    }))).toThrow()
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
