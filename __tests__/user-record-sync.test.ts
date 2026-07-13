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
    }
    const updatedRecord = {
      ...emailRecord,
      clerkId: 'clerk_new',
      username: 'trilogy',
    }

    mocks.findOneMock
      .mockReturnValueOnce(queryResult(null))
      .mockReturnValueOnce(queryResult(emailRecord))
      .mockReturnValueOnce(queryResult(null))
    mocks.findOneAndUpdateMock.mockReturnValue(queryResult(updatedRecord))

    const { syncUserRecordFromClerk } = await import('@/lib/user-record-sync')
    const result = await syncUserRecordFromClerk({
      clerkId: 'clerk_new',
      email: 'TrilogyTheGamer2@gmail.com',
      username: 'trilogy',
      emailVerified: true,
      firstName: 'Tri',
      lastName: 'Logy',
    })

    expect(result).toEqual(updatedRecord)
    expect(mocks.findOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: emailRecord._id },
      {
        $set: {
          clerkId: 'clerk_new',
          email: 'trilogythegamer2@gmail.com',
          username: 'trilogy',
          emailVerified: true,
          firstName: 'Tri',
          lastName: 'Logy',
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
    }
    const emailRecord = {
      _id: new Types.ObjectId(),
      clerkId: 'clerk_old',
      email: 'trilogythegamer2@gmail.com',
    }

    mocks.findOneMock
      .mockReturnValueOnce(queryResult(clerkRecord))
      .mockReturnValueOnce(queryResult(emailRecord))
      .mockReturnValueOnce(queryResult(null))
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
      username: null,
      emailVerified: true,
      firstName: null,
      lastName: null,
    })
  })
})
