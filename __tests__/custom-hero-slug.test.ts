import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbConnect: vi.fn(),
  heroExists: vi.fn(),
  heroFindOne: vi.fn(),
  heroFindOneAndUpdate: vi.fn(),
  relatedFindOneAndUpdate: vi.fn(),
  relatedFindOne: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, clerkClient: vi.fn() }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect, isDatabaseConnectionError: vi.fn(() => false) }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('@/lib/user-suspension', () => ({ assertUserNotSuspended: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(), resolveRecipientClerkId: vi.fn() }))
vi.mock('@/lib/models/CustomHero', () => ({
  default: {
    exists: mocks.heroExists,
    findOne: mocks.heroFindOne,
    findOneAndUpdate: mocks.heroFindOneAndUpdate,
  },
}))


vi.mock('@/lib/models/HeroInfo', () => ({ default: { findOne: mocks.relatedFindOne, findOneAndUpdate: mocks.relatedFindOneAndUpdate } }))
vi.mock('@/lib/models/BoonStats', () => ({ default: { findOne: mocks.relatedFindOne, findOneAndUpdate: mocks.relatedFindOneAndUpdate } }))
vi.mock('@/lib/models/WeaponStats', () => ({ default: { findOne: mocks.relatedFindOne, findOneAndUpdate: mocks.relatedFindOneAndUpdate } }))
vi.mock('@/lib/models/VitalityStats', () => ({ default: { findOne: mocks.relatedFindOne, findOneAndUpdate: mocks.relatedFindOneAndUpdate } }))
vi.mock('@/lib/models/SpiritStats', () => ({ default: { findOne: mocks.relatedFindOne, findOneAndUpdate: mocks.relatedFindOneAndUpdate } }))
vi.mock('@/lib/models/AbilityStats', () => ({ default: { findOne: mocks.relatedFindOne, findOneAndUpdate: mocks.relatedFindOneAndUpdate } }))
vi.mock('@/lib/models/Comment', () => ({ default: {} }))
vi.mock('@/lib/models/Like', () => ({ default: {} }))
vi.mock('@/lib/models/Notification', () => ({ default: {} }))
vi.mock('@/lib/models/User', () => ({ default: {} }))
vi.mock('@/lib/models/Follow', () => ({ default: { find: vi.fn() } }))

import { getUniqueSlug, saveCustomHero } from '@/lib/custom-heroes'
import { HEROES } from '@/lib/hero-data'

const HERO_ID = '507f1f77bcf86cd799439011'

function lean<T>(value: T) {
  return { lean: vi.fn().mockResolvedValue(value) }
}

function buildSavedHero(slug: string, name: string) {
  const now = new Date('2026-08-01T00:00:00.000Z')

  return {
    _id: new Types.ObjectId(HERO_ID),
    name,
    slug,
    portrait: '/panorama/images/heroes/abrams.png',
    render: '/render/Abrams_Render.png',
    background: '/render/Abrams_Render.png',
    renderPosition: { x: 0, y: 0 },
    createdByUserId: 'mongo_owner',
    status: 'private',
    allowCopies: false,
    likesCount: 0,
    likedBy: [],
    moderationStatus: 'clean',
    interactions: [],
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function buildPayload(name: string, id?: string) {
  return {
    ...(id ? { id } : {}),
    name,
    status: 'private',
    hero: { render: '/render/Abrams_Render.png', portrait: '/panorama/images/heroes/abrams.png' },
    abilityStats: {
      abilities: [1, 2, 3, 4].map(slot => ({ slot, name: `Ability ${slot}`, icon: '/icon/boon_scaling.png' })),
    },
  }
}

beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: 'clerk_owner', sessionClaims: { mongo_user_id: 'mongo_owner' } })
  mocks.dbConnect.mockResolvedValue(undefined)
  mocks.heroExists.mockResolvedValue(null)
  mocks.relatedFindOne.mockImplementation(() => lean(null))
  mocks.relatedFindOneAndUpdate.mockResolvedValue(null)
  mocks.heroFindOneAndUpdate.mockImplementation((_filter: unknown, update: { $set: { slug: string; name: string } }) => (
    lean(buildSavedHero(update.$set.slug, update.$set.name))
  ))
})

describe('getUniqueSlug', () => {
  it('reserves official hero slugs: a new hero named "Abrams" gets abrams-2', async () => {
    await expect(getUniqueSlug('Abrams')).resolves.toBe('abrams-2')

    expect(mocks.heroExists).not.toHaveBeenCalledWith({ slug: 'abrams' })
    expect(mocks.heroExists).toHaveBeenCalledWith({ slug: 'abrams-2' })
  })

  it('skips taken custom slugs after the reserved one', async () => {
    mocks.heroExists.mockImplementation(async ({ slug }: { slug: string }) => (slug === 'abrams-2' ? { _id: 'x' } : null))

    await expect(getUniqueSlug('Abrams')).resolves.toBe('abrams-3')
  })

  it('keeps the plain slug for non-official names', async () => {
    await expect(getUniqueSlug('Rift Walker')).resolves.toBe('rift-walker')
  })

  it('treats every official hero slug as taken', async () => {
    for (const hero of HEROES) {
      const slug = await getUniqueSlug(hero.slug)

      expect(slug).not.toBe(hero.slug)
      expect(slug).toBe(`${hero.slug}-2`)
    }
  })

  it('falls back to a random suffix that is not an official slug', async () => {
    mocks.heroExists.mockResolvedValue({ _id: 'taken' })

    const slug = await getUniqueSlug('Abrams')

    expect(slug).toMatch(/^abrams-[0-9a-f]{8}$/)
  })
})

describe('saveCustomHero slug handling', () => {
  it('assigns abrams-2 to a new hero named "Abrams"', async () => {
    const detail = await saveCustomHero(buildPayload('Abrams'))

    expect(mocks.heroFindOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ slug: 'abrams-2', name: 'Abrams' }) }),
      expect.anything(),
    )
    expect(detail.slug).toBe('abrams-2')
  })

  it('keeps an existing slug when the hero is saved again or renamed', async () => {
    // A legacy hero that already owns an official slug keeps it.
    mocks.heroFindOne.mockReturnValue(lean(buildSavedHero('abrams', 'Abrams')))

    const detail = await saveCustomHero(buildPayload('Totally New Name', HERO_ID))

    expect(mocks.heroExists).not.toHaveBeenCalled()
    expect(mocks.heroFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(Types.ObjectId) },
      expect.objectContaining({ $set: expect.objectContaining({ slug: 'abrams', name: 'Totally New Name' }) }),
      expect.anything(),
    )
    expect(detail.slug).toBe('abrams')
  })
})
