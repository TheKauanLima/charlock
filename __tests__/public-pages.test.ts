// @vitest-environment node
import { Types } from 'mongoose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
  dbConnect: vi.fn(),
  heroFindOne: vi.fn(),
  heroFind: vi.fn(),
  heroAggregate: vi.fn(),
  heroCountDocuments: vi.fn(),
  heroInfoFindOne: vi.fn(),
  heroInfoAggregate: vi.fn(),
  relatedFindOne: vi.fn(),
  userFind: vi.fn(),
  userFindOne: vi.fn(),
  commentFind: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, currentUser: mocks.currentUser, clerkClient: mocks.clerkClient }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect, isDatabaseConnectionError: vi.fn(() => false) }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('@/lib/user-suspension', () => ({ assertUserNotSuspended: vi.fn() }))
vi.mock('@/lib/user-record-sync', () => ({ syncUserRecordFromClerk: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(), resolveRecipientClerkId: vi.fn() }))
vi.mock('@/lib/models/CustomHero', () => ({
  default: {
    findOne: mocks.heroFindOne,
    find: mocks.heroFind,
    aggregate: mocks.heroAggregate,
    countDocuments: mocks.heroCountDocuments,
  },
}))
vi.mock('@/lib/models/HeroInfo', () => ({ default: { findOne: mocks.heroInfoFindOne, aggregate: mocks.heroInfoAggregate } }))
vi.mock('@/lib/models/BoonStats', () => ({ default: { findOne: mocks.relatedFindOne } }))
vi.mock('@/lib/models/WeaponStats', () => ({ default: { findOne: mocks.relatedFindOne } }))
vi.mock('@/lib/models/VitalityStats', () => ({ default: { findOne: mocks.relatedFindOne } }))
vi.mock('@/lib/models/SpiritStats', () => ({ default: { findOne: mocks.relatedFindOne } }))
vi.mock('@/lib/models/AbilityStats', () => ({ default: { findOne: mocks.relatedFindOne } }))
vi.mock('@/lib/models/User', () => ({ default: { find: mocks.userFind, findOne: mocks.userFindOne } }))
vi.mock('@/lib/models/Comment', () => ({ default: { find: mocks.commentFind } }))
vi.mock('@/lib/models/Follow', () => ({ default: {} }))
vi.mock('@/lib/models/Like', () => ({ default: {} }))
vi.mock('@/lib/models/Notification', () => ({ default: {} }))

import { listHeroComments } from '@/lib/social-engagement'
import {
  getPublicHeroForMetadata,
  getPublicHeroPage,
  getPublicProfileSeo,
  isSafeOgImageUrl,
  listPublicHeroSitemapEntries,
  listPublicProfileSitemapEntries,
  loadOgImageDataUrl,
} from '@/lib/public-pages'

type Doc = Record<string, unknown>
type Filter = Record<string, unknown>

const HERO_ID = '507f1f77bcf86cd799439011'
const CREATOR_MONGO_ID = '64b7f0c2a1b2c3d4e5f60718'
const COMMENT_ID = '507f1f77bcf86cd799439099'
const SECRET_EMAIL = 'secret.person@example.com'
const PRIVATE_TARGET_NAME = 'Owner Private Target'

let heroes: Doc[] = []
let users: Doc[] = []

/** A tiny evaluator for the filter shapes the services use ($or, $ne, $in, equality). */
function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return (condition as Filter[]).some(part => matches(doc, part))

    const value = doc[key]

    if (condition && typeof condition === 'object' && !(condition instanceof Types.ObjectId)) {
      const operators = condition as Record<string, unknown>

      if ('$ne' in operators) return value !== operators.$ne
      if ('$in' in operators) return (operators.$in as unknown[]).some(item => String(item) === String(value))
      if ('$type' in operators) return typeof value === 'string' && value !== operators.$ne

      return false
    }

    if (condition === null) return value === null || value === undefined

    return String(value) === String(condition)
  })
}

function query<T>(result: T) {
  const chain = {
    sort: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: vi.fn(() => Promise.resolve(result)),
  }

  return chain
}

