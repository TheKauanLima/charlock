import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  dbConnect: vi.fn(),
  findOne: vi.fn(),
  getCurrentProfileUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  revalidatePath: vi.fn(),
  updateOne: vi.fn(),
  updateUserMetadata: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ clerkClient: mocks.clerkClient }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/dbConnect', () => ({ default: mocks.dbConnect }))
vi.mock('@/lib/models/CustomHero', () => ({ default: { exists: vi.fn() } }))
vi.mock('@/lib/models/User', () => ({
  default: {
    findOne: mocks.findOne,
    updateOne: mocks.updateOne,
  },
}))
vi.mock('@/lib/profile', () => ({
  getCurrentProfileUser: mocks.getCurrentProfileUser,
  getProfilePathSegment: (user: { username?: string | null; clerkId: string }) => user.username || user.clerkId,
}))

import { updateUsername } from '@/app/profile/actions'

function queryResult<T>(value: T) {
  const lean = vi.fn().mockResolvedValue(value)
  const select = vi.fn(() => ({ lean }))

  return { select }
}

const profileUser = {
  _id: { toString: () => 'mongo_1' },
  clerkId: 'clerk_1',
  email: 'player@example.com',
  username: 'old_name',
  preferredHero: 'abrams',
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset())
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  })
  mocks.getCurrentProfileUser.mockResolvedValue(profileUser)
  mocks.clerkClient.mockResolvedValue({
    users: { updateUserMetadata: mocks.updateUserMetadata },
  })
})

describe('updateUsername', () => {
  it('updates the local profile and Clerk compatibility metadata', async () => {
    mocks.findOne.mockReturnValue(queryResult(null))
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 })
    const formData = new FormData()
    formData.set('username', 'new_name')

    await expect(updateUsername(formData)).rejects.toThrow('NEXT_REDIRECT:/profile/settings?usernameStatus=updated')

    expect(mocks.updateOne).toHaveBeenCalledWith(
      { clerkId: 'clerk_1' },
      { $set: { username: 'new_name' } },
      { runValidators: true },
    )
    expect(mocks.updateUserMetadata).toHaveBeenCalledWith('clerk_1', {
      unsafeMetadata: { username: 'new_name' },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/profile/old_name')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/profile/new_name')
  })

  it('does not modify an account when another user already owns the username', async () => {
    mocks.findOne.mockReturnValue(queryResult({ clerkId: 'clerk_2' }))
    const formData = new FormData()
    formData.set('username', 'Taken_Name')

    await expect(updateUsername(formData)).rejects.toThrow('NEXT_REDIRECT:/profile/settings?usernameError=taken')

    expect(mocks.updateOne).not.toHaveBeenCalled()
    expect(mocks.updateUserMetadata).not.toHaveBeenCalled()
  })
})
