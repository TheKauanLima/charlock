import { describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  deleteHeroComment: vi.fn(),
  getActivityFeed: vi.fn(),
  getNotificationState: vi.fn(),
  listHeroComments: vi.fn(),
  postHeroComment: vi.fn(),
  toggleFollow: vi.fn(),
  toggleHeroBookmark: vi.fn(),
}))

vi.mock('@/lib/custom-heroes', () => ({
  CustomHeroError: class CustomHeroError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/lib/social-engagement', () => ({
  deleteHeroComment: serviceMocks.deleteHeroComment,
  getActivityFeed: serviceMocks.getActivityFeed,
  getNotificationState: serviceMocks.getNotificationState,
  listHeroComments: serviceMocks.listHeroComments,
  postHeroComment: serviceMocks.postHeroComment,
  toggleFollow: serviceMocks.toggleFollow,
  toggleHeroBookmark: serviceMocks.toggleHeroBookmark,
}))

import { DELETE, GET as GET_COMMENTS, POST as POST_COMMENT } from '@/app/api/heroes/[slug]/comments/route'
import { POST as POST_BOOKMARK } from '@/app/api/heroes/[slug]/bookmark/route'
import { GET as GET_FEED } from '@/app/api/feed/route'
import { GET as GET_NOTIFICATIONS } from '@/app/api/notifications/route'
import { POST as POST_FOLLOW } from '@/app/api/users/[id]/follow/route'

function buildMutationRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      ...init.headers,
    },
  })
}

describe('social engagement API routes', () => {
  it('lists, creates, and deletes comments', async () => {
    serviceMocks.listHeroComments.mockResolvedValueOnce([{ id: 'comment_1', content: 'Filed.' }])
    serviceMocks.postHeroComment.mockResolvedValueOnce({ id: 'comment_2', content: 'New note.' })
    serviceMocks.deleteHeroComment.mockResolvedValueOnce({ deleted: true })

    const context = { params: Promise.resolve({ slug: 'hero_1' }) }
    const listResponse = await GET_COMMENTS(new Request('http://localhost/api/heroes/hero_1/comments'), context)
    const postResponse = await POST_COMMENT(buildMutationRequest('http://localhost/api/heroes/hero_1/comments', {
      method: 'POST',
      body: JSON.stringify({ content: 'New note.' }),
    }), context)
    const deleteResponse = await DELETE(buildMutationRequest('http://localhost/api/heroes/hero_1/comments?commentId=comment_1', {
      method: 'DELETE',
    }), context)

    expect(listResponse.status).toBe(200)
    await expect(listResponse.json()).resolves.toEqual({ comments: [{ id: 'comment_1', content: 'Filed.' }] })
    expect(postResponse.status).toBe(201)
    await expect(postResponse.json()).resolves.toEqual({ comment: { id: 'comment_2', content: 'New note.' } })
    await expect(deleteResponse.json()).resolves.toEqual({ deleted: true })
    expect(serviceMocks.postHeroComment).toHaveBeenCalledWith('hero_1', 'New note.')
    expect(serviceMocks.deleteHeroComment).toHaveBeenCalledWith('hero_1', 'comment_1')
  })

  it('toggles bookmark and follow state', async () => {
    serviceMocks.toggleHeroBookmark.mockResolvedValueOnce({ heroId: 'hero_1', bookmarked: true })
    serviceMocks.toggleFollow.mockResolvedValueOnce({ userId: 'user_2', following: true, followerCount: 4 })

    const bookmarkResponse = await POST_BOOKMARK(buildMutationRequest('http://localhost/api/heroes/hero_1/bookmark', { method: 'POST' }), {
      params: Promise.resolve({ slug: 'hero_1' }),
    })
    const followResponse = await POST_FOLLOW(buildMutationRequest('http://localhost/api/users/user_2/follow', { method: 'POST' }), {
      params: Promise.resolve({ id: 'user_2' }),
    })

    await expect(bookmarkResponse.json()).resolves.toEqual({ bookmark: { heroId: 'hero_1', bookmarked: true } })
    await expect(followResponse.json()).resolves.toEqual({ follow: { userId: 'user_2', following: true, followerCount: 4 } })
  })

  it('returns activity feed and notification state', async () => {
    serviceMocks.getActivityFeed.mockResolvedValueOnce([{ id: 'comment:1', heroName: 'Arc Light' }])
    serviceMocks.getNotificationState.mockResolvedValueOnce({ hasNotifications: true, count: 2 })

    const feedResponse = await GET_FEED()
    const notificationsResponse = await GET_NOTIFICATIONS()

    await expect(feedResponse.json()).resolves.toEqual({ items: [{ id: 'comment:1', heroName: 'Arc Light' }] })
    await expect(notificationsResponse.json()).resolves.toEqual({ notifications: { hasNotifications: true, count: 2 } })
  })
})
