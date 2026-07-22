import 'server-only'

import { Types } from 'mongoose'

import dbConnect from '@/lib/dbConnect'
import CustomHero from '@/lib/models/CustomHero'
import AbilityStats from '@/lib/models/AbilityStats'
import BoonStats from '@/lib/models/BoonStats'
import OfficialHero from '@/lib/models/Hero'
import HeroInfo from '@/lib/models/HeroInfo'
import SpiritStats from '@/lib/models/SpiritStats'
import VitalityStats from '@/lib/models/VitalityStats'
import WeaponStats from '@/lib/models/WeaponStats'
import type { IPanelStat } from '@/lib/models/WeaponStats'
import { normalizeCustomScaling, type PanelStat } from '@/components/panels/scaling-utils'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'
import { buildFallbackHeroStatsBySlug } from '@/lib/hero-stats-shared'
import { DEFAULT_HERO_NAME_FONT_FAMILY, DEFAULT_HERO_NAME_FONT_SIZE, DEFAULT_HERO_NAME_FONT_WEIGHT, type HeroInfoDefinition } from '@/lib/hero-data'
import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import { normalizeAbilityStats } from '@/lib/ability-editor-types'
import { buildBoonStatsArray } from '@/components/panels/boon-stats-mapper'
export { buildFallbackHeroStatsBySlug, buildHeroStatsSeed, buildHeroStatsSource } from '@/lib/hero-stats-shared'
export type { BoonStatsPayload, HeroStatsPayload, SpiritStatsPayload, VitalityStatsPayload, WeaponStatsPayload } from '@/lib/hero-stats-shared'

interface HeroRecord {
  _id: Types.ObjectId
  slug: string
  name: string
  portrait: string
  render: string
}

interface WeaponStatsRecord {
  weaponName: string
  weaponDesc: string
  gunImageSrc: string
  weaponAttributes: string[]
  bulletDPS: number
  weaponMinRange: number
  weaponMaxRange: number
  stats?: IPanelStat[]
  bulletDamage?: IPanelStat
  weaponDamage?: IPanelStat
  bulletsPerSec?: IPanelStat
  fireRate?: IPanelStat
  ammo?: IPanelStat
  clipSizeIncrease?: IPanelStat
  reloadTime?: IPanelStat
  reloadReduction?: IPanelStat
  bulletVelocity?: IPanelStat
  bulletVelocityIncrease?: IPanelStat
  bulletLifesteal?: IPanelStat
  critBonusScale?: IPanelStat
  lightMelee?: IPanelStat
  heavyMelee?: IPanelStat
  panels?: Array<{
    id: string
    name: string
    weaponDesc?: string
    gunImageSrc?: string
    weaponAttributes?: string[]
    bulletDPS: number
    weaponMinRange: number
    weaponMaxRange: number
    stats: IPanelStat[]
  }>
}

interface VitalityStatsRecord {
  name?: string
  stats?: IPanelStat[]
  maxHealth?: IPanelStat
  healthRegen?: IPanelStat
  healAmp?: IPanelStat
  nonCombatRegen?: IPanelStat
  bulletResist?: IPanelStat
  spiritResist?: IPanelStat
  meleeResist?: IPanelStat
  debuffResist?: IPanelStat
  critReduction?: IPanelStat
  moveSpeed?: IPanelStat
  sprintSpeed?: IPanelStat
  staminaCooldown?: IPanelStat
  staminaRecovery?: IPanelStat
  stamina?: IPanelStat
  dashSpeed?: IPanelStat
  panels?: Array<{ id: string; name: string; stats: IPanelStat[] }>
}

interface SpiritStatsRecord {
  name?: string
  topStats?: IPanelStat[]
  spiritPower?: IPanelStat
  abilityCooldown?: IPanelStat
  abilityDuration?: IPanelStat
  abilityRange?: IPanelStat
  spiritLifesteal?: IPanelStat
  maxChargesIncrease?: IPanelStat
  chargeCooldown?: IPanelStat
  spiritPowerStat?: IPanelStat
  panels?: Array<{ id: string; name: string; topStats: IPanelStat[]; spiritPowerStat: IPanelStat }>
}

