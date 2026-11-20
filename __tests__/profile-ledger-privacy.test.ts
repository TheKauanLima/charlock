import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Doc = Record<string, unknown>
type Filter = Record<string, unknown>

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbConnect: vi.fn(),
  isDatabaseConnectionError: vi.fn(() => false),
  userFindOne: vi.fn(),
  userFind: vi.fn(),
  heroFind: vi.fn(),
  commentFind: vi.fn(),
  commentDistinct: vi.fn(),
  likeFind: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect, isDatabaseConnectionError: mocks.isDatabaseConnectionError }))
vi.mock('@/lib/models/User', () => ({ default: { findOne: mocks.userFindOne, find: mocks.userFind } }))
vi.mock('@/lib/models/CustomHero', () => ({ default: { find: mocks.heroFind } }))
vi.mock('@/lib/models/Comment', () => ({ default: { find: mocks.commentFind, distinct: mocks.commentDistinct } }))
vi.mock('@/lib/models/Like', () => ({ default: { find: mocks.likeFind } }))

import { ApiRequestError } from '@/lib/api-errors'
import { listProfileComments, listProfileLikes } from '@/lib/profile-ledger'
import { UNKNOWN_COMMENTER_NAME, UNKNOWN_CREATOR_NAME } from '@/lib/public-page-types'

// --- Minimal in-memory Mongo filter matcher ----------------------------------

function same(left: unknown, right: unknown) {
  return String(left) === String(right)
}

function matchesValue(actual: unknown, condition: unknown): boolean {
  if (condition && typeof condition === 'object' && !(condition instanceof Types.ObjectId) && !Array.isArray(condition)) {
    const operators = condition as Record<string, unknown>

    if ('$in' in operators) {
      const options = operators.$in as unknown[]
      const values = Array.isArray(actual) ? actual : [actual]

      return values.some(value => options.some(option => same(value, option)))
    }

    if ('$ne' in operators) {
      return !same(actual, operators.$ne)
    }
  }

  if (Array.isArray(actual)) {
    return actual.some(value => same(value, condition))
  }

  return same(actual, condition)
}

function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') {
      return (condition as Filter[]).some(branch => matches(doc, branch))
    }

    return matchesValue(doc[key], condition)
  })
}

function query(source: () => Doc[], filter: Filter) {
  let limit = Infinity
  const chain = {
    sort: () => chain,
    select: () => chain,
    limit: (value: number) => {
      limit = value
      return chain
    },
    lean: async () => source()
      .filter(doc => matches(doc, filter))
      .sort((left, right) => {
        const l = left.createdAt instanceof Date ? left.createdAt.getTime() : 0
        const r = right.createdAt instanceof Date ? right.createdAt.getTime() : 0
        return r - l
      })
      .slice(0, limit),
  }

  return chain
}

// --- Fixtures ----------------------------------------------------------------

const OWNER_ID = 'clerk_owner'
const VIEWER_ID = 'clerk_viewer'
const THIRD_ID = 'clerk_third'
const COMMENTER_ID = 'clerk_commenter'
const ANON_ID = 'clerk_anon'

const HERO_PUBLIC = new Types.ObjectId()
const HERO_DRAFT = new Types.ObjectId()
const HERO_HIDDEN = new Types.ObjectId()
const HERO_THIRD_PUBLIC = new Types.ObjectId()
const HERO_THIRD_PRIVATE = new Types.ObjectId()

const PUBLIC_FILTER = { status: 'published', moderationStatus: { $ne: 'hidden' } }

let users: Doc[]
let heroes: Doc[]
let comments: Doc[]
let likes: Doc[]

function date(day: number) {
  return new Date(Date.UTC(2026, 7, day))
}

