import { describe, expect, it } from 'vitest'

import { customHeroSaveSchema } from '@/lib/custom-hero-schemas'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import { HEROES } from '@/lib/hero-data'

describe('named stat panel variants', () => {
  it('accepts independently named Boon, Weapon, Vitality, and Spirit panels', () => {
    const stats = buildHeroStatsSeed(HEROES[0])

    stats.boon.name = 'Blessings'
    stats.boon.panels = [{ id: 'boon-alt', name: 'Aggressive', stats: structuredClone(stats.boon.stats) }]
    stats.weapon.panels = [{
      id: 'weapon-alt',
      name: 'Shotgun',
      weaponDesc: 'Close range pressure.',
      gunImageSrc: '/shotgun.png',
      weaponAttributes: ['Scatter', 'Burst'],
      bulletDPS: 120,
      weaponMinRange: 8,
      weaponMaxRange: 24,
      stats: structuredClone(stats.weapon.stats),
    }]
    stats.vitality.name = 'Fortitude'
    stats.vitality.panels = [{ id: 'vitality-alt', name: 'Tank', stats: structuredClone(stats.vitality.stats) }]
    stats.spirit.name = 'Mysticism'
    stats.spirit.panels = [{ id: 'spirit-alt', name: 'Caster', topStats: structuredClone(stats.spirit.topStats), spiritPowerStat: structuredClone(stats.spirit.spiritPowerStat) }]

    const result = customHeroSaveSchema.safeParse({
      name: 'Panel Hero',
      status: 'private',
      hero: { render: '/hero.png' },
      boon: stats.boon,
      weapon: stats.weapon,
      vitality: stats.vitality,
      spirit: stats.spirit,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.boon.name).toBe('Blessings')
      expect(result.data.boon.panels?.[0].name).toBe('Aggressive')
      expect(result.data.weapon.panels?.[0].name).toBe('Shotgun')
      expect(result.data.weapon.panels?.[0].weaponDesc).toBe('Close range pressure.')
      expect(result.data.weapon.panels?.[0].gunImageSrc).toBe('/shotgun.png')
      expect(result.data.weapon.panels?.[0].weaponAttributes).toEqual(['Scatter', 'Burst'])
      expect(result.data.vitality.panels?.[0].name).toBe('Tank')
      expect(result.data.vitality.name).toBe('Fortitude')
      expect(result.data.spirit.panels?.[0].name).toBe('Caster')
      expect(result.data.spirit.name).toBe('Mysticism')
    }
  })

  it('accepts extra base and variant Boon stats beyond the default four rows', () => {
    const stats = buildHeroStatsSeed(HEROES[0])
    const extraStat = { label: 'Air Control', value: '9', unit: '', icon: 'damage_magic_color', scaling: 'boon' as const, scalingValue: '9' }

    stats.boon.stats = [...stats.boon.stats, extraStat]
    stats.boon.panels = [{ id: 'boon-alt', name: 'Aggressive', stats: [...stats.boon.stats, { ...extraStat, label: 'Slide Distance' }] }]

    const result = customHeroSaveSchema.safeParse({
      name: 'Extra Boon Hero',
      status: 'private',
      hero: { render: '/hero.png' },
      boon: stats.boon,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.boon.stats).toHaveLength(5)
      expect(result.data.boon.panels?.[0].stats).toHaveLength(6)
    }
  })
})
