import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbConnect: vi.fn(),
  heroFind: vi.fn(),
  heroFindOne: vi.fn(),
  heroDeleteOne: vi.fn(),
  heroDeleteMany: vi.fn(),
  heroInfoDeleteMany: vi.fn(),
  boonDeleteMany: vi.fn(),
  weaponDeleteMany: vi.fn(),
  vitalityDeleteMany: vi.fn(),
  spiritDeleteMany: vi.fn(),
  abilityDeleteMany: vi.fn(),
  commentDeleteMany: vi.fn(),
  likeDeleteMany: vi.fn(),
  notificationDeleteMany: vi.fn(),
  userUpdateMany: vi.fn(),
  assertUserNotSuspended: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect, isDatabaseConnectionError: vi.fn(() => false) }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('@/lib/user-suspension', () => ({ assertUserNotSuspended: mocks.assertUserNotSuspended }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(), resolveRecipientClerkId: vi.fn() }))
vi.mock('@/lib/models/CustomHero', () => ({ default: { find: mocks.heroFind, findOne: mocks.heroFindOne, deleteOne: mocks.heroDeleteOne, deleteMany: mocks.heroDeleteMany } }))
vi.mock('@/lib/models/HeroInfo', () => ({ default: { deleteMany: mocks.heroInfoDeleteMany } }))
vi.mock('@/lib/models/BoonStats', () => ({ default: { deleteMany: mocks.boonDeleteMany } }))
vi.mock('@/lib/models/WeaponStats', () => ({ default: { deleteMany: mocks.weaponDeleteMany } }))
vi.mock('@/lib/models/VitalityStats', () => ({ default: { deleteMany: mocks.vitalityDeleteMany } }))
vi.mock('@/lib/models/SpiritStats', () => ({ default: { deleteMany: mocks.spiritDeleteMany } }))
vi.mock('@/lib/models/AbilityStats', () => ({ default: { deleteMany: mocks.abilityDeleteMany } }))
vi.mock('@/lib/models/Comment', () => ({ default: { deleteMany: mocks.commentDeleteMany } }))
vi.mock('@/lib/models/Like', () => ({ default: { deleteMany: mocks.likeDeleteMany } }))
vi.mock('@/lib/models/Notification', () => ({ default: { deleteMany: mocks.notificationDeleteMany } }))
vi.mock('@/lib/models/User', () => ({ default: { updateMany: mocks.userUpdateMany } }))
vi.mock('@/lib/models/Follow', () => ({ default: {} }))

import { deleteCustomHero, deleteCustomHeroes } from '@/lib/custom-heroes'

const HERO_ID = '507f1f77bcf86cd799439011'
const SECOND_HERO_ID = '507f1f77bcf86cd799439012'

beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: 'clerk_owner', sessionClaims: { mongo_user_id: 'mongo_owner' } })
  mocks.dbConnect.mockResolvedValue(undefined)
  mocks.heroFindOne.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(HERO_ID) }),
    }),
  })
  mocks.heroFind.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: new Types.ObjectId(HERO_ID) },
        { _id: new Types.ObjectId(SECOND_HERO_ID) },
      ]),
    }),
  })
})

describe('custom hero deletion', () => {
  it('checks ownership and removes every database record referencing the hero', async () => {
    await expect(deleteCustomHero(HERO_ID)).resolves.toEqual({ id: HERO_ID, deleted: true })

    expect(mocks.heroFindOne).toHaveBeenCalledWith({
      _id: expect.any(Types.ObjectId),
      createdByUserId: { $in: ['clerk_owner', 'mongo_owner'] },
    })
    expect(mocks.heroDeleteOne).toHaveBeenCalledWith({ _id: expect.any(Types.ObjectId) })

    for (const deleteMany of [
      mocks.heroInfoDeleteMany,
      mocks.boonDeleteMany,
      mocks.weaponDeleteMany,
      mocks.vitalityDeleteMany,
      mocks.spiritDeleteMany,
      mocks.abilityDeleteMany,
      mocks.commentDeleteMany,
      mocks.likeDeleteMany,
    ]) {
      expect(deleteMany).toHaveBeenCalledWith({ heroId: expect.any(Types.ObjectId) })
    }

    expect(mocks.notificationDeleteMany).toHaveBeenCalledWith({
      $or: [{ targetId: expect.any(Types.ObjectId) }, { relatedHeroId: expect.any(Types.ObjectId) }],
    })
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({}, { $pull: { bookmarks: expect.any(Types.ObjectId) } })
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(
      { profileBackground: `custom:${HERO_ID}` },
      { $set: { profileBackground: null } },
    )
  })

  it('validates ownership before deleting multiple heroes and their dependent records', async () => {
    await expect(deleteCustomHeroes({ ids: [HERO_ID, SECOND_HERO_ID] })).resolves.toEqual({
      ids: [HERO_ID, SECOND_HERO_ID],
      deletedCount: 2,
    })

    expect(mocks.heroFind).toHaveBeenCalledWith({
      _id: { $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)] },
      createdByUserId: { $in: ['clerk_owner', 'mongo_owner'] },
    })
    expect(mocks.heroDeleteMany).toHaveBeenCalledWith({
      _id: { $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)] },
    })
    expect(mocks.heroInfoDeleteMany).toHaveBeenCalledWith({
      heroId: { $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)] },
    })
    expect(mocks.notificationDeleteMany).toHaveBeenCalledWith({
      $or: [
        { targetId: { $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)] } },
        { relatedHeroId: { $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)] } },
      ],
    })
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({}, {
      $pull: { bookmarks: { $in: [expect.any(Types.ObjectId), expect.any(Types.ObjectId)] } },
    })
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(
      { profileBackground: { $in: [`custom:${HERO_ID}`, `custom:${SECOND_HERO_ID}`] } },
      { $set: { profileBackground: null } },
    )
  })
})
