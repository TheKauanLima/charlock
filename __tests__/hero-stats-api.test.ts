import { describe, expect, it, vi } from 'vitest'

const getHeroStatsBySlugMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/hero-stats', () => ({
  getHeroStatsBySlug: getHeroStatsBySlugMock,
}))

import { GET } from '@/app/api/heroes/[slug]/stats/route'

describe('hero stats API route', () => {
  it('returns stats for a seeded hero slug', async () => {
    getHeroStatsBySlugMock.mockResolvedValueOnce({
      hero: { slug: 'abrams', name: 'Abrams', portrait: '/portrait.png', render: '/render.png' },
      weapon: { weaponName: 'Abrams Weapon', weaponDesc: '', gunImageSrc: '', weaponAttributes: [], bulletDPS: 42, weaponMinRange: 12, weaponMaxRange: 36, stats: [] },
      vitality: { stats: [] },
      spirit: { topStats: [], spiritPowerStat: { label: 'Spirit Power', value: '8', unit: '', icon: 'spiritPower', scaling: 'none', scalingValue: '0' } },
    })

    const response = await GET(new Request('http://localhost/api/heroes/abrams/stats'), { params: Promise.resolve({ slug: 'abrams' }) })

    await expect(response.json()).resolves.toMatchObject({
      hero: { slug: 'abrams' },
      weapon: { bulletDPS: 42 },
    })
    expect(response.status).toBe(200)
    expect(getHeroStatsBySlugMock).toHaveBeenCalledWith('abrams')
  })

  it('returns 404 when seeded stats are missing', async () => {
    getHeroStatsBySlugMock.mockResolvedValueOnce(null)

    const response = await GET(new Request('http://localhost/api/heroes/missing/stats'), { params: Promise.resolve({ slug: 'missing' }) })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Hero stats not found' })
  })
})
