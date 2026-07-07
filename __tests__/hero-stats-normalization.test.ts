import { beforeEach, describe, expect, it, vi } from 'vitest'

const heroFindOneMock = vi.hoisted(() => vi.fn())
const heroInfoFindOneMock = vi.hoisted(() => vi.fn())
const weaponFindOneMock = vi.hoisted(() => vi.fn())
const vitalityFindOneMock = vi.hoisted(() => vi.fn())
const spiritFindOneMock = vi.hoisted(() => vi.fn())
const abilityStatsFindOneMock = vi.hoisted(() => vi.fn())
const dbConnectMock = vi.hoisted(() => vi.fn())

function createQueryMock<T>(value: T) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  }
}

vi.mock('@/lib/dbConnect', () => ({
  default: dbConnectMock,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/models/Hero', () => ({
  default: {
    findOne: heroFindOneMock,
  },
}))

vi.mock('@/lib/models/CustomHero', () => ({
  default: {
    findOne: vi.fn(),
  },
}))

vi.mock('@/lib/models/HeroInfo', () => ({
  default: {
    findOne: heroInfoFindOneMock,
  },
}))

vi.mock('@/lib/models/WeaponStats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/models/WeaponStats')>()

  return {
    ...actual,
    default: {
      findOne: weaponFindOneMock,
    },
  }
})

vi.mock('@/lib/models/VitalityStats', () => ({
  default: {
    findOne: vitalityFindOneMock,
  },
}))

vi.mock('@/lib/models/SpiritStats', () => ({
  default: {
    findOne: spiritFindOneMock,
  },
}))

vi.mock('@/lib/models/AbilityStats', () => ({
  default: {
    findOne: abilityStatsFindOneMock,
  },
}))

import { getHeroStatsBySlug } from '@/lib/hero-stats'

