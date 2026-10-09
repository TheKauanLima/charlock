// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getUserProfile: vi.fn(),
  getPublicProfileSeo: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, currentUser: mocks.currentUser, clerkClient: vi.fn() }))
vi.mock('@/lib/dbConnect', () => ({ default: vi.fn(), isDatabaseConnectionError: vi.fn(() => false) }))
vi.mock('@/lib/user-record-sync', () => ({ syncUserRecordFromClerk: vi.fn() }))
vi.mock('@/lib/custom-heroes', () => ({ listCustomHeroesForOwner: vi.fn(), listBookmarkedCustomHeroes: vi.fn() }))
vi.mock('@/lib/profile', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/profile')>()),
  getUserProfile: mocks.getUserProfile,
}))
vi.mock('@/lib/public-pages', async () => ({
  ...(await vi.importActual<typeof import('@/lib/public-page-utils')>('@/lib/public-page-utils')),
  getPublicProfileSeo: mocks.getPublicProfileSeo,
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; preload?: boolean; unoptimized?: boolean; blurDataURL?: string }) => {
    const imageProps: Record<string, unknown> = { ...props }

    delete imageProps.fill
    delete imageProps.preload
    delete imageProps.unoptimized
    delete imageProps.blurDataURL
    delete imageProps.placeholder

    return React.createElement('img', imageProps)
  },
}))
vi.mock('@/components/UserProfile/UserProfile', () => ({
  default: () => <div data-testid="owner-profile-page">Owner profile</div>,
}))

import ProfilePage, { generateMetadata } from '@/app/profile/[username]/page'
import { HEROES } from '@/lib/hero-data'
import { ProfilePrivateError, type UserProfileData } from '@/lib/profile'
import type { PublicProfileSeo } from '@/lib/public-page-types'

const abrams = HEROES[0]
const now = '2026-08-12T12:00:00.000Z'
const MONGO_USER_ID = '64b7f0c2a1b2c3d4e5f60718'
const PROFILE_FALLBACK = { title: 'Creator profile', robots: { index: false, follow: false } }

function buildSeo(overrides: Partial<PublicProfileSeo> = {}): PublicProfileSeo {
  return {
    status: 'indexable',
    username: 'RiftSmith',
    canonicalPath: '/profile/RiftSmith',
    description: 'RiftSmith has published 2 fan-made Deadlock hero concepts on Cursed Concepts.',
    bio: null,
    ogImageUrl: null,
    publicHeroCount: 2,
    updatedAt: now,
    ...overrides,
  }
}

function buildProfileData(overrides: Partial<UserProfileData> = {}): UserProfileData {
  return {
    user: {
      id: MONGO_USER_ID,
      clerkId: 'clerk_creator',
      email: 'secret.person@example.com',
      username: 'RiftSmith',
      registeredUsername: 'RiftSmith',
      preferredHero: abrams.slug,
      profileBackground: `official:${abrams.slug}`,
      isPublic: true,
      anonymousEdits: false,
      customBio: 'Builds heroes around battlefield control.',
      createdAt: now,
      updatedAt: now,
    },
    viewerIsOwner: false,
    viewerIsSignedIn: false,
    avatarUrl: null,
    preferredHero: abrams,
    profileBackground: {
      id: `official:${abrams.slug}`,
      label: abrams.displayName,
      render: abrams.render,
      accent: abrams.heroInfo.tagColor,
      nameColor: abrams.heroInfo.nameColor,
    },
    authoredHeroes: [
      {
        id: 'hero_public',
        name: 'Arc Light',
        slug: 'arc-light',
        portrait: abrams.portrait,
        render: abrams.render,
        background: '/bg.png',
        updatedAt: now,
        status: 'published',
        moderationStatus: 'clean',
      },
      {
        id: 'hero_private',
        name: 'Secret Draft',
        slug: 'secret-draft',
        portrait: abrams.portrait,
        render: abrams.render,
        background: '/bg.png',
        updatedAt: now,
        status: 'private',
        moderationStatus: 'clean',
      },
    ],
    savedHeroes: [],
    bookmarkedHeroes: [],
    privateHeroes: [],
    viewerFollowsUser: false,
    followerCount: 4,
    level: { label: 'Contributor', tone: 'standard', nextAt: 10, progress: 40 },
    charactersCreated: 2,
    userContributions: 3,
    ...overrides,
  } as UserProfileData
}