interface AbilityStatsRecord {
  abilities: AbilityStatsPayload['abilities']
  secondaryAbilities?: AbilityStatsPayload['secondaryAbilities']
  secondaryAbilitySlots?: AbilityStatsPayload['secondaryAbilitySlots']
  secondaryAbilityAnchorIndex?: AbilityStatsPayload['secondaryAbilityAnchorIndex']
}

export interface HeroStatsWithAbilityPayload extends HeroStatsPayload {
  abilityStats?: AbilityStatsPayload
}

type HeroInfoRecord = HeroInfoDefinition

interface StandardStatDefinition {
  label: string
  unit: string
  icon: string
  legacyKey?: string
  description?: string
}

const STANDARD_WEAPON_STATS: StandardStatDefinition[] = [
  { label: 'Bullet Damage', unit: '', icon: 'bulletDamage', legacyKey: 'bulletDamage' },
  { label: 'Weapon Damage', unit: '%', icon: 'bulletDamage', legacyKey: 'weaponDamage' },
  { label: 'Bullets per sec', unit: '', icon: 'fireRate', legacyKey: 'bulletsPerSec' },
  { label: 'Fire Rate', unit: '%', icon: 'fireRate', legacyKey: 'fireRate' },
  { label: 'Ammo', unit: '', icon: 'ammoClipSize', legacyKey: 'ammo' },
  { label: 'Clip Size Increase', unit: '%', icon: 'ammoClipSize', legacyKey: 'clipSizeIncrease' },
  { label: 'Reload Time', unit: 's', icon: 'ammoReload', legacyKey: 'reloadTime' },
  { label: 'Reload Reduction', unit: '%', icon: 'ammoReloadReduction', legacyKey: 'reloadReduction' },
  { label: 'Bullet Velocity', unit: 'm/s', icon: 'bulletVelocity', legacyKey: 'bulletVelocity' },
  { label: 'Bullet Velocity Increase', unit: '%', icon: 'bulletVelocity', legacyKey: 'bulletVelocityIncrease' },
  { label: 'Bullet Lifesteal', unit: '%', icon: 'healthStealBullets', legacyKey: 'bulletLifesteal' },
  { label: 'Crit Bonus Scale', unit: '%', icon: 'critBonusScale', legacyKey: 'critBonusScale' },
  { label: 'Light Melee', unit: '', icon: 'melee', legacyKey: 'lightMelee' },
  { label: 'Heavy Melee', unit: '', icon: 'melee', legacyKey: 'heavyMelee' },
]

const OPTIONAL_WEAPON_STATS: StandardStatDefinition[] = [
  { label: 'Pellet Count', unit: '', icon: 'bulletDamage' },
]

const STANDARD_VITALITY_STATS: StandardStatDefinition[] = [
  { label: 'Max Health', unit: '', icon: 'maxHealth', legacyKey: 'maxHealth' },
  { label: 'Health Regen', unit: '', icon: 'healthRegen', legacyKey: 'healthRegen' },
  { label: 'Heal Amp', unit: '%', icon: 'healAmp', legacyKey: 'healAmp' },
  { label: 'Non-Combat Regen', unit: '', icon: 'healthRegen', legacyKey: 'nonCombatRegen' },
  { label: 'Lifesteal Effectiveness', unit: '%', icon: 'lifestealEffectiveness' },
  { label: 'Bullet Resist', unit: '%', icon: 'bulletResist', legacyKey: 'bulletResist' },
  { label: 'Spirit Resist', unit: '%', icon: 'spiritResist', legacyKey: 'spiritResist' },
  { label: 'Melee Resist', unit: '%', icon: 'meleeResist', legacyKey: 'meleeResist' },
  { label: 'Debuff Resist', unit: '%', icon: 'debuffResist', legacyKey: 'debuffResist' },
  { label: 'Crit Reduction', unit: '%', icon: 'critReduction', legacyKey: 'critReduction' },
  { label: 'Move Speed', unit: 'm', icon: 'moveSpeed', legacyKey: 'moveSpeed' },
  { label: 'Sprint Speed', unit: 'm', icon: 'moveSprint', legacyKey: 'sprintSpeed' },
  { label: 'Stamina Cooldown', unit: 's', icon: 'staminaRecovery', legacyKey: 'staminaCooldown' },
  { label: 'Stamina Recovery', unit: '%', icon: 'staminaRecovery', legacyKey: 'staminaRecovery' },
  { label: 'Stamina', unit: '', icon: 'stamina', legacyKey: 'stamina' },
  { label: 'Dash Speed', unit: 'm', icon: 'stamina', legacyKey: 'dashSpeed' },
  { label: 'Air Control', unit: '%', icon: 'stamina' },
  { label: 'Gravity Scale', unit: '%', icon: 'stamina' },
]

