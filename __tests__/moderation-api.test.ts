import { describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  listModerationQueue: vi.fn(),
  reportComment: vi.fn(),
  reportHero: vi.fn(),
  resolveModerationItem: vi.fn(),
}))

vi.mock('@/lib/moderation', () => serviceMocks)

import { GET as GET_MODERATION } from '@/app/api/admin/moderation/route'
import { POST as RESOLVE_MODERATION } from '@/app/api/admin/moderation/resolve/route'
import { POST as REPORT_COMMENT } from '@/app/api/comments/[id]/report/route'
import { POST as REPORT_HERO } from '@/app/api/heroes/[slug]/report/route'

function mutationRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify(body),
  })
}

describe('moderation API routes', () => {
  it('validates and submits character and comment reports', async () => {
    serviceMocks.reportHero.mockResolvedValue({ id: 'hero_1', reportCount: 1, moderationStatus: 'flagged' })
    serviceMocks.reportComment.mockResolvedValue({ id: 'comment_1', reportCount: 1, moderationStatus: 'flagged' })

    const heroResponse = await REPORT_HERO(mutationRequest('http://localhost/api/heroes/hero_1/report', {
      reason: 'Plagiarism',
      details: 'Copied text.',
    }), { params: Promise.resolve({ slug: 'hero_1' }) })
    const commentResponse = await REPORT_COMMENT(mutationRequest('http://localhost/api/comments/comment_1/report', {
      reason: 'Spam / Irrelevant',
    }), { params: Promise.resolve({ id: 'comment_1' }) })

    expect(heroResponse.status).toBe(201)
    expect(commentResponse.status).toBe(201)
    expect(serviceMocks.reportHero).toHaveBeenCalledWith('hero_1', { reason: 'Plagiarism', details: 'Copied text.' })
    expect(serviceMocks.reportComment).toHaveBeenCalledWith('comment_1', { reason: 'Spam / Irrelevant' })
  })

  it('rejects unsupported report reasons before calling the service', async () => {
    const response = await REPORT_HERO(mutationRequest('http://localhost/api/heroes/hero_1/report', {
      reason: 'I simply dislike it',
    }), { params: Promise.resolve({ slug: 'hero_1' }) })

    expect(response.status).toBe(400)
    expect(serviceMocks.reportHero).not.toHaveBeenCalled()
  })

  it('lists and resolves the protected moderation queue', async () => {
    serviceMocks.listModerationQueue.mockResolvedValue({ heroes: [], comments: [] })
    serviceMocks.resolveModerationItem.mockResolvedValue({ id: 'hero_1', type: 'hero', action: 'approve', resolved: true })

    const listResponse = await GET_MODERATION()
    const resolveResponse = await RESOLVE_MODERATION(mutationRequest('http://localhost/api/admin/moderation/resolve', {
      type: 'hero', id: 'hero_1', action: 'approve',
    }))

    await expect(listResponse.json()).resolves.toEqual({ moderation: { heroes: [], comments: [] } })
    await expect(resolveResponse.json()).resolves.toEqual({ resolution: { id: 'hero_1', type: 'hero', action: 'approve', resolved: true } })
  })
})
