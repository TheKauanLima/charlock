import type { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  getEditableCustomHero: vi.fn(),
  likeCustomHero: vi.fn(),
  listCustomHeroPage: vi.fn(),
  recordCustomHeroCopy: vi.fn(),
  saveCustomHero: vi.fn(),
}))

vi.mock('@/lib/custom-heroes', () => ({
  CustomHeroError: class CustomHeroError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  getEditableCustomHero: serviceMocks.getEditableCustomHero,
  likeCustomHero: serviceMocks.likeCustomHero,
  listCustomHeroPage: serviceMocks.listCustomHeroPage,
  recordCustomHeroCopy: serviceMocks.recordCustomHeroCopy,
  saveCustomHero: serviceMocks.saveCustomHero,
}))

import { GET, POST, PUT } from '@/app/api/heroes/route'
import { POST as POST_COPY } from '@/app/api/heroes/[slug]/copy/route'
import { POST as POST_LIKE } from '@/app/api/heroes/[slug]/like/route'

function buildNextRequest(url: string) {
  return {
    nextUrl: new URL(url),
  } as NextRequest
}

describe('heroes API route', () => {
  it('lists published heroes with requested sort', async () => {
    serviceMocks.listCustomHeroPage.mockResolvedValueOnce({
      heroes: [{ id: 'hero_1', displayName: 'Arc Light', likesCount: 3 }],
      pagination: { limit: 12, offset: 24, total: 30, hasMore: false },
    })

    const response = await GET(buildNextRequest('http://localhost/api/heroes?status=published&sort=trending&search=arc&limit=12&offset=24'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      heroes: [{ id: 'hero_1', displayName: 'Arc Light', likesCount: 3 }],
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

  it('saves new and existing hero payloads', async () => {
    serviceMocks.saveCustomHero.mockResolvedValueOnce({ id: 'new_hero', status: 'private' })
    serviceMocks.saveCustomHero.mockResolvedValueOnce({ id: 'old_hero', status: 'published' })

    const createPayload = { name: 'New Hero', status: 'private' }
    const updatePayload = { id: 'old_hero', name: 'Old Hero', status: 'published' }
    const createResponse = await POST(new Request('http://localhost/api/heroes', {
      method: 'POST',
      body: JSON.stringify(createPayload),
    }))
    const updateResponse = await PUT(new Request('http://localhost/api/heroes', {
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

    const response = await POST_LIKE(new Request('http://localhost/api/heroes/liked_hero/like', { method: 'POST' }), {
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

    const response = await POST_COPY(new Request('http://localhost/api/heroes/copied_hero/copy', { method: 'POST' }), {
      params: Promise.resolve({ slug: 'copied_hero' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(serviceMocks.recordCustomHeroCopy).toHaveBeenCalledWith('copied_hero')
  })
})
