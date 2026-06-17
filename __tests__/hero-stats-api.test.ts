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
      heroInfo: {
        nameType: 'image',
        nameValue: '/name.svg',
        nameColor: '#fff',
        tag1Text: 'TANK',
        tag2Text: 'BRAWLER',
        tag3Text: 'BULL-HEADED',
        tagColor: '#2292af',
        tagTextColor: '#fef2d8',
        tag1Tilt: 0,
        tag2Tilt: 0,
        tag3Tilt: 0,
        tag1OffsetY: 2,
        tag2OffsetY: -3,
        tag3OffsetY: -1,
        ability1Icon: '/1.png',
        ability2Icon: '/2.png',
        ability3Icon: '/3.png',
        ability4Icon: '/4.png',
        abilityCircleColor: '#2092ae',
        abilityIconColor: '#022021',
        backstory: 'Abrams backstory.',
      },
      weapon: { weaponName: 'Abrams Weapon', weaponDesc: '', gunImageSrc: '', weaponAttributes: [], bulletDPS: 42, weaponMinRange: 12, weaponMaxRange: 36, stats: [] },
      vitality: { stats: [] },
      spirit: { topStats: [], spiritPowerStat: { label: 'Spirit Power', value: '8', unit: '', icon: 'spiritPower', scaling: 'none', scalingValue: '0' } },
    })

    const response = await GET(new Request('http://localhost/api/heroes/abrams/stats'), { params: Promise.resolve({ slug: 'abrams' }) })

    await expect(response.json()).resolves.toMatchObject({
      hero: { slug: 'abrams' },
      heroInfo: { backstory: 'Abrams backstory.' },
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