function buildHero(overrides: Doc = {}): Doc {
  return {
    _id: new Types.ObjectId(HERO_ID),
    name: 'Rift Walker',
    slug: 'rift-walker',
    portrait: 'https://utfs.io/f/portrait.png',
    render: 'https://utfs.io/f/render.png',
    background: 'https://utfs.io/f/render.png',
    renderPosition: { x: 0, y: 0 },
    createdByUserId: CREATOR_MONGO_ID,
    status: 'published',
    moderationStatus: 'clean',
    likesCount: 2,
    likedBy: ['clerk_viewer'],
    allowCopies: true,
    interactions: [{
      id: 'interaction-1',
      targetHeroId: '507f1f77bcf86cd799439012',
      targetHeroName: PRIVATE_TARGET_NAME,
      targetHeroPortrait: 'https://utfs.io/f/private.png',
      title: 'Secret talk',
      lines: [],
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    }],
    publishedAt: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  }
}

function buildCreator(overrides: Doc = {}): Doc {
  return {
    _id: new Types.ObjectId(CREATOR_MONGO_ID),
    clerkId: 'clerk_creator',
    email: SECRET_EMAIL,
    username: 'RiftSmith',
    isPublic: true,
    profileImageUrl: 'https://img.clerk.com/rift.png',
    customBio: null,
    suspendedAt: null,
    bookmarks: [],
    updatedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  }
}

function signedIn(userId: string, mongoUserId?: string) {
  mocks.auth.mockResolvedValue({ userId, sessionClaims: mongoUserId ? { mongo_user_id: mongoUserId } : {} })
}

