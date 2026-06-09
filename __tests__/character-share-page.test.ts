import { describe, expect, it, vi } from 'vitest'

import type { CustomHeroDetail } from '@/lib/custom-hero-types'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'

const serviceMocks = vi.hoisted(() => ({
  getPublishedCustomHero: vi.fn(),
}))

vi.mock('@/lib/custom-heroes', () => ({
  CustomHeroError: class CustomHeroError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  getPublishedCustomHero: serviceMocks.getPublishedCustomHero,
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found')
  }),
}))

import { generateMetadata } from '@/app/characters/[id]/page'

function buildSharedHero(): CustomHeroDetail {
  const hero = HEROES[0]

  return {
    ...hero,
    id: 'hero_1',
    creatorId: 'user_1',
    status: 'published',
    likesCount: 4,
    likedByCurrentUser: false,
    allowCopies: true,
    background: hero.render,
    viewerCanEdit: false,
    publishedAt: '2026-06-01T12:00:00.000Z',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    stats: buildHeroStatsSeed(hero),
  }
}

describe('character share page metadata', () => {
  it('generates dynamic preview metadata for a published character', async () => {
    serviceMocks.getPublishedCustomHero.mockResolvedValueOnce(buildSharedHero())

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'hero_1' }),
    })

    expect(metadata.title).toBe('Abrams | Charlock')
    expect(metadata.openGraph?.url).toBe('http://localhost:3000/characters/hero_1')
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'http://localhost:3000/characters/hero_1/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Abrams character card',
      },
    ])
    expect(metadata.twitter?.card).toBe('summary_large_image')
  })
})