const STANDARD_SPIRIT_STATS: StandardStatDefinition[] = [
  { label: 'Ability Cooldown', unit: '%', icon: 'abilityCooldown', legacyKey: 'abilityCooldown' },
  { label: 'Ability Duration', unit: '%', icon: 'abilityDuration', legacyKey: 'abilityDuration' },
  { label: 'Ability Range', unit: '%', icon: 'abilityRange', legacyKey: 'abilityRange' },
  { label: 'Spirit Lifesteal', unit: '%', icon: 'spiritLifesteal', legacyKey: 'spiritLifesteal' },
  { label: 'Max Charges Increase', unit: '', icon: 'maxCharges', legacyKey: 'maxChargesIncrease' },
  { label: 'Charge Cooldown', unit: '%', icon: 'chargeCooldown', legacyKey: 'chargeCooldown' },
]

const STANDARD_SPIRIT_POWER_STAT: StandardStatDefinition = {
  label: 'Spirit Power',
  unit: '',
  icon: 'spiritPower',
  legacyKey: 'spiritPower',
  description: 'Spirit Power increases the effectiveness of your Abilities and items.',
}

function isPanelStat(stat: IPanelStat | undefined): stat is IPanelStat {
  return Boolean(stat?.label)
}

function buildStandardStat(definition: StandardStatDefinition, stat?: IPanelStat): PanelStat {
  const bulletDamageIcons = ['bulletDamage', 'damage_bullet_color', 'damage_magic_color', 'damage_melee_color']
  const icon = definition.label === 'Bullet Damage' && stat?.icon && bulletDamageIcons.includes(stat.icon)
    ? stat.icon
    : definition.icon
  const scaling = stat?.scaling ?? 'none'

  return {
    label: definition.label,
    value: stat?.value ?? '0',
    unit: definition.unit,
    icon,
    scaling,
    scalingValue: scaling === 'none' ? '0' : stat?.scalingValue ?? '0',
    ...(scaling === 'custom' ? { customScaling: normalizeCustomScaling(stat?.customScaling) } : {}),
    ...(stat?.description || definition.description ? { description: stat?.description ?? definition.description } : {}),
  }
}

function normalizeStoredStats(
  stats: IPanelStat[] | undefined,
  definitions: StandardStatDefinition[],
  record: object,
): PanelStat[] {
  const statsByLabel = new Map((stats ?? []).filter(isPanelStat).map(stat => [stat.label, stat]))
  const legacyStats = record as Record<string, unknown>

  return definitions.map(definition => {
    const legacyStat = definition.legacyKey ? legacyStats[definition.legacyKey] : undefined
    const sourceStat = isPanelStat(legacyStat as IPanelStat | undefined) ? legacyStat as IPanelStat : statsByLabel.get(definition.label)

    return buildStandardStat(definition, sourceStat)
  })
}

interface BoonStatsRecord {
  name?: string
  stats?: IPanelStat[]
  panels?: Array<{ id: string; name: string; stats: IPanelStat[] }>
}

function normalizeOptionalStoredStats(stats: IPanelStat[] | undefined, definitions: StandardStatDefinition[]): PanelStat[] {
  const statsByLabel = new Map((stats ?? []).filter(isPanelStat).map(stat => [stat.label, stat]))

  return definitions.flatMap(definition => {
    const sourceStat = statsByLabel.get(definition.label)

    return sourceStat ? [buildStandardStat(definition, sourceStat)] : []
  })
}