function buildFixtures(ownerIsPublic: boolean) {
  users = [
    { _id: new Types.ObjectId(), clerkId: OWNER_ID, email: 'owner.secret@example.com', username: 'RiftSmith', isPublic: ownerIsPublic },
    { _id: new Types.ObjectId(), clerkId: VIEWER_ID, email: 'viewer.secret@example.com', username: 'Viewer', isPublic: true },
    { _id: new Types.ObjectId(), clerkId: THIRD_ID, email: 'secret.person@example.com', username: null, isPublic: true },
    { _id: new Types.ObjectId(), clerkId: COMMENTER_ID, email: 'commenter.secret@example.com', username: 'Tril', isPublic: true },
    { _id: new Types.ObjectId(), clerkId: ANON_ID, email: 'anon.secret@example.com', username: '   ', isPublic: true },
  ]
  heroes = [
    { _id: HERO_PUBLIC, name: 'Arc Light', createdByUserId: OWNER_ID, status: 'published', moderationStatus: 'clean', likedBy: [], likeEvents: [] },
    { _id: HERO_DRAFT, name: 'Secret Draft', createdByUserId: OWNER_ID, status: 'private', moderationStatus: 'clean', likedBy: [], likeEvents: [] },
    { _id: HERO_HIDDEN, name: 'Hidden Relic', createdByUserId: OWNER_ID, status: 'published', moderationStatus: 'hidden', likedBy: [], likeEvents: [] },
    { _id: HERO_THIRD_PUBLIC, name: 'Third Public', createdByUserId: THIRD_ID, status: 'published', moderationStatus: 'clean', likedBy: [], likeEvents: [] },
    { _id: HERO_THIRD_PRIVATE, name: 'Third Unreleased', createdByUserId: THIRD_ID, status: 'private', moderationStatus: 'clean', likedBy: [], likeEvents: [] },
  ]
  comments = [
    { _id: new Types.ObjectId(), heroId: HERO_PUBLIC, userId: COMMENTER_ID, content: 'Received public.', moderationStatus: 'clean', createdAt: date(10) },
    { _id: new Types.ObjectId(), heroId: HERO_DRAFT, userId: COMMENTER_ID, content: 'Received draft.', moderationStatus: 'clean', createdAt: date(9) },
    { _id: new Types.ObjectId(), heroId: HERO_HIDDEN, userId: COMMENTER_ID, content: 'Received hidden.', moderationStatus: 'clean', createdAt: date(8) },
    { _id: new Types.ObjectId(), heroId: HERO_PUBLIC, userId: ANON_ID, content: 'Anon note.', moderationStatus: 'clean', createdAt: date(7) },
    { _id: new Types.ObjectId(), heroId: HERO_THIRD_PUBLIC, userId: OWNER_ID, content: 'Made public.', moderationStatus: 'clean', createdAt: date(6) },
    { _id: new Types.ObjectId(), heroId: HERO_THIRD_PRIVATE, userId: OWNER_ID, content: 'Made unreleased.', moderationStatus: 'clean', createdAt: date(5) },
  ]
  likes = [
    { _id: new Types.ObjectId(), heroId: HERO_THIRD_PUBLIC, userId: OWNER_ID, createdAt: date(4) },
  ]
}

function setViewer(userId: string | null) {
  mocks.auth.mockResolvedValue({ userId })
}

beforeEach(() => {
  vi.clearAllMocks()
  buildFixtures(true)
  setViewer(VIEWER_ID)
  mocks.dbConnect.mockResolvedValue(undefined)
  mocks.isDatabaseConnectionError.mockReturnValue(false)
  mocks.userFindOne.mockImplementation((filter: Filter) => ({
    lean: async () => users.find(user => matches(user, filter)) ?? null,
  }))
  mocks.userFind.mockImplementation((filter: Filter) => query(() => users, filter))
  mocks.heroFind.mockImplementation((filter: Filter) => query(() => heroes, filter))
  mocks.commentFind.mockImplementation((filter: Filter) => query(() => comments, filter))
  mocks.likeFind.mockImplementation((filter: Filter) => query(() => likes, filter))
  mocks.commentDistinct.mockImplementation(async (field: string, filter: Filter) => {
    const values = comments.filter(comment => matches(comment, filter)).map(comment => comment[field] as Types.ObjectId)
    return values.filter((value, index) => values.findIndex(other => same(other, value)) === index)
  })
})

async function expectNotFound(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (reason: unknown) => reason)

  expect(error).toBeInstanceOf(ApiRequestError)
  expect(error).toMatchObject({ status: 404, message: 'User not found' })
}

