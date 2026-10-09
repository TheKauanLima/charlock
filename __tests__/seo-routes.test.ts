import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import robots from '@/app/robots'
import sitemap, {
  dynamic,
  getPublicProfileSitemapEntries,
  getPublishedHeroSitemapEntries,
  getStaticSitemapEntries,
  SITEMAP_HERO_LIMIT,
  SITEMAP_PROFILE_LIMIT,
} from '@/app/sitemap'
import { SITE_URL_FALLBACK } from '@/lib/site-url'

const publicPagesMocks = vi.hoisted(() => ({
  listPublicHeroSitemapEntries: vi.fn(),
  listPublicProfileSitemapEntries: vi.fn(),
}))

// Only the two filtered lib lists are exposed; the sitemap must not query the
// database itself.
const dbConnectMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/public-pages', () => publicPagesMocks)
vi.mock('@/lib/dbConnect', () => ({ default: dbConnectMock }))

const HERO_UPDATED_AT = new Date('2026-03-01T10:00:00.000Z')
const PROFILE_UPDATED_AT = new Date('2026-02-15T08:30:00.000Z')

beforeEach(() => {
  publicPagesMocks.listPublicHeroSitemapEntries.mockReset().mockResolvedValue([])
  publicPagesMocks.listPublicProfileSitemapEntries.mockReset().mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('robots.txt', () => {
  it('allows the site, disallows private routes, and links the sitemap', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/sso-callback', '/profile/settings'],
      },
      sitemap: `${SITE_URL_FALLBACK}/sitemap.xml`,
    })
  })

  it('does not disallow auth pages or the whole profile prefix', () => {
    const rules = robots().rules
    const disallow = Array.isArray(rules) ? [] : [rules.disallow].flat()

    for (const path of ['/sign-in', '/sign-up', '/forgot-password', '/profile', '/profile/']) {
      expect(disallow).not.toContain(path)
    }
  })

  it('uses the configured site url for the sitemap line', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com/ignored')

    expect(robots().sitemap).toBe('https://example.com/sitemap.xml')
  })
})

describe('sitemap.xml', () => {
  const staticEntry = { url: SITE_URL_FALLBACK, changeFrequency: 'weekly', priority: 1 }

  function mockPublicEntries() {
    publicPagesMocks.listPublicHeroSitemapEntries.mockResolvedValue([
      { path: '/characters/abrams-2', lastModified: HERO_UPDATED_AT },
    ])
    publicPagesMocks.listPublicProfileSitemapEntries.mockResolvedValue([
      { path: '/profile/alice', lastModified: PROFILE_UPDATED_AT },
    ])
  }

  it('is rendered per request so next build never connects to the database', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('lists only the canonical home url without lastModified when there are no public pages', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    const entries = await sitemap()

    expect(entries).toEqual([staticEntry])
    for (const entry of entries) {
      expect(entry).not.toHaveProperty('lastModified')
    }
  })

  it('keeps the static producer unchanged', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    expect(getStaticSitemapEntries()).toEqual([{ url: 'http://localhost:3000', changeFrequency: 'weekly', priority: 1 }])
  })

  it('lists static, hero and profile entries with absolute urls and real lastModified', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    mockPublicEntries()

    expect(await sitemap()).toEqual([
      staticEntry,
      {
        url: `${SITE_URL_FALLBACK}/characters/abrams-2`,
        lastModified: HERO_UPDATED_AT,
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: `${SITE_URL_FALLBACK}/profile/alice`,
        lastModified: PROFILE_UPDATED_AT,
        changeFrequency: 'weekly',
        priority: 0.5,
      },
    ])
  })

  it('uses the configured site origin for public entries', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com/ignored/')
    mockPublicEntries()

    const urls = (await sitemap()).map(entry => entry.url)

    expect(urls).toEqual([
      'https://example.com',
      'https://example.com/characters/abrams-2',
      'https://example.com/profile/alice',
    ])
  })

  it('never uses the current time as lastModified', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-09T12:00:00.000Z') })

    try {
      mockPublicEntries()

      const entries = await sitemap()

      for (const entry of entries) {
        if (entry.lastModified !== undefined) {
          expect(new Date(entry.lastModified).getTime()).not.toBe(Date.now())
        }
      }
      expect(entries.filter(entry => entry.lastModified !== undefined)).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('requests the capped lib lists and does not query the database itself', async () => {
    mockPublicEntries()

    await sitemap()

    expect(SITEMAP_HERO_LIMIT).toBe(5000)
    expect(SITEMAP_PROFILE_LIMIT).toBe(5000)
    expect(publicPagesMocks.listPublicHeroSitemapEntries).toHaveBeenCalledTimes(1)
    expect(publicPagesMocks.listPublicHeroSitemapEntries).toHaveBeenCalledWith(SITEMAP_HERO_LIMIT)
    expect(publicPagesMocks.listPublicProfileSitemapEntries).toHaveBeenCalledTimes(1)
    expect(publicPagesMocks.listPublicProfileSitemapEntries).toHaveBeenCalledWith(SITEMAP_PROFILE_LIMIT)
    expect(dbConnectMock).not.toHaveBeenCalled()
  })

  it('keeps the static and profile entries when the hero list fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    mockPublicEntries()
    publicPagesMocks.listPublicHeroSitemapEntries.mockRejectedValue(new Error('db down'))

    expect(await getPublishedHeroSitemapEntries()).toEqual([])
    expect((await sitemap()).map(entry => entry.url)).toEqual([SITE_URL_FALLBACK, `${SITE_URL_FALLBACK}/profile/alice`])
  })

  it('keeps the static and hero entries when the profile list fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    mockPublicEntries()
    publicPagesMocks.listPublicProfileSitemapEntries.mockRejectedValue(new Error('db down'))

    expect(await getPublicProfileSitemapEntries()).toEqual([])
    expect((await sitemap()).map(entry => entry.url)).toEqual([
      SITE_URL_FALLBACK,
      `${SITE_URL_FALLBACK}/characters/abrams-2`,
    ])
  })

  it('returns only the static entry when both lists fail', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    publicPagesMocks.listPublicHeroSitemapEntries.mockRejectedValue(new Error('db down'))
    publicPagesMocks.listPublicProfileSitemapEntries.mockRejectedValue(new Error('db down'))

    expect(await sitemap()).toEqual([staticEntry])
  })
})
