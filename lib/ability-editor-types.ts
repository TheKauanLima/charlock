import type { PanelStat, ScalingType } from '@/components/panels/scaling-utils'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'

export type AbilitySectionType = 'richText' | 'grid'
export type AbilityTextColor = 'default' | 'spirit' | 'healing' | 'damage' | 'warning'

export interface AbilityStat extends PanelStat {
  icon: string
  iconColor?: string
  scaling: ScalingType
  scalingValue: string
}

export interface AbilityRichTextSection {
  id: string
  type: 'richText'
  title: string
  text: string
}

export interface AbilityGridCell extends AbilityStat {
  id: string
}

export interface AbilityGridSection {
  id: string
  type: 'grid'
  title: string
  mainCells: AbilityGridCell[]
  lowerCells: AbilityGridCell[]
}

export type AbilitySection = AbilityRichTextSection | AbilityGridSection

export interface AbilityVariant {
  name: string
  icon: string
  cooldown: AbilityStat
  hasCharges: boolean
  charges: AbilityStat
  rechargeTime: AbilityStat
  subStats: AbilityStat[]
  sections: AbilitySection[]
}

export type AbilityTierLevel = 1 | 2 | 3

export interface AbilityTier {
  tier: AbilityTierLevel
  upgradeText: string
  variant: AbilityVariant
}

export interface AbilityDefinition extends AbilityVariant {
  slot: number
  tiers: AbilityTier[]
}

export interface AbilityStatsPayload {
  abilities: AbilityDefinition[]
  secondaryAbilities?: AbilityDefinition[]
  secondaryAbilityAnchorIndex?: number
}

interface AbilityHeroLike {
  displayName: string
  heroInfo: Pick<HeroInfoDefinition, 'ability1Icon' | 'ability2Icon' | 'ability3Icon' | 'ability4Icon'>
}

const DEFAULT_PROPERTY_ICON = '/panorama/images/icons/properties/cooldown.svg'
const DEFAULT_GRID_ICON = '/panorama/images/icons/properties/damage_magic_color.svg'
const DEFAULT_HEAL_ICON = '/panorama/images/icons/properties/heal.svg'
export const DEFAULT_SECONDARY_ABILITY_ANCHOR_INDEX = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function getSecondaryAnchorIndex(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 3
    ? numericValue
    : DEFAULT_SECONDARY_ABILITY_ANCHOR_INDEX
}

function getScaling(value: unknown): ScalingType {
  return value === 'spirit' || value === 'courage' || value === 'melee' || value === 'boon' ? value : 'none'
}

function buildAbilityStat(value: Partial<AbilityStat> = {}): AbilityStat {
  return {
    label: getString(value.label, 'Value'),
    value: getString(value.value, '0'),
    unit: getString(value.unit),
    append: getString(value.append),
    icon: getString(value.icon, DEFAULT_PROPERTY_ICON),
    iconColor: getString(value.iconColor),
    scaling: getScaling(value.scaling),
    scalingValue: getString(value.scalingValue, '0'),
    ...(value.description ? { description: value.description } : {}),
  }
}

function normalizeAbilityStat(value: unknown, fallback: AbilityStat): AbilityStat {
  const record = isRecord(value) ? value : {}

  return buildAbilityStat({
    label: getString(record.label, fallback.label),
    value: getString(record.value, String(fallback.value)),
    unit: getString(record.unit, fallback.unit ?? ''),
    append: getString(record.append, fallback.append ?? ''),
    icon: getString(record.icon, fallback.icon),
    iconColor: getString(record.iconColor, fallback.iconColor ?? ''),
    scaling: getScaling(record.scaling),
    scalingValue: getString(record.scalingValue, fallback.scalingValue),
    description: getString(record.description),
  })
}

function normalizeStatArray(value: unknown, fallback: AbilityStat[], limit?: number) {
  const source = Array.isArray(value) ? value : []
  const normalized = source.map((item, index) => normalizeAbilityStat(item, fallback[index] ?? buildAbilityStat()))
  const nextStats = normalized.length ? normalized : fallback

  return typeof limit === 'number' ? nextStats.slice(0, limit) : nextStats
}

function getAbilityIcon(heroInfo: AbilityHeroLike['heroInfo'], slot: number) {
  if (slot === 1) {
    return heroInfo.ability1Icon
  }

  if (slot === 2) {
    return heroInfo.ability2Icon
  }

  if (slot === 3) {
    return heroInfo.ability3Icon
  }

  return heroInfo.ability4Icon
}

