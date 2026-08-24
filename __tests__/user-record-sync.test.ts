import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  findOneAndUpdateMock: vi.fn(),
}))

vi.mock('@/lib/models/User', () => ({
  default: {
    findOne: mocks.findOneMock,
    findOneAndUpdate: mocks.findOneAndUpdateMock,
  },
}))

function queryResult<T>(value: T) {
  const lean = vi.fn().mockResolvedValue(value)
  const select = vi.fn(() => ({ lean }))

  return { select, lean }
}

beforeEach(() => {
  mocks.findOneMock.mockReset()
  mocks.findOneAndUpdateMock.mockReset()
})

describe('syncUserRecordFromClerk', () => {
  it('reuses an existing email-owned record when the Clerk ID changed', async () => {
    const emailRecord = {
      _id: new Types.ObjectId(),
      clerkId: 'clerk_old',
      email: 'trilogythegamer2@gmail.com',
      username: 'original_name',
    }
    const updatedRecord = {
      ...emailRecord,
      clerkId: 'clerk_new',
    }

    mocks.findOneMock
      .mockReturnValueOnce(queryResult(null))
      .mockReturnValueOnce(queryResult(emailRecord))
    mocks.findOneAndUpdateMock.mockReturnValue(queryResult(updatedRecord))

    const { syncUserRecordFromClerk } = await import('@/lib/user-record-sync')
    const result = await syncUserRecordFromClerk({
      clerkId: 'clerk_new',
      email: 'TrilogyTheGamer2@gmail.com',
      username: 'trilogy',
      emailVerified: true,
      firstName: 'Tri',
      lastName: 'Logy',
      profileImageUrl: 'https://img.clerk.com/avatar.png',
    })

    expect(result).toEqual(updatedRecord)
    expect(mocks.findOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: emailRecord._id },
      {
        $set: {
          clerkId: 'clerk_new',
          email: 'trilogythegamer2@gmail.com',
          emailVerified: true,
          firstName: 'Tri',
          lastName: 'Logy',
          profileImageUrl: 'https://img.clerk.com/avatar.png',
        },
      },
      {
        upsert: false,
        returnDocument: 'after',
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
  })

  it('does not write a duplicate email when Clerk and email records are split', async () => {
    const clerkRecord = {
      _id: new Types.ObjectId(),
      clerkId: 'clerk_current',
      email: 'old@example.com',
      username: null,
    }
    const emailRecord = {
      _id: new Types.ObjectId(),
      clerkId: 'clerk_old',
      email: 'trilogythegamer2@gmail.com',
    }

    mocks.findOneMock
      .mockReturnValueOnce(queryResult(clerkRecord))
      .mockReturnValueOnce(queryResult(emailRecord))
    mocks.findOneAndUpdateMock.mockReturnValue(queryResult(clerkRecord))

    const { syncUserRecordFromClerk } = await import('@/lib/user-record-sync')
    await syncUserRecordFromClerk({
      clerkId: 'clerk_current',
      email: 'trilogythegamer2@gmail.com',
      username: null,
      emailVerified: true,
      firstName: null,
      lastName: null,
    })

    const update = mocks.findOneAndUpdateMock.mock.calls[0][1]

    expect(mocks.findOneAndUpdateMock.mock.calls[0][0]).toEqual({ _id: clerkRecord._id })
    expect(update.$set).not.toHaveProperty('email')
    expect(update.$set).toMatchObject({
      clerkId: 'clerk_current',
      emailVerified: true,
      firstName: null,
      lastName: null,
    })
    expect(update.$set).not.toHaveProperty('username')
    expect(update.$set).not.toHaveProperty('profileImageUrl')
  })

  it('generates a stable username only when the email has no existing account', async () => {
    const createdRecord = {
      _id: new Types.ObjectId(),
      clerkId: 'clerk_google_new',
      email: 'new.player@example.com',
      username: 'new_player_abc123',
    }

    mocks.findOneMock
      .mockReturnValueOnce(queryResult(null))
      .mockReturnValueOnce(queryResult(null))
      .mockReturnValueOnce(queryResult(null))
    mocks.findOneAndUpdateMock.mockReturnValue(queryResult(createdRecord))

    const { syncUserRecordFromClerk } = await import('@/lib/user-record-sync')
    await syncUserRecordFromClerk({
      clerkId: 'clerk_google_new',
      email: 'New.Player@example.com',
      username: null,
      emailVerified: true,
      firstName: 'New',
      lastName: 'Player',
    })

    const update = mocks.findOneAndUpdateMock.mock.calls[0][1]

    expect(mocks.findOneAndUpdateMock.mock.calls[0][0]).toEqual({ clerkId: 'clerk_google_new' })
    expect(update.$set.username).toMatch(/^new_player_[a-z0-9]{6}$/)
    expect(update.$set.email).toBe('new.player@example.com')
  })
})
