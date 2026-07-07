import { describe, expect, it } from 'vitest'

import { customHeroSaveSchema } from '@/lib/custom-hero-schemas'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import { HEROES } from '@/lib/hero-data'

describe('named stat panel variants', () => {
  it('accepts independently named Weapon, Vitality, and Spirit panels', () => {
    const stats = buildHeroStatsSeed(HEROES[0])

    stats.weapon.panels = [{ id: 'weapon-alt', name: 'Shotgun', bulletDPS: 120, weaponMinRange: 8, weaponMaxRange: 24, stats: structuredClone(stats.weapon.stats) }]
    stats.vitality.name = 'Fortitude'
    stats.vitality.panels = [{ id: 'vitality-alt', name: 'Tank', stats: structuredClone(stats.vitality.stats) }]
    stats.spirit.name = 'Mysticism'
    stats.spirit.panels = [{ id: 'spirit-alt', name: 'Caster', topStats: structuredClone(stats.spirit.topStats), spiritPowerStat: structuredClone(stats.spirit.spiritPowerStat) }]

    const result = customHeroSaveSchema.safeParse({
      name: 'Panel Hero',
      status: 'private',
      hero: { render: '/hero.png' },
      weapon: stats.weapon,
      vitality: stats.vitality,
      spirit: stats.spirit,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.weapon.panels?.[0].name).toBe('Shotgun')
      expect(result.data.vitality.panels?.[0].name).toBe('Tank')
      expect(result.data.vitality.name).toBe('Fortitude')
      expect(result.data.spirit.panels?.[0].name).toBe('Caster')
      expect(result.data.spirit.name).toBe('Mysticism')
    }
  })
})
