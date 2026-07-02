import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireAdmin: vi.fn(),
  dbConnect: vi.fn(),
  heroExists: vi.fn(),
  heroFindOneAndUpdate: vi.fn(),
  heroUpdateOne: vi.fn(),
  commentExists: vi.fn(),
  commentFindOneAndUpdate: vi.fn(),
  commentUpdateOne: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/admin-guard', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('@/lib/user-suspension', () => ({ assertUserNotSuspended: vi.fn() }))
vi.mock('@/lib/models/CustomHero', () => ({
  default: {
    exists: mocks.heroExists,
    findOneAndUpdate: mocks.heroFindOneAndUpdate,
    updateOne: mocks.heroUpdateOne,
  },
}))
vi.mock('@/lib/models/Comment', () => ({
  default: {
    exists: mocks.commentExists,
    findOneAndUpdate: mocks.commentFindOneAndUpdate,
    updateOne: mocks.commentUpdateOne,
  },
}))
vi.mock('@/lib/models/AbilityStats', () => ({ default: {} }))
vi.mock('@/lib/models/HeroInfo', () => ({ default: {} }))
vi.mock('@/lib/models/Like', () => ({ default: {} }))
vi.mock('@/lib/models/Notification', () => ({ default: {} }))
vi.mock('@/lib/models/SpiritStats', () => ({ default: {} }))
vi.mock('@/lib/models/User', () => ({ default: {} }))
vi.mock('@/lib/models/VitalityStats', () => ({ default: {} }))
vi.mock('@/lib/models/WeaponStats', () => ({ default: {} }))

import { reportComment, reportHero } from '@/lib/moderation'

const HERO_ID = '507f1f77bcf86cd799439011'
const COMMENT_ID = '507f1f77bcf86cd799439012'

function reports(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    reporterId: `user_${index}`,
    reason: 'Spam / Irrelevant' as const,
    createdAt: new Date(`2026-06-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
  }))
}

beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: 'reporter_5' })
  mocks.dbConnect.mockResolvedValue(undefined)
  mocks.heroUpdateOne.mockResolvedValue({ matchedCount: 1 })
  mocks.commentUpdateOne.mockResolvedValue({ matchedCount: 1 })
})

describe('moderation reporting service', () => {
  it('prevents a user from reporting the same character twice', async () => {
    mocks.heroFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    mocks.heroExists.mockResolvedValue({ _id: HERO_ID })

    await expect(reportHero(HERO_ID, { reason: 'Plagiarism' })).rejects.toMatchObject({
      status: 409,
      message: 'You have already reported this character',
    })

    expect(mocks.heroFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'reports.reporterId': { $ne: 'reporter_5' } }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('auto-hides a character exactly when the fifth unique report is stored', async () => {
    mocks.heroFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: HERO_ID, reports: reports(5) }),
    })

    await expect(reportHero(HERO_ID, { reason: 'NSFW Assets', details: 'Unsafe portrait.' })).resolves.toEqual({
      id: HERO_ID,
      reportCount: 5,
      moderationStatus: 'hidden',
    })
    expect(mocks.heroUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { moderationStatus: 'hidden' } },
    )
  })

  it('flags comments below the automatic hiding threshold', async () => {
    mocks.commentFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: COMMENT_ID, reports: reports(4) }),
    })

    await expect(reportComment(COMMENT_ID, { reason: 'Inappropriate Language / Toxic' })).resolves.toEqual({
      id: COMMENT_ID,
      reportCount: 4,
      moderationStatus: 'flagged',
    })
    expect(mocks.commentUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything(), 'reports.4': { $exists: false } },
      { $set: { moderationStatus: 'flagged' } },
    )
  })
})