beforeEach(() => {
  heroes = [buildHero()]
  users = [
    buildCreator(),
    { _id: new Types.ObjectId(), clerkId: 'clerk_viewer', email: 'viewer.secret@example.com', username: null, bookmarks: [new Types.ObjectId(HERO_ID)] },
    { _id: new Types.ObjectId(), clerkId: 'clerk_commenter', email: 'commenter.secret@example.com', username: null, bookmarks: [] },
  ]

  mocks.auth.mockResolvedValue({ userId: null })
  mocks.dbConnect.mockResolvedValue(undefined)
  mocks.clerkClient.mockResolvedValue({ users: { getUserList: vi.fn().mockResolvedValue({ data: [] }) } })
  mocks.heroFindOne.mockImplementation((filter: Filter) => query(heroes.find(hero => matches(hero, filter)) ?? null))
  mocks.heroInfoFindOne.mockImplementation(() => query({
    heroId: new Types.ObjectId(HERO_ID),
    nameType: 'text',
    nameValue: 'Rift Walker',
    tag1Text: 'Tank',
    tag2Text: 'Brawler',
    tag3Text: '',
    tagColor: '#33DEBB',
    backstory: 'A drifter from the rift.',
  }))
  mocks.heroInfoAggregate.mockResolvedValue([])
  mocks.heroAggregate.mockResolvedValue([])
  mocks.relatedFindOne.mockImplementation(() => query(null))
  mocks.userFind.mockImplementation((filter: Filter) => query(users.filter(user => matches(user, filter))))
  mocks.userFindOne.mockImplementation((filter: Filter) => query(users.find(user => matches(user, filter)) ?? null))
  mocks.commentFind.mockImplementation(() => query([{
    _id: new Types.ObjectId(COMMENT_ID),
    heroId: new Types.ObjectId(HERO_ID),
    userId: 'clerk_commenter',
    content: 'Love it',
    moderationStatus: 'clean',
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  }]))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function expectNoPrivateData(value: unknown) {
  const json = JSON.stringify(value)

  expect(json).not.toContain(SECRET_EMAIL)
  expect(json).not.toContain('secret.person')
  expect(json).not.toContain('commenter.secret')
  expect(json).not.toContain('viewer.secret')
  expect(json).not.toContain(CREATOR_MONGO_ID)
  expect(json).not.toContain('clerk_creator')
  expect(json).not.toContain('clerk_commenter')
  expect(json).not.toContain('"creatorId"')
  expect(json).not.toContain('"createdByUserId"')
  expect(json).not.toContain('"userId"')
  expect(json).not.toContain('"interactions"')
  expect(json).not.toContain(PRIVATE_TARGET_NAME)
  expect(json).not.toContain('likedBy"')
}

describe('getPublicHeroPage', () => {
  it('returns null for malformed slugs without touching the database', async () => {
    for (const slug of ['', 'Rift-Walker', 'a'.repeat(161), '../x', 'rift walker']) {
      await expect(getPublicHeroPage(slug)).resolves.toBeNull()
    }

    expect(mocks.dbConnect).not.toHaveBeenCalled()
    expect(mocks.heroFindOne).not.toHaveBeenCalled()
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('returns null for a missing hero', async () => {
    await expect(getPublicHeroPage('nobody-here')).resolves.toBeNull()
  })

  it('renders a public hero for guests with comments and no private data', async () => {
    const page = await getPublicHeroPage('rift-walker')

    expect(page).not.toBeNull()
    expect(page?.visibility).toBe('public')
    expect(page?.canonicalPath).toBe('/characters/rift-walker')
    expect(page?.description).toBe('A drifter from the rift.')
    expect(page?.viewer).toEqual({ isSignedIn: false, isOwner: false, liked: false, bookmarked: false })
    expect(page?.creator).toEqual({
      username: 'RiftSmith',
      profilePath: '/profile/RiftSmith',
      avatarUrl: 'https://img.clerk.com/rift.png',
      level: 'New User',
    })
    expect(page?.comments).toEqual([{
      id: COMMENT_ID,
      heroId: HERO_ID,
      authorName: 'Unknown user',
      content: 'Love it',
      viewerCanDelete: false,
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    }])
    expect(page?.hero).not.toHaveProperty('creatorId')
    expect(page?.hero).not.toHaveProperty('creator')
    expect(page?.hero).not.toHaveProperty('interactions')
    expectNoPrivateData(page)
  })

  it('uses the public predicate for guests', async () => {
    await getPublicHeroPage('rift-walker')

    expect(mocks.heroFindOne).toHaveBeenCalledWith({
      slug: 'rift-walker',
      $or: [{ status: 'published', moderationStatus: { $ne: 'hidden' } }],
    })
  })

  it('reports liked and bookmarked state for a signed-in viewer', async () => {
    signedIn('clerk_viewer')

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.viewer).toEqual({ isSignedIn: true, isOwner: false, liked: true, bookmarked: true })
    expectNoPrivateData(page)
  })

  it.each([
    ['private', { status: 'private' }],
    ['hidden', { moderationStatus: 'hidden' }],
    ['hidden and private', { status: 'private', moderationStatus: 'hidden' }],
  ])('hides a %s hero from guests and signed-in non-owners', async (_label, overrides) => {
    heroes = [buildHero(overrides)]

    await expect(getPublicHeroPage('rift-walker')).resolves.toBeNull()

    signedIn('clerk_viewer')

    await expect(getPublicHeroPage('rift-walker')).resolves.toBeNull()
    expect(mocks.commentFind).not.toHaveBeenCalled()
  })

  it('matches owners via createdByUserId $in ownerIds', async () => {
    signedIn('clerk_creator', CREATOR_MONGO_ID)

    await getPublicHeroPage('rift-walker')

    expect(mocks.heroFindOne).toHaveBeenCalledWith({
      slug: 'rift-walker',
      $or: [
        { status: 'published', moderationStatus: { $ne: 'hidden' } },
        { createdByUserId: { $in: ['clerk_creator', CREATOR_MONGO_ID] } },
      ],
    })
  })

  it('shows the owner their private hero without comments', async () => {
    heroes = [buildHero({ status: 'private' })]
    signedIn('clerk_creator', CREATOR_MONGO_ID)

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.visibility).toBe('owner-private')
    expect(page?.viewer.isOwner).toBe(true)
    expect(page?.comments).toEqual([])
    expect(mocks.commentFind).not.toHaveBeenCalled()
    expect(page?.hero).not.toHaveProperty('interactions')
  })

  it('shows the owner their hidden hero as owner-hidden, even when published', async () => {
    heroes = [buildHero({ moderationStatus: 'hidden' })]
    signedIn('clerk_creator', CREATOR_MONGO_ID)

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.visibility).toBe('owner-hidden')
    expect(page?.comments).toEqual([])
    expect(mocks.commentFind).not.toHaveBeenCalled()
  })

  it('shows the owner a public hero with comments and no banner state', async () => {
    signedIn('clerk_creator', CREATOR_MONGO_ID)

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.visibility).toBe('public')
    expect(page?.viewer.isOwner).toBe(true)
    expect(page?.comments).toHaveLength(1)
  })

  it('never uses the email local-part for the creator', async () => {
    users[0] = buildCreator({ username: null })

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.creator.username).toBe('Unknown creator')
    expect(page?.creator.profilePath).toBeNull()
    expect(page?.description).toBe('A drifter from the rift.')
    expectNoPrivateData(page)
  })

  it('omits the profile link for a private creator profile', async () => {
    users[0] = buildCreator({ isPublic: false })

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.creator).toMatchObject({ username: 'RiftSmith', profilePath: null })
  })

  it('shows the commenter registered username and lets the author delete', async () => {
    users[2] = { ...users[2], username: 'Commenter1' }
    signedIn('clerk_commenter')

    const page = await getPublicHeroPage('rift-walker')

    expect(page?.comments[0]).toMatchObject({ authorName: 'Commenter1', viewerCanDelete: true })
    expect(page?.comments[0]).not.toHaveProperty('userId')
  })
})