describe('getHeroStatsBySlug stat normalization', () => {
  beforeEach(() => {
    dbConnectMock.mockReset()
    dbConnectMock.mockResolvedValue(undefined)
    heroFindOneMock.mockReset()
    heroInfoFindOneMock.mockReset()
    weaponFindOneMock.mockReset()
    vitalityFindOneMock.mockReset()
    spiritFindOneMock.mockReset()
    abilityStatsFindOneMock.mockReset()
  })

  it('returns the standard stat rows when stored hero documents are partial or malformed', async () => {
    heroFindOneMock.mockReturnValueOnce(createQueryMock({ _id: 'hero-1', slug: 'apollo', name: 'Apollo', portrait: '/portrait.png', render: '/render.png' }))
    heroInfoFindOneMock.mockReturnValueOnce(createQueryMock(null))
    weaponFindOneMock.mockReturnValueOnce(
      createQueryMock({
        weaponName: 'Dueling Rapier & Sidearm',
        weaponDesc: '',
        gunImageSrc: '',
        weaponAttributes: [],
        bulletDPS: 52,
        weaponMinRange: 15,
        weaponMaxRange: 45,
        stats: [
          { label: 'Bullet Damage', value: '18', unit: '', icon: 'damage', scaling: 'none', scalingValue: '0' },
          { label: 'Ammo', value: '12', unit: '', icon: 'ammo', scaling: 'none', scalingValue: '0' },
          { label: 'Pellet Count', value: '6', unit: '', icon: 'bulletDamage', scaling: 'none', scalingValue: '0' },
        ],
        panels: [{
          id: 'weapon-alt',
          name: 'Shotgun',
          bulletDPS: 120,
          weaponMinRange: 8,
          weaponMaxRange: 24,
          stats: [{ label: 'Bullet Damage', value: '20', unit: '', icon: 'damage', scaling: 'none', scalingValue: '0' }],
        }],
      }),
    )
    vitalityFindOneMock.mockReturnValueOnce(
      createQueryMock({
        stats: [
          { label: 'Max Health', value: '450', unit: '', icon: 'health', scaling: 'none', scalingValue: '0' },
          { label: 'Stamina', value: '4', unit: '', icon: 'stamina', scaling: 'none', scalingValue: '0' },
        ],
        panels: [{
          id: 'vitality-alt',
          name: 'Tank',
          stats: [{ label: 'Max Health', value: '999', unit: '', icon: 'health', scaling: 'none', scalingValue: '0' }],
        }],
      }),
    )
    spiritFindOneMock.mockReturnValueOnce(
      createQueryMock({
        topStats: [
          { label: 'Radius', value: '6', unit: 'm', icon: 'radius', scaling: 'none', scalingValue: '0' },
          { label: 'Burst Damage', value: '120', unit: '', icon: 'spirit_damage', scaling: 'spirit', scalingValue: '1.4' },
        ],
        spiritPowerStat: { label: 'Spirit Power', value: '0', unit: '', icon: 'spirit', scaling: 'none', scalingValue: '0' },
        panels: [{
          id: 'spirit-alt',
          name: 'Caster',
          topStats: [{ label: 'Ability Range', value: '30', unit: '%', icon: 'range', scaling: 'none', scalingValue: '0' }],
          spiritPowerStat: { label: 'Spirit Power', value: '80', unit: '', icon: 'spirit', scaling: 'none', scalingValue: '0' },
        }],
      }),
    )
    abilityStatsFindOneMock.mockReturnValueOnce(createQueryMock(null))

    const stats = await getHeroStatsBySlug('apollo')

    expect(stats?.weapon.stats).toHaveLength(15)
    expect(stats?.weapon.stats.map(stat => stat.label)).toEqual([
      'Bullet Damage',
      'Weapon Damage',
      'Bullets per sec',
      'Fire Rate',
      'Ammo',
      'Clip Size Increase',
      'Reload Time',
      'Reload Reduction',
      'Bullet Velocity',
      'Bullet Velocity Increase',
      'Bullet Lifesteal',
      'Crit Bonus Scale',
      'Light Melee',
      'Heavy Melee',
      'Pellet Count',
    ])
    expect(stats?.vitality.stats).toHaveLength(16)
    expect(stats?.spirit.topStats.map(stat => stat.label)).toEqual([
      'Ability Cooldown',
      'Ability Duration',
      'Ability Range',
      'Spirit Lifesteal',
      'Max Charges Increase',
      'Charge Cooldown',
    ])
    expect(stats?.weapon.stats[0]).toMatchObject({ value: '18', icon: 'bulletDamage' })
    expect(stats?.weapon.stats[14]).toMatchObject({ label: 'Pellet Count', value: '6' })
    expect(stats?.vitality.stats[4]).toMatchObject({ label: 'Lifesteal Effectiveness', value: '0', unit: '%', icon: 'lifestealEffectiveness' })
    expect(stats?.vitality.stats[15]).toMatchObject({ label: 'Dash Speed', value: '0' })
    expect(stats?.weapon.panels?.[0]).toMatchObject({ name: 'Shotgun', bulletDPS: 120, stats: expect.arrayContaining([expect.objectContaining({ label: 'Bullet Damage', value: '20' })]) })
    expect(stats?.vitality.panels?.[0]).toMatchObject({ name: 'Tank', stats: expect.arrayContaining([expect.objectContaining({ label: 'Max Health', value: '999' })]) })
    expect(stats?.spirit.panels?.[0]).toMatchObject({ name: 'Caster', spiritPowerStat: expect.objectContaining({ value: '80' }) })
  })

  it('returns generated official hero stats when MongoDB is unavailable', async () => {
    dbConnectMock.mockRejectedValueOnce(new Error('Failed to connect to MongoDB'))

    const stats = await getHeroStatsBySlug('abrams')

    expect(stats?.hero.slug).toBe('abrams')
    expect(stats?.weapon.stats.length).toBeGreaterThan(0)
    expect(heroFindOneMock).not.toHaveBeenCalled()
  })
})
