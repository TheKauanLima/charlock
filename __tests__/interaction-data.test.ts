import { describe, expect, it } from 'vitest'

import { customHeroSaveSchema } from '@/lib/custom-hero-schemas'
import { INTERACTION_ROSTER_HEROES } from '@/lib/interaction-heroes'

describe('interaction creator data', () => {
  it('maps canonical hero ids to their internal small portrait aliases', () => {
    expect(INTERACTION_ROSTER_HEROES.find(hero => hero.id === 'apollo')).toMatchObject({
      name: 'Apollo',
      smallPortrait: '/panorama/images/heroes/fencer_sm_psd.png',
    })
    expect(INTERACTION_ROSTER_HEROES.find(hero => hero.id === 'celeste')).toMatchObject({
      name: 'Celeste',
      smallPortrait: '/panorama/images/heroes/unicorn_sm_psd.png',
    })
  })

  it('validates persisted conversations, alternating lines, and field limits', () => {
    const result = customHeroSaveSchema.shape.interactions.safeParse([{
      id: 'interaction-1',
      targetHeroId: 'apollo',
      targetHeroName: 'Apollo',
      title: 'Respect',
      lines: [
        {
          id: 'line-1',
          speakerSide: 'left',
          speakerHeroId: 'custom-hero-1',
          text: 'A'.repeat(500),
          order: 0,
        },
        {
          id: 'line-2',
          speakerSide: 'right',
          speakerHeroId: 'apollo',
          text: 'Your turn.',
          order: 1,
        },
      ],
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:05:00.000Z',
    }])

    expect(result.success).toBe(true)

    const oversized = customHeroSaveSchema.shape.interactions.safeParse([{
      ...(result.success ? result.data[0] : {}),
      lines: [{
        id: 'line-1',
        speakerSide: 'left',
        speakerHeroId: 'custom-hero-1',
        text: 'A'.repeat(501),
        order: 0,
      }],
    }])

    expect(oversized.success).toBe(false)
  })

  it('accepts a custom target portrait snapshot for published interaction rendering', () => {
    const result = customHeroSaveSchema.shape.interactions.safeParse([{
      id: 'interaction-custom',
      targetHeroId: '507f1f77bcf86cd799439011',
      targetHeroName: 'Clockmaker',
      targetHeroPortrait: 'https://example.com/clockmaker.png',
      title: 'Custom conversation',
      lines: [],
      createdAt: '2026-08-12T12:00:00.000Z',
      updatedAt: '2026-08-12T12:00:00.000Z',
    }])

    expect(result.success).toBe(true)
  })
})
