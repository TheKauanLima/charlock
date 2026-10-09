// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPublicHeroPage: vi.fn(),
  getPublicHeroForMetadata: vi.fn(),
  loadOgImageDataUrl: vi.fn(),
  refresh: vi.fn(),
  ogCalls: [] as Array<{ element: React.ReactElement<Record<string, unknown>>; init?: ResponseInit }>,
  failOgWhenPortrait: false,
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, currentUser: mocks.auth, clerkClient: mocks.auth }))
vi.mock('@/lib/public-pages', async () => ({
  ...(await vi.importActual<typeof import('@/lib/public-page-utils')>('@/lib/public-page-utils')),
  getPublicHeroPage: mocks.getPublicHeroPage,
  getPublicHeroForMetadata: mocks.getPublicHeroForMetadata,
  loadOgImageDataUrl: mocks.loadOgImageDataUrl,
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  permanentRedirect: vi.fn((path: string) => { throw new Error(`NEXT_PERMANENT_REDIRECT:${path}`) }),
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; preload?: boolean; priority?: boolean; unoptimized?: boolean }) => {
    const imageProps: Record<string, unknown> = { ...props }

    if (props.preload) imageProps['data-preload'] = 'true'
    if (props.priority) imageProps['data-priority'] = 'true'
    delete imageProps.fill
    delete imageProps.preload
    delete imageProps.priority
    delete imageProps.unoptimized

    return React.createElement('img', imageProps)
  },
}))
vi.mock('next/og', () => ({
  ImageResponse: class extends Response {
    constructor(element: React.ReactElement<Record<string, unknown>>, init?: ResponseInit) {
      const shouldFail = mocks.failOgWhenPortrait && Boolean(element.props.portrait)
      const body = shouldFail
        ? new ReadableStream({ start(controller) { controller.error(new Error('Unsupported image')) } })
        : 'png-bytes'

      super(body, { status: init?.status ?? 200, headers: { 'content-type': 'image/png' } })
      mocks.ogCalls.push({ element, init })
    }
  },
}))

import HeroPage, { dynamic as pageDynamic, generateMetadata } from '@/app/characters/[slug]/page'
import HeroNotFound from '@/app/characters/[slug]/not-found'
import OgImage, { alt as ogAlt, contentType as ogContentType, dynamic as ogDynamic, size as ogSize } from '@/app/characters/[slug]/opengraph-image'
import PublicHeroPage from '@/components/PublicHero/PublicHeroPage'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import type { PublicHeroMetadata, PublicHeroPageData } from '@/lib/public-page-types'

const abrams = HEROES[0]
const now = '2026-08-12T12:00:00.000Z'
const HERO_FALLBACK = { title: 'Hero concept', robots: { index: false, follow: false } }

function buildPageData(overrides: Partial<PublicHeroPageData> = {}, heroOverrides: Partial<PublicHeroPageData['hero']> = {}): PublicHeroPageData {
  const stats = buildHeroStatsSeed(abrams)

  stats.weapon.panels = [{
    id: 'weapon-alt',
    name: 'Alt Fire Mode',
    bulletDPS: 40,
    weaponMinRange: 10,
    weaponMaxRange: 30,
    stats: stats.weapon.stats,
  }]

  const abilityStats = buildDefaultAbilityStats(abrams)

  abilityStats.abilities[0] = {
    ...abilityStats.abilities[0],
    name: 'Siphon Life',
    sections: [{ id: 'section-1', type: 'richText', title: 'Effect', text: 'Drains [c:spirit]nearby enemies[/c] for [b]health[/b].' }],
    tiers: [{ tier: 1, upgradeText: '+20% drain radius', variant: abilityStats.abilities[0] }],
  }

  return {
    hero: {
      ...abrams,
      slug: 'arc-light',
      displayName: 'Arc Light',
      heroInfo: { ...abrams.heroInfo, tag1Text: 'Tank', tag2Text: 'Brawler', tag3Text: '', backstory: 'Born in the Cursed Apple.\nRaised by the Patrons.' },
      id: 'hero_arc_light',
      status: 'published',
      moderationStatus: 'clean',
      likesCount: 7,
      likedByCurrentUser: false,
      allowCopies: true,
      background: '/panorama/images/heroes/backgrounds/abrams_bg_psd.png',
      renderPosition: { x: -40, y: 12 },
      viewerCanEdit: false,
      abilityStats,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      stats,
      ...heroOverrides,
    },
    creator: { username: 'RiftSmith', profilePath: '/profile/RiftSmith', level: 'Contributor' },
    comments: [{
      id: 'comment_1',
      heroId: 'hero_arc_light',
      authorName: 'Commenter',
      content: 'Great kit.',
      viewerCanDelete: false,
      createdAt: now,
      updatedAt: now,
    }],
    viewer: { isSignedIn: false, isOwner: false, liked: false, bookmarked: false },
    visibility: 'public',
    canonicalPath: '/characters/arc-light',
    description: 'Born in the Cursed Apple. Raised by the Patrons.',
    ...overrides,
  }
}