describe('listHeroComments (unchanged)', () => {
  it('still returns userId and the existing display-name fallback', async () => {
    const comments = await listHeroComments(HERO_ID)

    expect(comments[0]).toMatchObject({ userId: 'clerk_commenter', authorName: 'commenter.secret' })
  })
})

describe('getPublicHeroForMetadata', () => {
  it('is session-independent: never calls auth, currentUser, or the Clerk API', async () => {
    const metadata = await getPublicHeroForMetadata('rift-walker')

    expect(metadata).toEqual({
      id: HERO_ID,
      slug: 'rift-walker',
      displayName: 'Rift Walker',
      description: 'A drifter from the rift.',
      portrait: 'https://utfs.io/f/portrait.png',
      tags: ['Tank', 'Brawler'],
      accentColor: '#33DEBB',
      creator: {
        username: 'RiftSmith',
        profilePath: '/profile/RiftSmith',
        avatarUrl: 'https://img.clerk.com/rift.png',
        level: 'New User',
      },
      likesCount: 2,
      canonicalPath: '/characters/rift-walker',
    })
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.currentUser).not.toHaveBeenCalled()
    expect(mocks.clerkClient).not.toHaveBeenCalled()
    expectNoPrivateData(metadata)
  })

  it('uses the public-only filter', async () => {
    await getPublicHeroForMetadata('rift-walker')

    expect(mocks.heroFindOne).toHaveBeenCalledWith({ slug: 'rift-walker', status: 'published', moderationStatus: { $ne: 'hidden' } })
  })

  it('returns null for private, hidden, missing, and malformed heroes, even for the owner', async () => {
    signedIn('clerk_creator', CREATOR_MONGO_ID)

    for (const overrides of [{ status: 'private' }, { moderationStatus: 'hidden' }]) {
      heroes = [buildHero(overrides)]

      await expect(getPublicHeroForMetadata('rift-walker')).resolves.toBeNull()
    }

    await expect(getPublicHeroForMetadata('missing-hero')).resolves.toBeNull()
    await expect(getPublicHeroForMetadata('Rift-Walker')).resolves.toBeNull()
    expect(mocks.auth).not.toHaveBeenCalled()
  })
})

