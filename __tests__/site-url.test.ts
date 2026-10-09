import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSiteUrl, SITE_URL_FALLBACK } from '@/lib/site-url'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getSiteUrl', () => {
  it('uses the production fallback', () => {
    expect(SITE_URL_FALLBACK).toBe('https://cursedconcepts.xyz')
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('falls back when NEXT_PUBLIC_SITE_URL is %s', (_label, value) => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value)

    expect(getSiteUrl()).toBe(SITE_URL_FALLBACK)
  })

  it.each([
    ['https://cursedconcepts.xyz/', 'https://cursedconcepts.xyz'],
    ['  https://example.com/some/path?q=1  ', 'https://example.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
  ])('normalizes %j to its origin', (value, expected) => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value)

    expect(getSiteUrl()).toBe(expected)
  })

  it.each(['not a url', 'ftp://example.com', 'javascript:alert(1)'])('rejects %j and falls back', value => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value)

    expect(() => getSiteUrl()).not.toThrow()
    expect(getSiteUrl()).toBe(SITE_URL_FALLBACK)
  })

  it('reads the environment at call time', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://one.example')
    expect(getSiteUrl()).toBe('https://one.example')

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://two.example')
    expect(getSiteUrl()).toBe('https://two.example')
  })
})