function buildDefaultAbilityVariant(slot: number, hero: AbilityHeroLike, idPrefix = `ability-${slot}`): AbilityVariant {
  const baseCooldown = String(18 + slot * 6)

  return {
    name: `${hero.displayName} Ability ${slot}`,
    icon: getAbilityIcon(hero.heroInfo, slot),
    cooldown: buildAbilityStat({
      label: 'Cooldown',
      value: baseCooldown,
      unit: 's',
      icon: DEFAULT_PROPERTY_ICON,
    }),
    hasCharges: false,
    charges: buildAbilityStat({
      label: 'Charges',
      value: '1',
      icon: '/panorama/images/icons/properties/charge.svg',
    }),
    rechargeTime: buildAbilityStat({
      label: 'Recharge Time',
      value: baseCooldown,
      unit: 's',
      icon: '/panorama/images/icons/properties/recharge.svg',
    }),
    subStats: [
      buildAbilityStat({
        label: 'Range',
        value: String(20 + slot * 5),
        unit: 'm',
        icon: '/panorama/images/icons/properties/range.svg',
      }),
    ],
    sections: [
      {
        id: `${idPrefix}-description`,
        type: 'richText',
        title: 'Description',
        text: `${hero.displayName} channels custom ability ${slot}. Add [c:spirit]scaling[/c] values and [i:cooldown] timing details here.`,
      },
      {
        id: `${idPrefix}-grid`,
        type: 'grid',
        title: 'Impact',
        mainCells: [
          {
            id: `${idPrefix}-damage`,
            ...buildAbilityStat({
              label: 'Damage',
              value: String(70 + slot * 25),
              icon: DEFAULT_GRID_ICON,
              scaling: 'spirit',
              scalingValue: '0.4',
            }),
          },
        ],
        lowerCells: [
          {
            id: `${idPrefix}-heal`,
            ...buildAbilityStat({
              label: 'Bonus',
              value: String(10 + slot * 5),
              append: '%',
              icon: DEFAULT_HEAL_ICON,
            }),
          },
        ],
      },
    ],
  }
}

export function buildDefaultAbility(slot: number, hero: AbilityHeroLike): AbilityDefinition {
  return {
    slot,
    ...buildDefaultAbilityVariant(slot, hero),
    tiers: [1, 2, 3].map(tier => ({
      tier: tier as AbilityTierLevel,
      upgradeText: `[b]+${tier === 1 ? 150 : tier === 2 ? 250 : 500}[/b] upgrade detail`,
      variant: buildDefaultAbilityVariant(slot, hero, `ability-${slot}-tier-${tier}`),
    })),
  }
}

function normalizeSection(value: unknown, fallback: AbilitySection): AbilitySection {
  const record = isRecord(value) ? value : {}

  if (record.type === 'grid') {
    const gridFallback = fallback.type === 'grid' ? fallback : {
      id: getString(record.id, 'grid-section'),
      type: 'grid' as const,
      title: 'Grid',
      mainCells: [],
      lowerCells: [],
    }

    return {
      id: getString(record.id, gridFallback.id),
      type: 'grid',
      title: getString(record.title, gridFallback.title),
      mainCells: normalizeStatArray(record.mainCells, gridFallback.mainCells, 3).map((stat, index) => ({
        id: getString((Array.isArray(record.mainCells) && isRecord(record.mainCells[index]) ? record.mainCells[index].id : undefined), gridFallback.mainCells[index]?.id ?? `${gridFallback.id}-main-${index + 1}`),
        ...stat,
      })),
      lowerCells: normalizeStatArray(record.lowerCells, gridFallback.lowerCells).map((stat, index) => {
        const sourceCell = Array.isArray(record.lowerCells) && isRecord(record.lowerCells[index]) ? record.lowerCells[index] : {}
        const migratedAppend = getString(sourceCell.append, getString(sourceCell.unit, stat.append ?? ''))

        return {
          id: getString(sourceCell.id, gridFallback.lowerCells[index]?.id ?? `${gridFallback.id}-lower-${index + 1}`),
          ...stat,
          append: migratedAppend,
          unit: '',
        }
      }),
    }
  }

  const textFallback = fallback.type === 'richText' ? fallback : {
    id: getString(record.id, 'text-section'),
    type: 'richText' as const,
    title: 'Description',
    text: '',
  }

  return {
    id: getString(record.id, textFallback.id),
    type: 'richText',
    title: getString(record.title, textFallback.title),
    text: getString(record.text, textFallback.text),
  }
}