describe('listPublicHeroSitemapEntries', () => {
  it('lists public heroes with real updatedAt, drops invalid slugs, and caps the result', async () => {
    const chain = query([
      { slug: 'rift-walker', updatedAt: new Date('2026-08-02T00:00:00.000Z') },
      { slug: 'Bad Slug', updatedAt: new Date('2026-08-01T00:00:00.000Z') },
      { slug: 'no-date' },
    ])

    mocks.heroFind.mockReturnValue(chain)

    await expect(listPublicHeroSitemapEntries()).resolves.toEqual([
      { path: '/characters/rift-walker', lastModified: new Date('2026-08-02T00:00:00.000Z') },
    ])
    expect(mocks.heroFind).toHaveBeenCalledWith({ status: 'published', moderationStatus: { $ne: 'hidden' } })
    expect(chain.sort).toHaveBeenCalledWith({ updatedAt: -1 })
    expect(chain.limit).toHaveBeenCalledWith(5000)
    expect(chain.select).toHaveBeenCalledWith('slug updatedAt')
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('passes a custom limit and never sends limit(0)', async () => {
    const chain = query([])

    mocks.heroFind.mockReturnValue(chain)

    await listPublicHeroSitemapEntries(10)
    expect(chain.limit).toHaveBeenCalledWith(10)

    await expect(listPublicHeroSitemapEntries(0)).resolves.toEqual([])
    expect(mocks.heroFind).toHaveBeenCalledTimes(1)
  })
})

describe('listPublicProfileSitemapEntries', () => {
  beforeEach(() => {
    mocks.heroAggregate.mockResolvedValue([
      { _id: CREATOR_MONGO_ID, updatedAt: new Date('2026-08-10T00:00:00.000Z') },
      { _id: 'clerk_second', updatedAt: new Date('2026-08-01T00:00:00.000Z') },
      { _id: 'clerk_private', updatedAt: new Date('2026-08-11T00:00:00.000Z') },
      { _id: 'clerk_suspended', updatedAt: new Date('2026-08-11T00:00:00.000Z') },
      { _id: 'clerk_unregistered', updatedAt: new Date('2026-08-11T00:00:00.000Z') },
    ])
    users = [
      buildCreator(),
      { _id: new Types.ObjectId(), clerkId: 'clerk_second', username: 'Second', isPublic: true, suspendedAt: null, updatedAt: new Date('2026-08-07T00:00:00.000Z') },
      { _id: new Types.ObjectId(), clerkId: 'clerk_private', username: 'Private', isPublic: false, suspendedAt: null, updatedAt: new Date() },
      { _id: new Types.ObjectId(), clerkId: 'clerk_suspended', username: 'Suspended', isPublic: true, suspendedAt: new Date(), updatedAt: new Date() },
      { _id: new Types.ObjectId(), clerkId: 'clerk_unregistered', username: '', email: SECRET_EMAIL, isPublic: true, suspendedAt: null, updatedAt: new Date() },
    ]
  })

  it('aggregates public heroes per creator and filters users by the indexing rule', async () => {
    const entries = await listPublicProfileSitemapEntries()

    expect(mocks.heroAggregate).toHaveBeenCalledWith([
      { $match: { status: 'published', moderationStatus: { $ne: 'hidden' } } },
      { $group: { _id: '$createdByUserId', updatedAt: { $max: '$updatedAt' } } },
    ])
    expect(mocks.userFind).toHaveBeenCalledWith(expect.objectContaining({
      username: { $type: 'string', $ne: '' },
      isPublic: { $ne: false },
      suspendedAt: null,
    }))
    expect(entries).toEqual([
      // Latest of the hero (08-10) and the user (08-05).
      { path: '/profile/RiftSmith', lastModified: new Date('2026-08-10T00:00:00.000Z') },
      // Latest of the hero (08-01) and the user (08-07).
      { path: '/profile/Second', lastModified: new Date('2026-08-07T00:00:00.000Z') },
    ])
    expect(JSON.stringify(entries)).not.toContain('secret.person')
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('applies the limit after sorting', async () => {
    await expect(listPublicProfileSitemapEntries(1)).resolves.toEqual([
      { path: '/profile/RiftSmith', lastModified: new Date('2026-08-10T00:00:00.000Z') },
    ])
  })

  it('returns nothing when there are no public heroes', async () => {
    mocks.heroAggregate.mockResolvedValue([])

    await expect(listPublicProfileSitemapEntries()).resolves.toEqual([])
    expect(mocks.userFind).not.toHaveBeenCalled()
  })
})

describe('getPublicProfileSeo', () => {
  beforeEach(() => {
    mocks.heroCountDocuments.mockResolvedValue(2)
  })

  afterEach(() => {
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.currentUser).not.toHaveBeenCalled()
    expect(mocks.clerkClient).not.toHaveBeenCalled()
  })

  it('returns indexable SEO data for a public creator with public heroes', async () => {
    users[0] = buildCreator({ customBio: 'Builds heroes.' })

    const seo = await getPublicProfileSeo('RiftSmith')

    expect(seo).toEqual({
      status: 'indexable',
      username: 'RiftSmith',
      canonicalPath: '/profile/RiftSmith',
      description: 'Builds heroes.',
      bio: 'Builds heroes.',
      ogImageUrl: 'https://img.clerk.com/rift.png',
      publicHeroCount: 2,
      updatedAt: '2026-08-05T00:00:00.000Z',
    })
    expect(mocks.heroCountDocuments).toHaveBeenCalledWith({
      createdByUserId: { $in: ['clerk_creator', CREATOR_MONGO_ID] },
      status: 'published',
      moderationStatus: { $ne: 'hidden' },
    })
    expectNoPrivateData(seo)
  })

  it('looks the segment up by username or Clerk ID', async () => {
    const seo = await getPublicProfileSeo('clerk_creator')

    expect(mocks.userFindOne).toHaveBeenCalledWith({ $or: [{ username: 'clerk_creator' }, { clerkId: 'clerk_creator' }] })
    expect(seo.canonicalPath).toBe('/profile/RiftSmith')
  })

  it('decodes the segment', async () => {
    users[0] = buildCreator({ username: 'Rift Smith' })

    const seo = await getPublicProfileSeo('Rift%20Smith')

    expect(seo.status).toBe('indexable')
    expect(seo.canonicalPath).toBe('/profile/Rift%20Smith')
  })

  it('treats a malformed segment as missing without a query', async () => {
    const seo = await getPublicProfileSeo('%E0%A4%A')

    expect(seo.status).toBe('missing')
    expect(mocks.userFindOne).not.toHaveBeenCalled()
  })

  it('returns missing for an unknown user', async () => {
    await expect(getPublicProfileSeo('nobody')).resolves.toEqual({
      status: 'missing',
      username: null,
      canonicalPath: null,
      description: null,
      bio: null,
      ogImageUrl: null,
      publicHeroCount: 0,
      updatedAt: null,
    })
  })

  it('returns private with no data for a private profile', async () => {
    users[0] = buildCreator({ isPublic: false, customBio: 'Private bio' })

    const seo = await getPublicProfileSeo('RiftSmith')

    expect(seo).toEqual({
      status: 'private',
      username: null,
      canonicalPath: null,
      description: null,
      bio: null,
      ogImageUrl: null,
      publicHeroCount: 0,
      updatedAt: null,
    })
    expect(mocks.heroCountDocuments).not.toHaveBeenCalled()
  })

  it('is noindex without a public hero', async () => {
    mocks.heroCountDocuments.mockResolvedValue(0)

    const seo = await getPublicProfileSeo('RiftSmith')

    expect(seo).toMatchObject({
      status: 'noindex',
      username: 'RiftSmith',
      canonicalPath: null,
      description: 'RiftSmith has published 0 fan-made Deadlock hero concepts on Cursed Concepts.',
    })
  })

  it('is noindex for a suspended creator', async () => {
    users[0] = buildCreator({ suspendedAt: new Date() })

    await expect(getPublicProfileSeo('RiftSmith')).resolves.toMatchObject({ status: 'noindex', canonicalPath: null })
  })

  it('is noindex without a registered username and never uses the email', async () => {
    users[0] = buildCreator({ username: null })

    const seo = await getPublicProfileSeo('clerk_creator')

    expect(seo).toMatchObject({ status: 'noindex', username: null, canonicalPath: null })
    expectNoPrivateData(seo)
  })

  it('drops unsafe stored avatars and ignores the default bio', async () => {
    users[0] = buildCreator({ profileImageUrl: 'http://evil.com/a.png', customBio: 'No profile bio has been added yet.' })

    const seo = await getPublicProfileSeo('RiftSmith')

    expect(seo.ogImageUrl).toBeNull()
    expect(seo.bio).toBeNull()
    expect(seo.description).toBe('RiftSmith has published 2 fan-made Deadlock hero concepts on Cursed Concepts.')
  })
})

describe('loadOgImageDataUrl', () => {
  function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response

      return response
    })

    vi.stubGlobal('fetch', fetchMock)

    return fetchMock
  }

  it('rejects unsafe URLs without fetching', async () => {
    const fetchMock = stubFetch(new Response('x'))

    for (const url of [
      'https://evil.com/a.png',
      'http://img.clerk.com/a.png',
      'https://127.0.0.1/a.png',
      'https://user:pass@img.clerk.com/a.png',
      'data:image/png;base64,AAAA',
      '//img.clerk.com/a.png',
    ]) {
      expect(isSafeOgImageUrl(url)).toBe(false)
      await expect(loadOgImageDataUrl(url)).resolves.toBeNull()
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects path traversal and non-raster local files', async () => {
    for (const url of ['/../package.json', '/../../etc/passwd.png', '/icon/../../package.png', '/landing/x.webp', '/landing/x.svg']) {
      await expect(loadOgImageDataUrl(url)).resolves.toBeNull()
    }
  })

  it('reads a local png from public/ as a data URL', async () => {
    const dataUrl = await loadOgImageDataUrl('/icon/boon_scaling.png')

    expect(dataUrl).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
  })

  it('returns null for a missing local file', async () => {
    await expect(loadOgImageDataUrl('/icon/does-not-exist.png')).resolves.toBeNull()
  })

  it('fetches allowlisted images with redirect: error, no-store, and a timeout signal', async () => {
    const fetchMock = stubFetch(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))

    await expect(loadOgImageDataUrl('https://utfs.io/f/a.png')).resolves.toBe('data:image/png;base64,AQID')
    expect(fetchMock).toHaveBeenCalledWith('https://utfs.io/f/a.png', expect.objectContaining({
      redirect: 'error',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }))
  })

  it('rejects unexpected content types', async () => {
    for (const contentType of ['text/html', 'image/svg+xml', 'image/webp']) {
      stubFetch(new Response('<svg/>', { headers: { 'content-type': contentType } }))

      await expect(loadOgImageDataUrl('https://utfs.io/f/a.png')).resolves.toBeNull()
    }
  })

  it('rejects a declared content-length over 4 MB', async () => {
    stubFetch(new Response('x', { headers: { 'content-type': 'image/jpeg', 'content-length': String(4 * 1024 * 1024 + 1) } }))

    await expect(loadOgImageDataUrl('https://utfs.io/f/a.jpg')).resolves.toBeNull()
  })

  it('rejects a streamed body over 4 MB without a content-length', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1
        controller.enqueue(chunk)

        if (sent > 5) controller.close()
      },
    })

    stubFetch(new Response(body, { headers: { 'content-type': 'image/gif' } }))

    await expect(loadOgImageDataUrl('https://utfs.io/f/a.gif')).resolves.toBeNull()
  })

  it('returns null on non-OK responses and fetch errors (including redirects)', async () => {
    stubFetch(new Response('nope', { status: 404, headers: { 'content-type': 'image/png' } }))
    await expect(loadOgImageDataUrl('https://utfs.io/f/a.png')).resolves.toBeNull()

    stubFetch(new TypeError('fetch failed: redirect mode is set to error'))
    await expect(loadOgImageDataUrl('https://utfs.io/f/a.png')).resolves.toBeNull()
  })
})