function params(username: string) {
  return { params: Promise.resolve({ username }) }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('/profile/[username] metadata', () => {
  it('indexes an indexable profile with a canonical and no openGraph when there is no safe avatar', async () => {
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo())

    const metadata = await generateMetadata(params('RiftSmith'))

    expect(metadata).toEqual({
      title: "RiftSmith's hero concepts",
      description: 'RiftSmith has published 2 fan-made Deadlock hero concepts on Cursed Concepts.',
      alternates: { canonical: '/profile/RiftSmith' },
    })
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.currentUser).not.toHaveBeenCalled()
  })

  it('uses the option (b) openGraph/twitter spreads with a safe avatar', async () => {
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo({ ogImageUrl: 'https://img.clerk.com/avatar.png' }))

    const metadata = await generateMetadata(params('RiftSmith'))

    expect(metadata.openGraph).toEqual({
      type: 'website',
      siteName: 'Cursed Concepts',
      locale: 'en_US',
      images: [{ url: 'https://img.clerk.com/avatar.png', alt: 'RiftSmith avatar' }],
    })
    expect(metadata.twitter).toEqual({ card: 'summary' })
    expect(metadata.robots).toBeUndefined()
  })

  it('marks a public but non-indexable profile noindex, follow with no canonical', async () => {
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo({
      status: 'noindex',
      username: null,
      canonicalPath: null,
      description: 'This creator has published 0 fan-made Deadlock hero concepts on Cursed Concepts.',
      publicHeroCount: 0,
    }))

    const metadata = await generateMetadata(params('clerk_creator'))

    expect(metadata).toEqual({
      title: "Creator's hero concepts",
      description: 'This creator has published 0 fan-made Deadlock hero concepts on Cursed Concepts.',
      robots: { index: false, follow: true },
    })
  })

  it('returns identical noindex metadata for missing, private, and failed lookups', async () => {
    mocks.getPublicProfileSeo.mockResolvedValueOnce(buildSeo({ status: 'missing', username: null, canonicalPath: null, description: null }))
    const missing = await generateMetadata(params('nobody'))

    mocks.getPublicProfileSeo.mockResolvedValueOnce(buildSeo({ status: 'private', username: null, canonicalPath: null, description: null }))
    const privateProfile = await generateMetadata(params('hidden'))

    mocks.getPublicProfileSeo.mockRejectedValueOnce(new Error('db down'))
    const failed = await generateMetadata(params('RiftSmith'))

    expect(missing).toEqual(PROFILE_FALLBACK)
    expect(privateProfile).toEqual(PROFILE_FALLBACK)
    expect(failed).toEqual(PROFILE_FALLBACK)
  })
})

describe('/profile/[username] page', () => {
  it('renders the public DTO for a guest with no email, Mongo id, or private heroes', async () => {
    mocks.getUserProfile.mockResolvedValue(buildProfileData())
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo())

    const element = await ProfilePage(params('RiftSmith'))
    const publicProfile = React.Children.toArray(element.props.children)[0] as React.ReactElement<{ data: Record<string, unknown> }>
    const serializedProps = JSON.stringify(publicProfile.props)
    const { container } = render(element)
    const html = container.innerHTML

    for (const forbidden of ['secret.person', MONGO_USER_ID, 'anonymousEdits', 'savedHeroes', 'privateHeroes', 'bookmarkedHeroes', 'Secret Draft']) {
      expect(serializedProps).not.toContain(forbidden)
      expect(html).not.toContain(forbidden)
    }

    expect(publicProfile.props.data).not.toHaveProperty('email')
    expect(screen.getByRole('heading', { level: 1, name: 'RiftSmith' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open character Arc Light' })).toHaveAttribute('href', '/characters/arc-light')
    expect(screen.getByRole('link', { name: 'Sign up to follow RiftSmith' })).toHaveAttribute('href', '/sign-up')
    expect(screen.queryByRole('button', { name: 'Follow RiftSmith' })).not.toBeInTheDocument()
  })

  it('shows the follow button to signed-in non-owners', async () => {
    mocks.getUserProfile.mockResolvedValue(buildProfileData({ viewerIsSignedIn: true }))
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo())

    render(await ProfilePage(params('RiftSmith')))

    expect(screen.getByRole('button', { name: 'Follow RiftSmith' })).toBeInTheDocument()
  })

  it('renders ProfilePage JSON-LD only for indexable profiles', async () => {
    mocks.getUserProfile.mockResolvedValue(buildProfileData())
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo({ bio: 'Builds </script> heroes.' }))

    const { container, unmount } = render(await ProfilePage(params('RiftSmith')))
    const script = container.querySelector('script[type="application/ld+json"]')

    expect(script).not.toBeNull()
    expect(script?.innerHTML).not.toContain('</script>')
    expect(JSON.parse(script?.innerHTML ?? '{}')).toMatchObject({
      '@type': 'ProfilePage',
      url: 'https://cursedconcepts.xyz/profile/RiftSmith',
      mainEntity: { '@type': 'Person', name: 'RiftSmith', description: 'Builds </script> heroes.' },
    })
    expect(script?.innerHTML).not.toContain('secret.person')
    unmount()

    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo({ status: 'noindex', canonicalPath: null }))
    const noindex = render(await ProfilePage(params('RiftSmith')))

    expect(noindex.container.querySelector('script[type="application/ld+json"]')).toBeNull()
  })

  it('still renders the profile without JSON-LD when the SEO lookup fails', async () => {
    mocks.getUserProfile.mockResolvedValue(buildProfileData())
    mocks.getPublicProfileSeo.mockRejectedValue(new Error('db down'))

    const { container } = render(await ProfilePage(params('RiftSmith')))

    expect(screen.getByRole('heading', { level: 1, name: 'RiftSmith' })).toBeInTheDocument()
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull()
  })

  it('shows a guest ProfileUnavailable with the private reason for a private profile', async () => {
    mocks.getUserProfile.mockRejectedValue(new ProfilePrivateError())

    render(await ProfilePage(params('hidden')))

    expect(screen.getByRole('heading', { name: 'Profile unavailable' })).toBeInTheDocument()
    expect(screen.getByText('This creator has limited profile access.')).toBeInTheDocument()
    expect(mocks.getPublicProfileSeo).not.toHaveBeenCalled()
  })

  it('keeps the owner workspace for the owner', async () => {
    mocks.getUserProfile.mockResolvedValue(buildProfileData({ viewerIsOwner: true, viewerIsSignedIn: true }))
    mocks.getPublicProfileSeo.mockResolvedValue(buildSeo())

    render(await ProfilePage(params('RiftSmith')))

    expect(screen.getByTestId('owner-profile-page')).toBeInTheDocument()
  })
})
