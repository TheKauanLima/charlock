import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth, currentUser: mocks.currentUser }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { checkAdmin, isCurrentUserAdmin } from '@/lib/admin-guard'

afterEach(() => {
  delete process.env.ADMIN_USER_IDS
  delete process.env.ADMIN_USER_EMAILS
})

describe('admin guard', () => {
  it('allows configured Clerk IDs and emails', async () => {
    process.env.ADMIN_USER_IDS = 'owner_1'
    mocks.auth.mockResolvedValue({ userId: 'owner_1' })

    await expect(isCurrentUserAdmin()).resolves.toBe(true)

    process.env.ADMIN_USER_IDS = ''
    process.env.ADMIN_USER_EMAILS = 'owner@example.com'
    mocks.auth.mockResolvedValue({ userId: 'owner_2' })
    mocks.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'OWNER@example.com' }] })

    await expect(isCurrentUserAdmin()).resolves.toBe(true)
  })

  it('redirects non-admin users away from the admin workspace', async () => {
    process.env.ADMIN_USER_IDS = 'owner_1'
    mocks.auth.mockResolvedValue({ userId: 'regular_user' })

    await expect(checkAdmin()).rejects.toThrow('redirect:/')
    expect(mocks.redirect).toHaveBeenCalledWith('/')
  })
})