function buildMetadataHero(overrides: Partial<PublicHeroMetadata> = {}): PublicHeroMetadata {
  return {
    id: 'hero_arc_light',
    slug: 'arc-light',
    displayName: 'Arc Light',
    description: 'Born in the Cursed Apple. Raised by the Patrons.',
    portrait: abrams.portrait,
    tags: ['Tank', 'Brawler', 'Support', 'Extra'],
    accentColor: '#33debb',
    creator: { username: 'RiftSmith', profilePath: '/profile/RiftSmith', level: 'Contributor' },
    likesCount: 7,
    canonicalPath: '/characters/arc-light',
    ...overrides,
  }
}

function params(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

function getJsonLdScript(container: HTMLElement) {
  return container.querySelector('script[type="application/ld+json"]')
}

beforeEach(() => {
  mocks.ogCalls.length = 0
  mocks.failOgWhenPortrait = false
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('/characters/[slug] metadata', () => {
  it('is force-dynamic', () => {
    expect(pageDynamic).toBe('force-dynamic')
  })

  it('returns the hero title, description, and canonical for a public hero', async () => {
    mocks.getPublicHeroForMetadata.mockResolvedValue(buildMetadataHero())

    const metadata = await generateMetadata(params('arc-light'))

    expect(metadata).toEqual({
      title: 'Arc Light (Deadlock hero concept)',
      description: 'Born in the Cursed Apple. Raised by the Patrons.',
      alternates: { canonical: '/characters/arc-light' },
    })
    expect(metadata).not.toHaveProperty('openGraph')
    expect(metadata).not.toHaveProperty('twitter')
    expect(metadata).not.toHaveProperty('robots')
    expect(mocks.getPublicHeroForMetadata).toHaveBeenCalledWith('arc-light')
    expect(mocks.getPublicHeroPage).not.toHaveBeenCalled()
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('returns identical noindex fallback metadata for missing, private, invalid, uppercase, and failed lookups', async () => {
    mocks.getPublicHeroForMetadata.mockResolvedValueOnce(null)
    const missing = await generateMetadata(params('missing-hero'))

    mocks.getPublicHeroForMetadata.mockResolvedValueOnce(null)
    const privateHero = await generateMetadata(params('private-hero'))

    mocks.getPublicHeroForMetadata.mockRejectedValueOnce(new Error('db down'))
    const failed = await generateMetadata(params('arc-light'))

    const invalid = await generateMetadata(params('bad slug!'))
    const uppercase = await generateMetadata(params('Arc-Light'))

    for (const metadata of [missing, privateHero, failed, invalid, uppercase]) {
      expect(metadata).toEqual(HERO_FALLBACK)
    }

    expect(mocks.getPublicHeroForMetadata).toHaveBeenCalledTimes(3)
    expect(mocks.auth).not.toHaveBeenCalled()
  })
})

describe('/characters/[slug] page', () => {
  it('returns 404 for a malformed slug without a database lookup', async () => {
    await expect(HeroPage(params('bad slug!'))).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(HeroPage(params('a'.repeat(161)))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getPublicHeroPage).not.toHaveBeenCalled()
  })

  it('returns 404 when the hero is missing or not visible to this viewer', async () => {
    mocks.getPublicHeroPage.mockResolvedValue(null)

    await expect(HeroPage(params('arc-light'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getPublicHeroPage).toHaveBeenCalledWith('arc-light')
  })

  it('permanently redirects an uppercase slug to the lowercase hero when the viewer can open it', async () => {
    mocks.getPublicHeroPage.mockResolvedValue(buildPageData())

    await expect(HeroPage(params('Arc-Light'))).rejects.toThrow('NEXT_PERMANENT_REDIRECT:/characters/arc-light')
    expect(mocks.getPublicHeroPage).toHaveBeenCalledWith('arc-light')
  })

  it('returns 404 for an uppercase slug without a visible target', async () => {
    mocks.getPublicHeroPage.mockResolvedValue(null)

    await expect(HeroPage(params('Arc-Light'))).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(HeroPage(params('ARC LIGHT'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getPublicHeroPage).toHaveBeenCalledTimes(1)
  })

  it('renders the full read-only hero page for a guest from server data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    mocks.getPublicHeroPage.mockResolvedValue(buildPageData())

    const { container } = render(await HeroPage(params('arc-light')))

    expect(screen.getByRole('heading', { level: 1, name: 'Arc Light' })).toBeInTheDocument()
    expect(screen.getByAltText('Arc Light portrait')).toHaveAttribute('src', abrams.portrait)
    const renderImage = screen.getByAltText('Arc Light render')

    expect(renderImage).toHaveAttribute('src', abrams.render)
    expect(renderImage).toHaveAttribute('data-preload', 'true')
    expect(renderImage).not.toHaveAttribute('data-priority')
    expect(renderImage).toHaveStyle({ objectPosition: 'calc(100% + -40px) calc(0% + 12px)' })

    const tags = screen.getByRole('list', { name: 'Hero tags' })

    expect(within(tags).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Tank', 'Brawler'])
    expect(screen.getByText(/Born in the Cursed Apple\./)).toHaveTextContent('Born in the Cursed Apple. Raised by the Patrons.')
    expect(screen.getByRole('heading', { name: 'Siphon Life' })).toBeInTheDocument()
    expect(screen.getByText('Drains nearby enemies for health.')).toBeInTheDocument()
    expect(screen.getByText('+20% drain radius')).toBeInTheDocument()
    expect(screen.getByTestId('hero-info-ability-1').tagName).toBe('SPAN')

    expect(screen.getByRole('heading', { name: 'Boon' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weapon' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vitality' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spirit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alt Fire Mode' })).toBeInTheDocument()
    expect(container.querySelector('input, textarea, select')).toBeNull()

    expect(screen.getByRole('link', { name: 'RiftSmith' })).toHaveAttribute('href', '/profile/RiftSmith')
    expect(screen.getByTestId('public-hero-like-count')).toHaveTextContent('7 likes')
    expect(container.querySelector('#comment-comment_1')).toHaveTextContent('Great kit.')
    expect(container.querySelector('#comment-comment_1 time')).toHaveAttribute('dateTime', now)
    expect(screen.getByRole('link', { name: 'Sign up to comment' })).toHaveAttribute('href', '/sign-up')
    expect(screen.queryByText(/only visible to you/i)).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the creator as plain text when the profile is not public', async () => {
    mocks.getPublicHeroPage.mockResolvedValue(buildPageData({
      creator: { username: 'Unknown creator', profilePath: null, level: 'New User' },
    }))

    render(await HeroPage(params('arc-light')))

    expect(screen.getByText('Unknown creator')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Unknown creator' })).not.toBeInTheDocument()
  })

  it('renders CreativeWork JSON-LD only for public heroes and escapes </script> in the name', async () => {
    const data = buildPageData({}, { displayName: 'Evil </script><script>alert(1)</script>' })

    mocks.getPublicHeroPage.mockResolvedValue(data)

    const { container } = render(await HeroPage(params('arc-light')))
    const script = getJsonLdScript(container)

    expect(script).not.toBeNull()
    expect(script?.innerHTML).not.toContain('</script>')
    expect(script?.innerHTML).toContain('\\u003c/script>')

    const jsonLd = JSON.parse(script?.innerHTML ?? '{}') as Record<string, unknown>

    expect(jsonLd).toMatchObject({
      '@type': 'CreativeWork',
      name: 'Evil </script><script>alert(1)</script>',
      url: 'https://cursedconcepts.xyz/characters/arc-light',
      author: { '@type': 'Person', name: 'RiftSmith', url: 'https://cursedconcepts.xyz/profile/RiftSmith' },
    })
  })

  it.each([
    ['owner-private', 'Private, only visible to you'],
    ['owner-hidden', 'Hidden by moderation'],
  ] as const)('shows the owner a %s banner with no JSON-LD, comments, or social actions', async (visibility, bannerText) => {
    mocks.getPublicHeroPage.mockResolvedValue(buildPageData({
      visibility,
      comments: [],
      viewer: { isSignedIn: true, isOwner: true, liked: false, bookmarked: false },
    }, { status: visibility === 'owner-private' ? 'private' : 'published', moderationStatus: visibility === 'owner-hidden' ? 'hidden' : 'clean' }))

    const { container } = render(await HeroPage(params('arc-light')))

    expect(screen.getByText(bannerText)).toBeInTheDocument()
    expect(getJsonLdScript(container)).toBeNull()
    expect(container.querySelector('#comments')).toBeNull()
    expect(screen.queryByRole('button', { name: /like/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bookmark/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Use Arc Light as a template' })).toHaveAttribute('href', '/?tab=browse&heroId=hero_arc_light')
  })

  it('never puts email, creator ids, or comment user ids into the HTML or page props', async () => {
    const data = buildPageData()

    mocks.getPublicHeroPage.mockResolvedValue(data)

    const element = await HeroPage(params('arc-light'))
    const { container } = render(element)
    const html = container.innerHTML
    const props = JSON.stringify(element.props)

    for (const forbidden of ['"creatorId"', '"createdByUserId"', '"userId"', '"likedBy"', '"interactions"', '"creator":{"userId', '@example.com']) {
      expect(html).not.toContain(forbidden.replaceAll('"', ''))
      expect(props).not.toContain(forbidden)
    }
  })

  it('renders the not-found page with a browse link', () => {
    render(<HeroNotFound />)

    expect(screen.getByRole('heading', { name: 'Hero not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse heroes' })).toHaveAttribute('href', '/?tab=browse')
  })

  it('renders the component directly with plain-data props', () => {
    render(<PublicHeroPage data={buildPageData()} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Arc Light')
  })
})

describe('/characters/[slug]/opengraph-image', () => {
  it('exports the image config and is force-dynamic', () => {
    expect(ogAlt).toBe('Hero concept on Cursed Concepts')
    expect(ogSize).toEqual({ width: 1200, height: 630 })
    expect(ogContentType).toBe('image/png')
    expect(ogDynamic).toBe('force-dynamic')
  })

  it('returns a generic 404 card for a missing, non-public, or invalid hero', async () => {
    mocks.getPublicHeroForMetadata.mockResolvedValue(null)

    const missing = await OgImage(params('private-hero'))
    const invalid = await OgImage(params('Bad Slug'))

    expect(missing.status).toBe(404)
    expect(invalid.status).toBe(404)
    expect(mocks.loadOgImageDataUrl).not.toHaveBeenCalled()
    expect(mocks.ogCalls.every(call => !('hero' in call.element.props))).toBe(true)
    expect(mocks.ogCalls[0].init).toMatchObject({ width: 1200, height: 630, status: 404 })
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('returns a 404 card instead of a 500 when the lookup fails', async () => {
    mocks.getPublicHeroForMetadata.mockRejectedValue(new Error('db down'))

    const response = await OgImage(params('arc-light'))

    expect(response.status).toBe(404)
  })

  it('embeds the portrait only through loadOgImageDataUrl', async () => {
    mocks.getPublicHeroForMetadata.mockResolvedValue(buildMetadataHero())
    mocks.loadOgImageDataUrl.mockResolvedValue('data:image/png;base64,AAAA')

    const response = await OgImage(params('arc-light'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(mocks.loadOgImageDataUrl).toHaveBeenCalledWith(abrams.portrait)
    expect(mocks.ogCalls.at(-1)?.element.props).toMatchObject({ portrait: 'data:image/png;base64,AAAA' })
  })

  it('falls back to the text-only card for an unsafe portrait', async () => {
    mocks.getPublicHeroForMetadata.mockResolvedValue(buildMetadataHero({ portrait: 'https://evil.example/portrait.png' }))
    mocks.loadOgImageDataUrl.mockResolvedValue(null)

    const response = await OgImage(params('arc-light'))

    expect(response.status).toBe(200)
    expect(mocks.ogCalls).toHaveLength(1)
    expect(mocks.ogCalls[0].element.props).toMatchObject({ portrait: null })
  })

  it('falls back to the text-only card when the portrait cannot be rendered', async () => {
    mocks.failOgWhenPortrait = true
    mocks.getPublicHeroForMetadata.mockResolvedValue(buildMetadataHero())
    mocks.loadOgImageDataUrl.mockResolvedValue('data:image/png;base64,broken')

    const response = await OgImage(params('arc-light'))

    expect(response.status).toBe(200)
    expect(mocks.ogCalls).toHaveLength(2)
    expect(mocks.ogCalls[1].element.props).toMatchObject({ portrait: null })
  })
})
