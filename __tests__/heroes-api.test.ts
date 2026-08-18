import type { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  deleteCustomHeroes: vi.fn(),
  deleteCustomHero: vi.fn(),
  getEditableCustomHero: vi.fn(),
  likeCustomHero: vi.fn(),
  listBookmarkedCustomHeroPage: vi.fn(),
  listCurrentUserCustomHeroes: vi.fn(),
  listCustomHeroPage: vi.fn(),
  recordCustomHeroCopy: vi.fn(),
  saveCustomHero: vi.fn(),
}))

vi.mock('@/lib/custom-heroes', () => ({
  deleteCustomHeroes: serviceMocks.deleteCustomHeroes,
  deleteCustomHero: serviceMocks.deleteCustomHero,
  CustomHeroError: class CustomHeroError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  getEditableCustomHero: serviceMocks.getEditableCustomHero,
  likeCustomHero: serviceMocks.likeCustomHero,
  listBookmarkedCustomHeroPage: serviceMocks.listBookmarkedCustomHeroPage,
  listCurrentUserCustomHeroes: serviceMocks.listCurrentUserCustomHeroes,
  listCustomHeroPage: serviceMocks.listCustomHeroPage,
  recordCustomHeroCopy: serviceMocks.recordCustomHeroCopy,
  saveCustomHero: serviceMocks.saveCustomHero,
}))

import { DELETE, GET, POST, PUT } from '@/app/api/heroes/route'
import { DELETE as DELETE_HERO } from '@/app/api/heroes/[slug]/route'
import { POST as POST_COPY } from '@/app/api/heroes/[slug]/copy/route'
import { POST as POST_LIKE } from '@/app/api/heroes/[slug]/like/route'

function buildNextRequest(url: string) {
  return {
    nextUrl: new URL(url),
  } as NextRequest
}

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