export function normalizeAbilityDefinition(value: unknown, fallback: AbilityDefinition): AbilityDefinition {
  const record = isRecord(value) ? value : {}

  function normalizeAbilityVariant(valueToNormalize: unknown, fallbackVariant: AbilityVariant): AbilityVariant {
    const variantRecord = isRecord(valueToNormalize) ? valueToNormalize : {}
    const sectionFallbacks = fallbackVariant.sections
    const sections = Array.isArray(variantRecord.sections)
      ? variantRecord.sections.map((section, index) => normalizeSection(section, sectionFallbacks[index] ?? sectionFallbacks[0]))
      : sectionFallbacks

    return {
      name: getString(variantRecord.name, fallbackVariant.name),
      icon: getString(variantRecord.icon, fallbackVariant.icon),
      cooldown: normalizeAbilityStat(variantRecord.cooldown, fallbackVariant.cooldown),
      hasCharges: getBoolean(variantRecord.hasCharges, fallbackVariant.hasCharges),
      charges: normalizeAbilityStat(variantRecord.charges, fallbackVariant.charges),
      rechargeTime: normalizeAbilityStat(variantRecord.rechargeTime, fallbackVariant.rechargeTime),
      subStats: normalizeStatArray(variantRecord.subStats, fallbackVariant.subStats),
      sections,
    }
  }

  const sectionFallbacks = fallback.sections
  const sections = Array.isArray(record.sections)
    ? record.sections.map((section, index) => normalizeSection(section, sectionFallbacks[index] ?? sectionFallbacks[0]))
    : sectionFallbacks
  const normalizedBase = normalizeAbilityVariant({ ...record, sections }, fallback)
  const sourceTiers = Array.isArray(record.tiers) ? record.tiers : []
  const tiers = fallback.tiers.map(fallbackTier => {
    const sourceTier = sourceTiers.find(tier => isRecord(tier) && Number(tier.tier) === fallbackTier.tier)
    const tierRecord = isRecord(sourceTier) ? sourceTier : {}

    return {
      tier: fallbackTier.tier,
      upgradeText: getString(tierRecord.upgradeText, fallbackTier.upgradeText),
      variant: normalizeAbilityVariant(tierRecord.variant, fallbackTier.variant),
    }
  })

  return {
    slot: Number(record.slot) || fallback.slot,
    ...normalizedBase,
    tiers,
  }
}

export function buildDefaultAbilityStats(hero: HeroDefinition | AbilityHeroLike): AbilityStatsPayload {
  return {
    abilities: [1, 2, 3, 4].map(slot => buildDefaultAbility(slot, hero)),
  }
}

export function buildDefaultSecondaryAbilities(hero: HeroDefinition | AbilityHeroLike): AbilityDefinition[] {
  return [1, 2, 3].map(slot => buildDefaultAbility(slot, hero))
}

export function getSecondaryAbilityIndexForPrimary(primaryIndex: number, anchorIndex = DEFAULT_SECONDARY_ABILITY_ANCHOR_INDEX) {
  if (primaryIndex === anchorIndex || primaryIndex < 0 || primaryIndex > 3) {
    return null
  }

  return primaryIndex < anchorIndex ? primaryIndex : primaryIndex - 1
}

export function getPrimaryAbilityIndexForSecondary(secondaryIndex: number, anchorIndex = DEFAULT_SECONDARY_ABILITY_ANCHOR_INDEX) {
  const primaryIndexes = [0, 1, 2, 3].filter(primaryIndex => primaryIndex !== anchorIndex)

  return primaryIndexes[secondaryIndex] ?? 0
}

export function normalizeAbilityStats(value: unknown, hero: HeroDefinition | AbilityHeroLike): AbilityStatsPayload {
  const defaults = buildDefaultAbilityStats(hero)
  const record = isRecord(value) ? value : {}
  const sourceAbilities = Array.isArray(record.abilities) ? record.abilities : []
  const abilities = defaults.abilities.map((fallback, index) => normalizeAbilityDefinition(sourceAbilities[index], fallback))
  const secondaryFallbacks = buildDefaultSecondaryAbilities(hero)
  const sourceSecondaryAbilities = Array.isArray(record.secondaryAbilities) ? record.secondaryAbilities : null
  const secondaryAbilities = sourceSecondaryAbilities
    ? secondaryFallbacks.map((fallback, index) => normalizeAbilityDefinition(sourceSecondaryAbilities[index], fallback))
    : undefined

  return {
    abilities,
    ...(secondaryAbilities ? {
      secondaryAbilities,
      secondaryAbilityAnchorIndex: getSecondaryAnchorIndex(record.secondaryAbilityAnchorIndex),
    } : {}),
  }
}