function normalizeStoredWeaponStats(stats: IPanelStat[] | undefined, record: object): PanelStat[] {
  return [
    ...normalizeStoredStats(stats, STANDARD_WEAPON_STATS, record),
    ...normalizeOptionalStoredStats(stats, OPTIONAL_WEAPON_STATS),
  ]
}

function serializeStoredHeroInfo(heroInfo: HeroInfoRecord): HeroInfoDefinition {
  return {
    nameType: heroInfo.nameType,
    nameValue: heroInfo.nameValue,
    nameColor: heroInfo.nameColor,
    nameFontSize: heroInfo.nameFontSize ?? DEFAULT_HERO_NAME_FONT_SIZE,
    nameFontFamily: heroInfo.nameFontFamily ?? DEFAULT_HERO_NAME_FONT_FAMILY,
    nameFontWeight: heroInfo.nameFontWeight ?? DEFAULT_HERO_NAME_FONT_WEIGHT,
    tag1Text: heroInfo.tag1Text,
    tag2Text: heroInfo.tag2Text,
    tag3Text: heroInfo.tag3Text,
    tagColor: heroInfo.tagColor,
    tagTextColor: heroInfo.tagTextColor,
    tag1Tilt: heroInfo.tag1Tilt,
    tag2Tilt: heroInfo.tag2Tilt,
    tag3Tilt: heroInfo.tag3Tilt,
    tag1OffsetY: heroInfo.tag1OffsetY,
    tag2OffsetY: heroInfo.tag2OffsetY,
    tag3OffsetY: heroInfo.tag3OffsetY,
    ability1Icon: heroInfo.ability1Icon,
    ability2Icon: heroInfo.ability2Icon,
    ability3Icon: heroInfo.ability3Icon,
    ability4Icon: heroInfo.ability4Icon,
    abilityCircleColor: heroInfo.abilityCircleColor,
    abilityIconColor: heroInfo.abilityIconColor,
    ...(heroInfo.backstory ? { backstory: heroInfo.backstory } : {}),
  }
}

