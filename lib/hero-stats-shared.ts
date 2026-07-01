import { buildSpiritPowerStat, buildTopSpiritStatsArray } from '@/components/panels/spirit-stats-mapper'
import { buildVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import { buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'
import { HEROES, type HeroDefinition, type HeroInfoDefinition } from '@/lib/hero-data'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'

interface HeroStatsHero {
  slug: string
  name: string
  portrait: string
  render: string
}

export interface WeaponStatsPayload {
  weaponName: string
  weaponDesc: string
  gunImageSrc: string
  weaponAttributes: string[]
  bulletDPS: number
  weaponMinRange: number
  weaponMaxRange: number
  stats: PanelStat[]
}

export interface VitalityStatsPayload {
  stats: PanelStat[]
}

export interface SpiritStatsPayload {
  topStats: PanelStat[]
  spiritPowerStat: PanelStat
}

export interface HeroStatsPayload {
  hero: HeroStatsHero
  heroInfo?: HeroInfoDefinition
  weapon: WeaponStatsPayload
  vitality: VitalityStatsPayload
  spirit: SpiritStatsPayload
}

function hashHero(hero: HeroDefinition) {
  return Array.from(`${hero.slug}:${hero.assetSlug}:${hero.displayName}`).reduce((hash, char) => hash + char.charCodeAt(0), 0)
}

function roundStat(value: number, decimals = 1) {
  return Number(value.toFixed(decimals))
}

function normalizeStat(stat: PanelStat): PanelStat {
  return {
    label: stat.label,
    value: String(stat.value),
    unit: stat.unit ?? '',
    icon: stat.icon ?? 'dot',
    scaling: stat.scaling ?? 'none',
    scalingValue: stat.scalingValue ?? '0',
    ...(stat.description ? { description: stat.description } : {}),
  }
}

function normalizeEmptyStat(stat: PanelStat): PanelStat {
  return {
    ...normalizeStat(stat),
    value: '0',
    scaling: 'none',
    scalingValue: '0',
  }
}

export function buildHeroStatsSource(hero: HeroDefinition): StatsRow {
  const hash = hashHero(hero)

  return {
    ability_cooldown_percent: hash % 18,
    ability_duration_percent: hash % 14,
    ability_range_percent: hash % 22,
    ammo: 8 + (hash % 9),
    bullet_damage: roundStat(3.2 + (hash % 55) / 10),
    bullet_lifesteal_percent: hash % 12,
    bullet_velocity: 520 + (hash % 180),
    bullets_per_sec: roundStat(1.4 + (hash % 28) / 20, 2),
    charge_cooldown_percent: hash % 16,
    clip_size_increase_percent: hash % 20,
    crit_bonus_scale_percent: hash % 18,
    crit_reduction_percent: hash % 10,
    dash_speed: roundStat(6 + (hash % 8) / 10),
    debuff_resist_percent: hash % 12,
    fire_rate_percent: hash % 26,
    heal_amp_percent: hash % 14,
    health_regen: roundStat(1 + (hash % 18) / 10),
    heavy_melee_damage: 108 + (hash % 24),
    light_melee_damage: 46 + (hash % 12),
    max_charges_increase: hash % 3,
    max_health: 760 + (hash % 170),
    melee_resist_percent: hash % 12,
    move_speed: roundStat(6 + (hash % 10) / 10),
    non_combat_regen: roundStat((hash % 12) / 10),
    reload_reduction_percent: hash % 18,
    reload_time: roundStat(0.28 + (hash % 13) / 100, 2),
    spirit_lifesteal_percent: hash % 12,
    spirit_power: 4 + (hash % 16),
    spirit_resist_percent: hash % 16,
    sprint_speed: roundStat(1 + (hash % 8) / 10),
    stamina: 3 + (hash % 3),
    stamina_cooldown: roundStat(4 + (hash % 10) / 10),
    stamina_recovery_percent: hash % 18,
    weapon_damage_percent: hash % 24,
    bullet_damage_spirit_scaling: hash % 2 === 0 ? 0.2 : 0,
    fire_rate_percent_weapon_scaling: hash % 3 === 0 ? 0.3 : 0,
    heavy_melee_damage_weapon_scaling: hash % 4 === 0 ? 0.35 : 0,
    light_melee_damage_weapon_scaling: hash % 3 === 0 ? 0.25 : 0,
    max_health_boon_scaling: hash % 4 === 0 ? 0.4 : 0,
    spirit_power_spirit_scaling: hash % 5 === 0 ? 0.5 : 0,
  }
}

export function buildEmptyHeroStats(hero: HeroDefinition): HeroStatsPayload {
  return {
    hero: {
      slug: hero.slug,
      name: hero.displayName,
      portrait: hero.portrait,
      render: hero.render,
    },
    heroInfo: hero.heroInfo,
    weapon: {
      weaponName: `${hero.displayName} Weapon`,
      weaponDesc: '',
      gunImageSrc: '/panorama/images/hud/abilities/weapon_damage_psd.png',
      weaponAttributes: [],
      bulletDPS: 0,
      weaponMinRange: 0,
      weaponMaxRange: 0,
      stats: buildWeaponStatsArray().map(normalizeEmptyStat),
    },
    vitality: {
      stats: buildVitalityStatsArray().map(normalizeEmptyStat),
    },
    spirit: {
      topStats: buildTopSpiritStatsArray().map(normalizeEmptyStat),
      spiritPowerStat: normalizeEmptyStat(buildSpiritPowerStat()),
    },
  }
}

export function buildHeroStatsSeed(hero: HeroDefinition): HeroStatsPayload {
  const statsSource = buildHeroStatsSource(hero)
  const bulletDamage = Number(statsSource.bullet_damage ?? 0)
  const bulletsPerSecond = Number(statsSource.bullets_per_sec ?? 0)

  return {
    hero: {
      slug: hero.slug,
      name: hero.displayName,
      portrait: hero.portrait,
      render: hero.render,
    },
    heroInfo: hero.heroInfo,
    weapon: {
      weaponName: `${hero.displayName} Weapon`,
      weaponDesc: `${hero.displayName} pressure profile generated from the seeded hero stat table.`,
      gunImageSrc: '/panorama/images/hud/abilities/weapon_damage_psd.png',
      weaponAttributes: [],
      bulletDPS: Math.round(bulletDamage * bulletsPerSecond),
      weaponMinRange: 12 + (Number(statsSource.ammo ?? 0) % 4),
      weaponMaxRange: 34 + (Number(statsSource.bullet_velocity ?? 0) % 18),
      stats: buildWeaponStatsArray(statsSource).map(normalizeStat),
    },
    vitality: {
      stats: buildVitalityStatsArray(statsSource).map(normalizeStat),
    },
    spirit: {
      topStats: buildTopSpiritStatsArray(statsSource).map(normalizeStat),
      spiritPowerStat: normalizeStat(buildSpiritPowerStat(statsSource)),
    },
  }
}

export function buildFallbackHeroStatsBySlug(slug: string): HeroStatsPayload | null {
  const hero = HEROES.find(heroDefinition => heroDefinition.slug === slug)

  return hero ? buildHeroStatsSeed(hero) : null
}