describe('heroes API route', () => {
  it('lists published heroes with requested sort', async () => {
    serviceMocks.listCustomHeroPage.mockResolvedValueOnce({
      heroes: [{
        id: 'hero_1',
        displayName: 'Arc Light',
        likesCount: 3,
        creator: {
          userId: 'user_creator_1',
          username: 'Rift Smith',
          profileSlug: 'rift_smith',
          avatarUrl: 'https://example.com/rift-smith.png',
          level: 'Contributor',
          preferredHero: 'haze',
        },
      }],
      pagination: { limit: 12, offset: 24, total: 30, hasMore: false },
    })

    const response = await GET(buildNextRequest('http://localhost/api/heroes?status=published&sort=trending&search=arc&limit=12&offset=24'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      heroes: [{
        id: 'hero_1',
        displayName: 'Arc Light',
        likesCount: 3,
        creator: {
          userId: 'user_creator_1',
          username: 'Rift Smith',
          profileSlug: 'rift_smith',
          avatarUrl: 'https://example.com/rift-smith.png',
          level: 'Contributor',
          preferredHero: 'haze',
        },
      }],
      pagination: { limit: 12, offset: 24, total: 30, hasMore: false },
    })
    expect(serviceMocks.listCustomHeroPage).toHaveBeenCalledWith({
      status: 'published',
      sort: 'trending',
      search: 'arc',
      limit: 12,
      offset: 24,
    })
  })

  it('fetches one editable hero when id is provided', async () => {
    serviceMocks.getEditableCustomHero.mockResolvedValueOnce({ id: 'hero_2', displayName: 'Night Ledger' })

    const response = await GET(buildNextRequest('http://localhost/api/heroes?id=hero_2'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      hero: { id: 'hero_2', displayName: 'Night Ledger' },
    })
    expect(serviceMocks.getEditableCustomHero).toHaveBeenCalledWith('hero_2')
  })

  it('lists bookmarked heroes for the current user', async () => {
    serviceMocks.listBookmarkedCustomHeroPage.mockResolvedValueOnce({
      heroes: [{ id: 'hero_3', displayName: 'Saved Hero', bookmarkedByCurrentUser: true }],
      pagination: { limit: 10, offset: 5, total: 11, hasMore: true },
    })

    const response = await GET(buildNextRequest('http://localhost/api/heroes?bookmarked=true&search=saved&limit=10&offset=5'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      heroes: [{ id: 'hero_3', displayName: 'Saved Hero', bookmarkedByCurrentUser: true }],
      pagination: { limit: 10, offset: 5, total: 11, hasMore: true },
    })
    expect(serviceMocks.listBookmarkedCustomHeroPage).toHaveBeenCalledWith({
      search: 'saved',
      limit: 10,
      offset: 5,
    })
  })

  it('lists all private and published heroes owned by the current user', async () => {
    serviceMocks.listCurrentUserCustomHeroes.mockResolvedValueOnce([
      { id: 'private_hero', displayName: 'Private Hero', status: 'private' },
      { id: 'published_hero', displayName: 'Published Hero', status: 'published' },
    ])

    const response = await GET(buildNextRequest('http://localhost/api/heroes?mine=true'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      heroes: [
        { id: 'private_hero', displayName: 'Private Hero', status: 'private' },
        { id: 'published_hero', displayName: 'Published Hero', status: 'published' },
      ],
    })
    expect(serviceMocks.listCurrentUserCustomHeroes).toHaveBeenCalledOnce()
    expect(serviceMocks.listCustomHeroPage).not.toHaveBeenCalled()
  })

  it('requires authentication when listing current-user heroes', async () => {
    serviceMocks.listCurrentUserCustomHeroes.mockRejectedValueOnce(
      Object.assign(new Error('Authentication required'), { status: 401 }),
    )

    const response = await GET(buildNextRequest('http://localhost/api/heroes?mine=true'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    })
  })

  it('saves new and existing hero payloads', async () => {
    serviceMocks.saveCustomHero.mockResolvedValueOnce({ id: 'new_hero', status: 'private' })
    serviceMocks.saveCustomHero.mockResolvedValueOnce({ id: 'old_hero', status: 'published' })

    const createPayload = { name: 'New Hero', status: 'private' }
    const updatePayload = { id: 'old_hero', name: 'Old Hero', status: 'published' }
    const createResponse = await POST(buildMutationRequest('http://localhost/api/heroes', {
      method: 'POST',
      body: JSON.stringify(createPayload),
    }))
    const updateResponse = await PUT(buildMutationRequest('http://localhost/api/heroes', {
      method: 'PUT',
      body: JSON.stringify(updatePayload),
    }))

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(serviceMocks.saveCustomHero).toHaveBeenNthCalledWith(1, createPayload)
    expect(serviceMocks.saveCustomHero).toHaveBeenNthCalledWith(2, updatePayload)
  })

  it('toggles likes for a published hero', async () => {
    serviceMocks.likeCustomHero.mockResolvedValueOnce({ id: 'liked_hero', likesCount: 8, likedByCurrentUser: true })

    const response = await POST_LIKE(buildMutationRequest('http://localhost/api/heroes/liked_hero/like', { method: 'POST' }), {
      params: Promise.resolve({ slug: 'liked_hero' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      hero: { id: 'liked_hero', likesCount: 8, likedByCurrentUser: true },
    })
    expect(serviceMocks.likeCustomHero).toHaveBeenCalledWith('liked_hero')
  })

  it('records template copy engagement for a published hero', async () => {
    serviceMocks.recordCustomHeroCopy.mockResolvedValueOnce(undefined)

    const response = await POST_COPY(buildMutationRequest('http://localhost/api/heroes/copied_hero/copy', { method: 'POST' }), {
      params: Promise.resolve({ slug: 'copied_hero' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(serviceMocks.recordCustomHeroCopy).toHaveBeenCalledWith('copied_hero')
  })

  it('permanently deletes an owned hero through the dynamic route', async () => {
    serviceMocks.deleteCustomHero.mockResolvedValueOnce({ id: 'hero_4', deleted: true })

    const response = await DELETE_HERO(buildMutationRequest('http://localhost/api/heroes/hero_4', { method: 'DELETE' }), {
      params: Promise.resolve({ slug: 'hero_4' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 'hero_4', deleted: true })
    expect(serviceMocks.deleteCustomHero).toHaveBeenCalledWith('hero_4')
  })

  it('bulk deletes owned heroes through the collection route', async () => {
    serviceMocks.deleteCustomHeroes.mockResolvedValueOnce({ ids: ['hero_4', 'hero_5'], deletedCount: 2 })

    const response = await DELETE(buildMutationRequest('http://localhost/api/heroes', {
      method: 'DELETE',
      body: JSON.stringify({ ids: ['hero_4', 'hero_5'] }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ids: ['hero_4', 'hero_5'], deletedCount: 2 })
    expect(serviceMocks.deleteCustomHeroes).toHaveBeenCalledWith({ ids: ['hero_4', 'hero_5'] })
  })
})
