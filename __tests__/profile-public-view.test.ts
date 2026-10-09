import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
  dbConnect: vi.fn(),
  userFindOne: vi.fn(),
  heroFind: vi.fn(),
  heroInfoCountDocuments: vi.fn(),
  followExists: vi.fn(),
  followCountDocuments: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, currentUser: mocks.currentUser, clerkClient: mocks.clerkClient }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect, isDatabaseConnectionError: vi.fn(() => false) }))
vi.mock('@/lib/user-record-sync', () => ({ syncUserRecordFromClerk: vi.fn() }))
vi.mock('@/lib/custom-heroes', () => ({ listCustomHeroesForOwner: vi.fn(), listBookmarkedCustomHeroes: vi.fn() }))
vi.mock('@/lib/models/User', () => ({ default: { findOne: mocks.userFindOne } }))
vi.mock('@/lib/models/CustomHero', () => ({ default: { find: mocks.heroFind } }))
vi.mock('@/lib/models/HeroInfo', () => ({ default: { countDocuments: mocks.heroInfoCountDocuments } }))
vi.mock('@/lib/models/Follow', () => ({ default: { exists: mocks.followExists, countDocuments: mocks.followCountDocuments } }))

import { HEROES } from '@/lib/hero-data'
import { getUserProfile, toPublicProfileView, type UserProfileData } from '@/lib/profile'
import { UNKNOWN_CREATOR_NAME } from '@/lib/public-page-types'

const abrams = HEROES[0]
const now = '2026-08-12T12:00:00.000Z'
const MONGO_USER_ID = '64b7f0c2a1b2c3d4e5f60718'

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
      anonymousEdits: true,
      customBio: 'Builds heroes around battlefield control.',
      createdAt: now,
      updatedAt: now,
    },
    viewerIsOwner: false,
    viewerIsSignedIn: false,
    avatarUrl: 'https://img.clerk.com/rift.png',
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
        background: abrams.render,
        updatedAt: now,
        status: 'published',
        moderationStatus: 'clean',
      },
      {
        id: 'hero_legacy',
        name: 'Legacy',
        slug: 'Legacy Slug',
        portrait: abrams.portrait,
        render: abrams.render,
        background: abrams.render,
        updatedAt: now,
        status: 'published',
        moderationStatus: 'flagged',
      },
      {
        id: 'hero_private_card',
        name: 'Secret Private Card',
        slug: 'secret-private-card',
        portrait: abrams.portrait,
        render: abrams.render,
        background: abrams.render,
        updatedAt: now,
        status: 'private',
        moderationStatus: 'clean',
      },
      {
        id: 'hero_hidden_card',
        name: 'Hidden Card',
        slug: 'hidden-card',
        portrait: abrams.portrait,
        render: abrams.render,
        background: abrams.render,
        updatedAt: now,
        status: 'published',
        moderationStatus: 'hidden',
      },
    ],
    savedHeroes: [{ id: 'saved_hero', displayName: 'Saved Secret' } as UserProfileData['savedHeroes'][number]],
    bookmarkedHeroes: [{ id: 'bookmarked_hero', displayName: 'Bookmarked Secret' } as UserProfileData['bookmarkedHeroes'][number]],
    privateHeroes: [{ id: 'private_hero', displayName: 'Private Secret' } as UserProfileData['privateHeroes'][number]],
    viewerFollowsUser: true,
    followerCount: 12,
    level: { label: 'Contributor', tone: 'investigator', nextAt: 21, progress: 40 },
    charactersCreated: 1,
    userContributions: 3,
    ...overrides,
  }
}