describe('profile ledger privacy', () => {
  it('(a) hides a private profile from a signed-in non-owner', async () => {
    buildFixtures(false)

    await expectNotFound(listProfileLikes(OWNER_ID))
    await expectNotFound(listProfileComments(OWNER_ID))
    expect(mocks.likeFind).not.toHaveBeenCalled()
    expect(mocks.commentFind).not.toHaveBeenCalled()
  })

  it('(b) hides a private profile from a guest', async () => {
    buildFixtures(false)
    setViewer(null)

    await expectNotFound(listProfileLikes('RiftSmith'))
    await expectNotFound(listProfileComments('RiftSmith'))
  })

  it('(c) returns an identical error for a nonexistent user', async () => {
    await expectNotFound(listProfileLikes('clerk_missing'))
    await expectNotFound(listProfileComments('clerk_missing'))
  })

  it('(d) returns everything to the owner of a private profile', async () => {
    buildFixtures(false)
    setViewer(OWNER_ID)

    const ledger = await listProfileComments(OWNER_ID)
    const likeItems = await listProfileLikes(OWNER_ID)

    expect(ledger.received.map(item => item.heroName)).toEqual(['Arc Light', 'Secret Draft', 'Hidden Relic', 'Arc Light'])
    expect(ledger.received.find(item => item.heroId === HERO_DRAFT.toString())).toMatchObject({ heroName: 'Secret Draft', viewerCanDelete: true })
    expect(ledger.received.find(item => item.heroId === HERO_HIDDEN.toString())).toMatchObject({ heroName: 'Hidden Relic', viewerCanDelete: true })
    expect(ledger.made.map(item => item.heroName)).toEqual(['Third Public', 'Third Unreleased'])
    expect([...ledger.made, ...ledger.received].every(item => item.viewerCanDelete)).toBe(true)
    expect(likeItems).toHaveLength(1)
    expect(likeItems[0]).toMatchObject({ heroId: HERO_THIRD_PUBLIC.toString(), heroName: 'Third Public' })
  })

  it('(e) strips non-public heroes from a public profile for non-owners', async () => {
    const ledger = await listProfileComments(OWNER_ID)
    const json = JSON.stringify(ledger)

    for (const secret of ['Secret Draft', 'Hidden Relic', 'Third Unreleased', HERO_DRAFT.toString(), HERO_HIDDEN.toString(), HERO_THIRD_PRIVATE.toString(), 'Unknown Character']) {
      expect(json).not.toContain(secret)
    }

    expect(ledger.made).toHaveLength(1)
    expect(ledger.made[0]).toEqual({
      id: expect.any(String),
      heroId: HERO_THIRD_PUBLIC.toString(),
      heroName: 'Third Public',
      authorId: OWNER_ID,
      authorName: 'RiftSmith',
      content: 'Made public.',
      createdAt: date(6).toISOString(),
      href: `/?tab=browse&heroId=${encodeURIComponent(HERO_THIRD_PUBLIC.toString())}`,
      viewerCanDelete: false,
    })
    expect(ledger.received.map(item => item.content)).toEqual(['Received public.', 'Anon note.'])
    expect(ledger.received[0]).toMatchObject({ heroName: 'Arc Light', authorName: 'Tril', viewerCanDelete: false })

    const heroFilters = mocks.heroFind.mock.calls.map(([filter]) => filter as Filter)

    expect(heroFilters.length).toBeGreaterThanOrEqual(3)
    for (const filter of heroFilters) {
      expect(filter).toMatchObject(PUBLIC_FILTER)
    }

    const madeQuery = mocks.commentFind.mock.calls
      .map(([filter]) => filter as Filter)
      .find(filter => filter.userId === OWNER_ID)

    expect(madeQuery?.heroId).toEqual({ $in: [HERO_THIRD_PUBLIC] })
  })

  it('(e) skips the made query when no commented hero is public', async () => {
    comments = comments.filter(comment => !same(comment.heroId, HERO_THIRD_PUBLIC))

    const ledger = await listProfileComments(OWNER_ID)

    expect(ledger.made).toEqual([])
    expect(mocks.commentFind.mock.calls.some(([filter]) => (filter as Filter).userId === OWNER_ID)).toBe(false)
  })

  it('(f) never uses email local-parts or raw IDs as names', async () => {
    const ledger = await listProfileComments(OWNER_ID)
    const likeItems = await listProfileLikes(OWNER_ID)
    const anonComment = ledger.received.find(item => item.authorId === ANON_ID)

    expect(anonComment?.authorName).toBe(UNKNOWN_COMMENTER_NAME)
    expect(likeItems[0].creatorName).toBe(UNKNOWN_CREATOR_NAME)

    const names = [...ledger.made, ...ledger.received].map(item => item.authorName).concat(likeItems.map(item => item.creatorName))

    for (const name of names) {
      expect(name).not.toMatch(/secret|clerk_/)
    }
  })

  it('(f) uses placeholders when the user record is missing entirely', async () => {
    users = users.filter(user => user.clerkId !== THIRD_ID && user.clerkId !== ANON_ID)

    const ledger = await listProfileComments(OWNER_ID)
    const likeItems = await listProfileLikes(OWNER_ID)

    expect(ledger.received.find(item => item.authorId === ANON_ID)?.authorName).toBe(UNKNOWN_COMMENTER_NAME)
    expect(likeItems[0].creatorName).toBe(UNKNOWN_CREATOR_NAME)
  })

  it('(f) applies placeholders for the owner too', async () => {
    setViewer(OWNER_ID)

    const ledger = await listProfileComments(OWNER_ID)
    const likeItems = await listProfileLikes(OWNER_ID)

    expect(ledger.received.find(item => item.authorId === ANON_ID)?.authorName).toBe(UNKNOWN_COMMENTER_NAME)
    expect(likeItems[0].creatorName).toBe(UNKNOWN_CREATOR_NAME)
  })

  it('(g) returns everything to the owner of a public profile', async () => {
    setViewer(OWNER_ID)

    const ledger = await listProfileComments(OWNER_ID)

    expect(ledger.received).toHaveLength(4)
    expect(ledger.made.map(item => item.heroName)).toEqual(['Third Public', 'Third Unreleased'])
    expect(JSON.stringify(ledger)).toContain('Secret Draft')
    expect(JSON.stringify(ledger)).toContain('Hidden Relic')
    expect(mocks.commentDistinct).not.toHaveBeenCalled()
  })

  it('(h) returns empty results when the database is unreachable', async () => {
    mocks.dbConnect.mockRejectedValue(new Error('ECONNREFUSED'))
    mocks.isDatabaseConnectionError.mockReturnValue(true)

    await expect(listProfileLikes(OWNER_ID)).resolves.toEqual([])
    await expect(listProfileComments(OWNER_ID)).resolves.toEqual({ made: [], received: [] })
    expect(mocks.userFindOne).not.toHaveBeenCalled()
    expect(mocks.auth).not.toHaveBeenCalled()
  })
})