export async function getHeroStatsBySlug(slug: string): Promise<HeroStatsWithAbilityPayload | null> {
  try {
    await dbConnect()
  } catch (error) {
    const fallbackStats = buildFallbackHeroStatsBySlug(slug)

    if (fallbackStats) {
      return fallbackStats
    }

    throw error
  }

  const customHeroById = Types.ObjectId.isValid(slug)
    ? await CustomHero.findOne({ _id: new Types.ObjectId(slug), status: 'published', moderationStatus: { $ne: 'hidden' } }).select('_id slug name portrait render').lean<HeroRecord | null>()
    : null
  const officialHero = customHeroById ? null : await OfficialHero.findOne({ slug }).select('_id slug name portrait render').lean<HeroRecord | null>()
  const hero = customHeroById ?? officialHero ?? await CustomHero.findOne({ slug, status: 'published', moderationStatus: { $ne: 'hidden' } }).select('_id slug name portrait render').lean<HeroRecord | null>()

  if (!hero) {
    return null
  }

  const [heroInfo, boon, weapon, vitality, spirit, abilityStats] = await Promise.all([
    HeroInfo.findOne({ heroId: hero._id })
      .select('nameType nameValue nameColor nameFontSize nameFontFamily nameFontWeight tag1Text tag2Text tag3Text tagColor tagTextColor tag1Tilt tag2Tilt tag3Tilt tag1OffsetY tag2OffsetY tag3OffsetY ability1Icon ability2Icon ability3Icon ability4Icon abilityCircleColor abilityIconColor backstory')
      .lean<HeroInfoRecord | null>(),
    BoonStats.findOne({ heroId: hero._id }).select('name stats panels').lean<BoonStatsRecord | null>(),
    WeaponStats.findOne({ heroId: hero._id }).select('weaponName weaponDesc gunImageSrc weaponAttributes bulletDPS weaponMinRange weaponMaxRange stats panels bulletDamage weaponDamage bulletsPerSec fireRate ammo clipSizeIncrease reloadTime reloadReduction bulletVelocity bulletVelocityIncrease bulletLifesteal critBonusScale lightMelee heavyMelee').lean<WeaponStatsRecord | null>(),
    VitalityStats.findOne({ heroId: hero._id }).select('name stats panels maxHealth healthRegen healAmp nonCombatRegen bulletResist spiritResist meleeResist debuffResist critReduction moveSpeed sprintSpeed staminaCooldown staminaRecovery stamina dashSpeed').lean<VitalityStatsRecord | null>(),
    SpiritStats.findOne({ heroId: hero._id }).select('name topStats spiritPower spiritPowerStat panels abilityCooldown abilityDuration abilityRange spiritLifesteal maxChargesIncrease chargeCooldown').lean<SpiritStatsRecord | null>(),
    AbilityStats.findOne({ heroId: hero._id }).lean<AbilityStatsRecord | null>(),
  ])

  if (!weapon || !vitality || !spirit) {
    return null
  }

  const heroInfoPayload = heroInfo ? serializeStoredHeroInfo(heroInfo) : null

  return {
    hero: {
      slug: hero.slug,
      name: hero.name,
      portrait: hero.portrait,
      render: hero.render,
    },
    ...(heroInfoPayload ? { heroInfo: heroInfoPayload } : {}),
    ...(abilityStats && heroInfoPayload ? {
      abilityStats: normalizeAbilityStats(abilityStats, {
        displayName: hero.name,
        heroInfo: heroInfoPayload,
      }),
    } : {}),
    boon: {
      name: boon?.name ?? 'Boon Rewards',
      stats: buildBoonStatsArray(boon?.stats),
      panels: (boon?.panels ?? []).map(panel => ({
        id: panel.id,
        name: panel.name,
        stats: buildBoonStatsArray(panel.stats),
      })),
    },
    weapon: {
      weaponName: weapon.weaponName,
      weaponDesc: weapon.weaponDesc,
      gunImageSrc: weapon.gunImageSrc,
      weaponAttributes: weapon.weaponAttributes,
      bulletDPS: weapon.bulletDPS,
      weaponMinRange: weapon.weaponMinRange,
      weaponMaxRange: weapon.weaponMaxRange,
      stats: normalizeStoredWeaponStats(weapon.stats, weapon),
      panels: (weapon.panels ?? []).map(panel => ({
        id: panel.id,
        name: panel.name,
        weaponDesc: panel.weaponDesc ?? weapon.weaponDesc,
        gunImageSrc: panel.gunImageSrc ?? weapon.gunImageSrc,
        weaponAttributes: panel.weaponAttributes ?? weapon.weaponAttributes,
        bulletDPS: panel.bulletDPS,
        weaponMinRange: panel.weaponMinRange,
        weaponMaxRange: panel.weaponMaxRange,
        stats: normalizeStoredWeaponStats(panel.stats, panel),
      })),
    },
    vitality: {
      name: vitality.name ?? 'Vitality',
      stats: normalizeStoredStats(vitality.stats, STANDARD_VITALITY_STATS, vitality),
      panels: (vitality.panels ?? []).map(panel => ({
        id: panel.id,
        name: panel.name,
        stats: normalizeStoredStats(panel.stats, STANDARD_VITALITY_STATS, panel),
      })),
    },
    spirit: {
      name: spirit.name ?? 'Spirit',
      topStats: normalizeStoredStats(spirit.topStats, STANDARD_SPIRIT_STATS, spirit),
      spiritPowerStat: buildStandardStat(STANDARD_SPIRIT_POWER_STAT, spirit.spiritPowerStat ?? spirit.spiritPower),
      panels: (spirit.panels ?? []).map(panel => ({
        id: panel.id,
        name: panel.name,
        topStats: normalizeStoredStats(panel.topStats, STANDARD_SPIRIT_STATS, panel),
        spiritPowerStat: buildStandardStat(STANDARD_SPIRIT_POWER_STAT, panel.spiritPowerStat),
      })),
    },
  }
}