describe('toPublicProfileView', () => {
  it('returns only the public DTO fields', () => {
    const view = toPublicProfileView(buildProfileData())

    expect(Object.keys(view).sort()).toEqual([
      'avatarUrl',
      'bio',
      'charactersCreated',
      'followTargetId',
      'followerCount',
      'heroes',
      'level',
      'profileBackground',
      'userContributions',
      'username',
      'viewer',
    ])
    expect(view).toMatchObject({
      username: 'RiftSmith',
      followTargetId: 'clerk_creator',
      avatarUrl: 'https://img.clerk.com/rift.png',
      bio: 'Builds heroes around battlefield control.',
      followerCount: 12,
      viewer: { isSignedIn: false, follows: true },
    })
  })

  it('never contains email, the Mongo id, anonymousEdits, or saved, bookmarked, or private heroes', () => {
    const json = JSON.stringify(toPublicProfileView(buildProfileData()))

    expect(json).not.toContain('secret.person')
    expect(json).not.toContain('example.com')
    expect(json).not.toMatch(/email/i)
    expect(json).not.toContain(MONGO_USER_ID)
    expect(json).not.toContain('anonymousEdits')
    expect(json).not.toContain('isPublic')
    expect(json).not.toContain('createdAt')
    expect(json).not.toContain('Saved Secret')
    expect(json).not.toContain('Bookmarked Secret')
    expect(json).not.toContain('Private Secret')
    expect(json).not.toContain('savedHeroes')
    expect(json).not.toContain('bookmarkedHeroes')
    expect(json).not.toContain('privateHeroes')
  })

  it('keeps only public hero cards and links them to the hero page or the template fallback', () => {
    const view = toPublicProfileView(buildProfileData())

    expect(view.heroes).toEqual([
      {
        id: 'hero_public',
        name: 'Arc Light',
        slug: 'arc-light',
        href: '/characters/arc-light',
        portrait: abrams.portrait,
        render: abrams.render,
        background: abrams.render,
        updatedAt: now,
      },
      {
        id: 'hero_legacy',
        name: 'Legacy',
        slug: 'Legacy Slug',
        href: '/?tab=browse&heroId=hero_legacy',
        portrait: abrams.portrait,
        render: abrams.render,
        background: abrams.render,
        updatedAt: now,
      },
    ])
    expect(JSON.stringify(view)).not.toContain('Secret Private Card')
    expect(JSON.stringify(view)).not.toContain('Hidden Card')
  })

  it('falls back to "Unknown creator", never to the email-derived username', () => {
    const data = buildProfileData()
    const view = toPublicProfileView({
      ...data,
      user: { ...data.user, username: 'secret.person', registeredUsername: null },
    })

    expect(view.username).toBe(UNKNOWN_CREATOR_NAME)
    expect(JSON.stringify(view)).not.toContain('secret.person')
  })
})

describe('getUserProfile public additions', () => {
  function mockUser(username: string | null) {
    mocks.userFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(MONGO_USER_ID),
        clerkId: 'clerk_creator',
        email: 'secret.person@example.com',
        username,
        profileImageUrl: 'https://img.clerk.com/rift.png',
        isPublic: true,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      }),
    })
  }

  beforeEach(() => {
    mocks.dbConnect.mockResolvedValue(undefined)
    mocks.heroFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })
    mocks.heroInfoCountDocuments.mockResolvedValue(0)
    mocks.followExists.mockResolvedValue(null)
    mocks.followCountDocuments.mockResolvedValue(0)
  })

  it('reports a guest viewer and the registered username', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    mockUser('RiftSmith')

    const data = await getUserProfile('RiftSmith')

    expect(data.viewerIsSignedIn).toBe(false)
    expect(data.viewerIsOwner).toBe(false)
    expect(data.user.registeredUsername).toBe('RiftSmith')
    expect(mocks.heroFind).toHaveBeenCalledWith(expect.objectContaining({ status: 'published', moderationStatus: { $ne: 'hidden' } }))
  })

  it('keeps registeredUsername null when only the email fallback exists', async () => {
    mocks.auth.mockResolvedValue({ userId: 'clerk_viewer' })
    mockUser(null)

    const data = await getUserProfile('clerk_creator')

    expect(data.viewerIsSignedIn).toBe(true)
    // Owner-facing username keeps its existing fallback; the public field does not.
    expect(data.user.username).toBe('secret.person')
    expect(data.user.registeredUsername).toBeNull()
    expect(toPublicProfileView(data).username).toBe(UNKNOWN_CREATOR_NAME)
  })
})
