import { describe, expect, it } from 'vitest'

import { buildDefaultAbilityStats, normalizeAbilityStats } from '@/lib/ability-editor-types'
import { customHeroSaveSchema } from '@/lib/custom-hero-schemas'
import { HEROES } from '@/lib/hero-data'

describe('ability sub-header stats', () => {
  it('starts every new ability and tier with a basic sub-header stat', () => {
    const abilityStats = buildDefaultAbilityStats(HEROES[0])

    for (const ability of abilityStats.abilities) {
      expect(ability.subStats).toHaveLength(1)
      expect(ability.tiers.every(tier => tier.variant.subStats.length === 1)).toBe(true)
    }
  })

  it('preserves intentionally empty sub-header stats while defaulting missing stats', () => {
    const source = buildDefaultAbilityStats(HEROES[0])

    source.abilities[0].subStats = []
    source.abilities[0].tiers[0].variant.subStats = []
    delete (source.abilities[1] as Partial<typeof source.abilities[number]>).subStats

    const normalized = normalizeAbilityStats(source, HEROES[0])

    expect(normalized.abilities[0].subStats).toEqual([])
    expect(normalized.abilities[0].tiers[0].variant.subStats).toEqual([])
    expect(normalized.abilities[1].subStats).toHaveLength(1)
  })

  it('accepts multiple customized sub-header stats in the private-save schema', () => {
    const ability = buildDefaultAbilityStats(HEROES[0]).abilities[0]

    ability.subStats.push({
      label: 'Duration',
      value: '4',
      unit: 's',
      icon: '/panorama/images/icons/properties/duration.svg',
      scaling: 'spirit',
      scalingValue: '0.2',
    })

    const result = customHeroSaveSchema.safeParse({
      name: 'Custom Hero',
      status: 'private',
      hero: { render: '/hero.png' },
      abilityStats: { abilities: [ability] },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.abilityStats.abilities?.[0].subStats).toHaveLength(2)
    }
  })
})
