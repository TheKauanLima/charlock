import { describe, expect, it } from 'vitest'

import nextConfig from '@/next.config'
import type { CreatorProfileSummary } from '@/lib/custom-hero-types'
import { HEROES } from '@/lib/hero-data'
import { serializeJsonLd } from '@/lib/json-ld'
import { UNKNOWN_CREATOR_NAME, type PublicHeroDetail, type PublicProfileSeo } from '@/lib/public-page-types'
import {
  buildHeroJsonLd,
  buildHeroSeoDescription,
  buildProfileJsonLd,
  buildProfileSeoDescription,
  getHeroPath,
  getHeroTags,
  getHeroTemplateHref,
  getPublicProfilePath,
  GUEST_ACTION_HREF,
  HERO_SLUG_PATTERN,
  isProfileIndexable,
  isSafeOgImageUrl,
  isValidHeroSlug,
  OG_IMAGE_REMOTE_HOST_SUFFIXES,
  OG_IMAGE_REMOTE_HOSTS,
  SEO_DESCRIPTION_MAX_LENGTH,
  toAbsoluteSiteUrl,
  toPublicCreator,
} from '@/lib/public-page-utils'

const SITE_URL = 'https://cursedconcepts.xyz'
const abrams = HEROES[0]

function buildHero(overrides: Partial<PublicHeroDetail> = {}): PublicHeroDetail {
  return {
    id: '507f1f77bcf86cd799439011',
    slug: 'rift-walker',
    assetSlug: 'rift-walker',
    displayName: 'Rift Walker',
    portrait: 'https://utfs.io/f/portrait.png',
    render: 'https://utfs.io/f/render.png',
    background: 'https://utfs.io/f/render.png',
    heroInfo: { ...abrams.heroInfo, tag1Text: 'Tank', tag2Text: 'Brawler', tag3Text: '' },
    status: 'published',
    moderationStatus: 'clean',
    likesCount: 7,
    likedByCurrentUser: false,
    allowCopies: true,
    viewerCanEdit: false,
    stats: {} as PublicHeroDetail['stats'],
    abilityStats: { abilities: [] } as unknown as PublicHeroDetail['abilityStats'],
    publishedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

function buildSeo(overrides: Partial<PublicProfileSeo> = {}): PublicProfileSeo {
  return {
    status: 'indexable',
    username: 'RiftSmith',
    canonicalPath: '/profile/RiftSmith',
    description: 'Builds heroes.',
    bio: 'Builds heroes.',
    ogImageUrl: 'https://img.clerk.com/avatar.png',
    publicHeroCount: 2,
    updatedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  }
}

const creatorSummary: CreatorProfileSummary = {
  userId: 'clerk_creator',
  username: 'secret.person',
  profileSlug: 'clerk_creator',
  avatarUrl: 'https://img.clerk.com/avatar.png',
  level: 'Contributor',
  preferredHero: 'abrams',
}

describe('hero slugs and paths', () => {
  it('accepts lowercase slugs up to 160 characters', () => {
    expect(HERO_SLUG_PATTERN.source).toBe('^[a-z0-9-]{1,160}$')
    expect(isValidHeroSlug('abrams-2')).toBe(true)
    expect(isValidHeroSlug('a')).toBe(true)
    expect(isValidHeroSlug('a'.repeat(160))).toBe(true)
  })

  it.each([
    ['', 'empty'],
    ['a'.repeat(161), 'too long'],
    ['Abrams', 'uppercase'],
    ['rift walker', 'space'],
    ['rift_walker', 'underscore'],
    ['../etc', 'traversal'],
    ['%2e%2e', 'percent-encoded'],
    ['abrams\n', 'trailing newline'],
  ])('rejects %j (%s)', slug => {
    expect(isValidHeroSlug(slug)).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(isValidHeroSlug({ $ne: '' } as unknown as string)).toBe(false)
  })

  it('builds hero, profile, and template paths', () => {
    expect(getHeroPath('abrams-2')).toBe('/characters/abrams-2')
    expect(getPublicProfilePath('rift smith')).toBe('/profile/rift%20smith')
    expect(getHeroTemplateHref('id&x=1')).toBe('/?tab=browse&heroId=id%26x%3D1')
    expect(GUEST_ACTION_HREF).toBe('/sign-up')
  })

  it('collects non-empty hero tags in order', () => {
    expect(getHeroTags({ tag1Text: ' Tank ', tag2Text: '', tag3Text: 'Support' })).toEqual(['Tank', 'Support'])
    expect(getHeroTags(null)).toEqual([])
  })
})

describe('SEO descriptions', () => {
  it('uses the backstory as plain text when present', () => {
    expect(buildHeroSeoDescription({
      displayName: 'Rift Walker',
      backstory: '  A drifter\n\n from\tthe\u0000 rift.  ',
      tags: ['Tank'],
      creatorName: 'RiftSmith',
    })).toBe('A drifter from the rift.')
  })

  it('falls back to a generated hero sentence with tags', () => {
    expect(buildHeroSeoDescription({ displayName: 'Rift Walker', backstory: '   ', tags: ['Tank', 'Brawler'], creatorName: 'RiftSmith' }))
      .toBe('Rift Walker is a fan-made Deadlock hero concept by RiftSmith. Tags: Tank, Brawler.')
    expect(buildHeroSeoDescription({ displayName: 'Rift Walker', backstory: null, tags: [], creatorName: UNKNOWN_CREATOR_NAME }))
      .toBe('Rift Walker is a fan-made Deadlock hero concept by Unknown creator.')
  })

  it('cuts long text at a word boundary to at most 160 characters', () => {
    const backstory = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ')
    const description = buildHeroSeoDescription({ displayName: 'X', backstory, tags: [], creatorName: 'Y' })

    expect(description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX_LENGTH)
    expect(description.endsWith('...')).toBe(true)
    expect(backstory.startsWith(description.slice(0, -3))).toBe(true)
    expect(backstory.charAt(description.length - 3)).toBe(' ')
  })

  it('hard-cuts at 157 characters when there is no late space', () => {
    const description = buildHeroSeoDescription({ displayName: 'X', backstory: 'a'.repeat(400), tags: [], creatorName: 'Y' })

    expect(description).toBe(`${'a'.repeat(157)}...`)
    expect(description).toHaveLength(160)
  })

  it('keeps text of exactly 160 characters unchanged', () => {
    const backstory = 'b'.repeat(160)

    expect(buildHeroSeoDescription({ displayName: 'X', backstory, tags: [], creatorName: 'Y' })).toBe(backstory)
  })

  it('uses a custom profile bio and ignores the default bio', () => {
    expect(buildProfileSeoDescription({ username: 'RiftSmith', bio: ' Builds\nheroes. ', publicHeroCount: 3 })).toBe('Builds heroes.')
    expect(buildProfileSeoDescription({ username: 'RiftSmith', bio: 'No profile bio has been added yet.', publicHeroCount: 1 }))
      .toBe('RiftSmith has published 1 fan-made Deadlock hero concept on Cursed Concepts.')
    expect(buildProfileSeoDescription({ username: 'RiftSmith', bio: null, publicHeroCount: 0 }))
      .toBe('RiftSmith has published 0 fan-made Deadlock hero concepts on Cursed Concepts.')
  })

  it('bounds long profile bios', () => {
    const description = buildProfileSeoDescription({ username: 'R', bio: 'lorem ipsum '.repeat(40), publicHeroCount: 1 })

    expect(description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX_LENGTH)
    expect(description.endsWith('...')).toBe(true)
  })
})

describe('isSafeOgImageUrl', () => {
  it.each([
    'https://img.clerk.com/avatar.png',
    'https://images.clerk.dev/avatar',
    'https://clerk.cursedconcepts.xyz/a.jpg',
    'https://utfs.io/f/abc',
    'https://abc123.public.blob.vercel-storage.com/hero.webp',
    'https://IMG.CLERK.COM/avatar.png',
    '/panorama/images/heroes/abrams.png',
    '/landing/banner.png',
    '/render/Abrams_Render.webp',
    '/a/b.jpeg',
    '/a/b.gif',
  ])('accepts %s', url => {
    expect(isSafeOgImageUrl(url)).toBe(true)
  })

  it.each([
    ['', 'empty'],
    ['http://img.clerk.com/avatar.png', 'http'],
    ['data:image/png;base64,AAAA', 'data URL'],
    ['blob:https://img.clerk.com/1', 'blob URL'],
    ['javascript:alert(1)', 'javascript URL'],
    ['//img.clerk.com/avatar.png', 'protocol-relative'],
    ['https://user:pass@img.clerk.com/a.png', 'credentials'],
    ['https://user@img.clerk.com/a.png', 'username only'],
    ['https://img.clerk.com:8443/a.png', 'port'],
    ['https://127.0.0.1/a.png', 'IPv4 literal'],
    ['https://0x7f.0.0.1/a.png', 'hex IPv4 literal'],
    ['https://[::1]/a.png', 'IPv6 literal'],
    ['https://evil.com/a.png', 'not allowlisted'],
    ['https://img.clerk.com.evil.com/a.png', 'allowlisted prefix'],
    ['https://evilimg.clerk.com/a.png', 'allowlisted suffix without dot'],
    ['https://public.blob.vercel-storage.com/a.png', 'bare wildcard parent'],
    ['https://evilpublic.blob.vercel-storage.com/a.png', 'wildcard without dot'],
    ['https://img.clerk.com/a b.png', 'whitespace'],
    ['https://img.clerk.com/a\\b.png', 'backslash'],
    ['https://img.clerk.com/a\u0000.png', 'control character'],
    ['/../package.json', 'traversal'],
    ['/landing/../../.env.png', 'nested traversal'],
    ['/landing/%2e%2e/x.png', 'percent-encoded'],
    ['/landing/banner.svg', 'svg extension'],
    ['/landing/banner', 'no extension'],
    ['/landing/banner.png?x=1', 'query string'],
    ['landing/banner.png', 'relative without slash'],
    ['ftp://img.clerk.com/a.png', 'ftp'],
    ['not a url', 'garbage'],
  ])('rejects %j (%s)', url => {
    expect(isSafeOgImageUrl(url)).toBe(false)
  })

  it('mirrors next.config.ts images.remotePatterns exactly', () => {
    const patterns = nextConfig.images?.remotePatterns ?? []
    const exactHosts: string[] = []
    const suffixes: string[] = []

    for (const pattern of patterns) {
      if (pattern instanceof URL) throw new Error('URL remote patterns are not mirrored')

      expect(pattern.protocol).toBe('https')
      expect(pattern.port ?? '').toBe('')

      if (pattern.hostname.startsWith('**.')) {
        suffixes.push(pattern.hostname.slice(2))
      } else {
        expect(pattern.hostname).not.toContain('*')
        exactHosts.push(pattern.hostname)
      }
    }

    expect([...OG_IMAGE_REMOTE_HOSTS].sort()).toEqual(exactHosts.sort())
    expect([...OG_IMAGE_REMOTE_HOST_SUFFIXES].sort()).toEqual(suffixes.sort())
  })
})

describe('toAbsoluteSiteUrl', () => {
  it('prefixes site-relative paths and keeps absolute URLs', () => {
    expect(toAbsoluteSiteUrl('/landing/banner.png', SITE_URL)).toBe(`${SITE_URL}/landing/banner.png`)
    expect(toAbsoluteSiteUrl('/a.png', `${SITE_URL}/`)).toBe(`${SITE_URL}/a.png`)
    expect(toAbsoluteSiteUrl('https://utfs.io/f/a.png', SITE_URL)).toBe('https://utfs.io/f/a.png')
  })
})

describe('isProfileIndexable', () => {
  const indexable = { isPublic: true, registeredUsername: 'RiftSmith', publicHeroCount: 1, suspended: false }

  it('requires public, a registered username, a public hero, and no suspension', () => {
    expect(isProfileIndexable(indexable)).toBe(true)
    expect(isProfileIndexable({ ...indexable, isPublic: false })).toBe(false)
    expect(isProfileIndexable({ ...indexable, registeredUsername: null })).toBe(false)
    expect(isProfileIndexable({ ...indexable, registeredUsername: '' })).toBe(false)
    expect(isProfileIndexable({ ...indexable, publicHeroCount: 0 })).toBe(false)
    expect(isProfileIndexable({ ...indexable, suspended: true })).toBe(false)
  })
})

describe('toPublicCreator', () => {
  it('uses the registered username and a profile path for public profiles', () => {
    expect(toPublicCreator(creatorSummary, { registeredUsername: 'RiftSmith', isPublic: true })).toEqual({
      username: 'RiftSmith',
      profilePath: '/profile/RiftSmith',
      avatarUrl: 'https://img.clerk.com/avatar.png',
      level: 'Contributor',
    })
  })

  it('never falls back to the summary username (email local-part)', () => {
    const creator = toPublicCreator(creatorSummary, { registeredUsername: null, isPublic: true })

    expect(creator.username).toBe(UNKNOWN_CREATOR_NAME)
    expect(creator.profilePath).toBeNull()
    expect(JSON.stringify(creator)).not.toContain('secret.person')
    expect(JSON.stringify(creator)).not.toContain('clerk_creator')
  })

  it('hides the profile path for private profiles', () => {
    expect(toPublicCreator(creatorSummary, { registeredUsername: 'RiftSmith', isPublic: false })).toMatchObject({
      username: 'RiftSmith',
      profilePath: null,
    })
  })

  it('handles a missing account and summary', () => {
    expect(toPublicCreator(null, null)).toEqual({ username: UNKNOWN_CREATOR_NAME, profilePath: null, level: 'New User' })
  })

  it('drops unsafe avatar URLs', () => {
    const creator = toPublicCreator({ ...creatorSummary, avatarUrl: 'http://evil.com/a.png' }, { registeredUsername: 'RiftSmith', isPublic: true })

    expect(creator).not.toHaveProperty('avatarUrl')
  })
})

describe('JSON-LD builders', () => {
  const creator = { username: 'RiftSmith', profilePath: '/profile/RiftSmith', level: 'Contributor' as const }

  it('builds a CreativeWork for a hero', () => {
    const jsonLd = buildHeroJsonLd({ hero: buildHero(), creator, description: 'A drifter.', siteUrl: SITE_URL })

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      '@id': `${SITE_URL}/characters/rift-walker#hero`,
      name: 'Rift Walker',
      description: 'A drifter.',
      url: `${SITE_URL}/characters/rift-walker`,
      image: 'https://utfs.io/f/portrait.png',
      author: { '@type': 'Person', name: 'RiftSmith', url: `${SITE_URL}/profile/RiftSmith` },
      datePublished: '2026-08-01T00:00:00.000Z',
      dateModified: '2026-08-02T00:00:00.000Z',
      keywords: 'Tank, Brawler',
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: 7,
      },
    })
  })

  it('omits unknown authors, unsafe images, empty keywords, and falls back to createdAt', () => {
    const hero = buildHero({
      portrait: 'http://evil.com/a.png',
      publishedAt: null,
      heroInfo: { ...abrams.heroInfo, tag1Text: '', tag2Text: '', tag3Text: '' },
    })
    const jsonLd = buildHeroJsonLd({
      hero,
      creator: { username: UNKNOWN_CREATOR_NAME, profilePath: null, level: 'New User' },
      description: 'd',
      siteUrl: SITE_URL,
    })

    expect(jsonLd).not.toHaveProperty('author')
    expect(jsonLd).not.toHaveProperty('image')
    expect(jsonLd).not.toHaveProperty('keywords')
    expect(jsonLd.datePublished).toBe('2026-07-01T00:00:00.000Z')
  })

  it('makes site-relative portraits absolute and omits the author url without a profile path', () => {
    const jsonLd = buildHeroJsonLd({
      hero: buildHero({ portrait: '/panorama/images/heroes/abrams.png' }),
      creator: { ...creator, profilePath: null },
      description: 'd',
      siteUrl: SITE_URL,
    })

    expect(jsonLd.image).toBe(`${SITE_URL}/panorama/images/heroes/abrams.png`)
    expect(jsonLd.author).toEqual({ '@type': 'Person', name: 'RiftSmith' })
  })

  it('builds a ProfilePage for an indexable profile', () => {
    expect(buildProfileJsonLd({ seo: buildSeo(), siteUrl: SITE_URL })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': `${SITE_URL}/profile/RiftSmith#profile`,
      url: `${SITE_URL}/profile/RiftSmith`,
      dateModified: '2026-08-03T00:00:00.000Z',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: {
        '@type': 'Person',
        '@id': `${SITE_URL}/profile/RiftSmith#person`,
        name: 'RiftSmith',
        url: `${SITE_URL}/profile/RiftSmith`,
        image: 'https://img.clerk.com/avatar.png',
        description: 'Builds heroes.',
      },
    })
  })

  it('omits the profile image and description when unset', () => {
    const jsonLd = buildProfileJsonLd({ seo: buildSeo({ ogImageUrl: null, bio: null }), siteUrl: SITE_URL })

    expect(jsonLd.mainEntity).not.toHaveProperty('image')
    expect(jsonLd.mainEntity).not.toHaveProperty('description')
  })

  it('never contains email or internal ID keys and serializes safely', () => {
    const heroJsonLd = buildHeroJsonLd({ hero: buildHero({ displayName: '</script><b>' }), creator, description: 'd', siteUrl: SITE_URL })
    const profileJsonLd = buildProfileJsonLd({ seo: buildSeo(), siteUrl: SITE_URL })

    for (const jsonLd of [heroJsonLd, profileJsonLd]) {
      const json = JSON.stringify(jsonLd)

      expect(json).not.toMatch(/email/i)
      expect(json).not.toContain('"userId"')
      expect(json).not.toContain('"creatorId"')
      expect(json).not.toContain('"clerkId"')
      expect(json).not.toContain('"_id"')
      expect(json).not.toContain('507f1f77bcf86cd799439011')
    }

    const serialized = serializeJsonLd(heroJsonLd)

    expect(serialized).not.toContain('<')
    expect(JSON.parse(serialized)).toEqual(heroJsonLd)
  })
})
