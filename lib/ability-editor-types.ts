import type { PanelStat, ScalingType } from '@/components/panels/scaling-utils'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'

export type AbilitySectionType = 'richText' | 'grid'
export type AbilityTextColor = 'default' | 'spirit' | 'healing' | 'damage' | 'warning'

export interface AbilityStat extends PanelStat {
  icon: string
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

export interface AbilityDefinition {
  slot: number
  name: string
  icon: string
  cooldown: AbilityStat
  hasCharges: boolean
  charges: AbilityStat
  rechargeTime: AbilityStat
  subStats: AbilityStat[]
  sections: AbilitySection[]
}

export interface AbilityStatsPayload {
  abilities: AbilityDefinition[]
}

interface AbilityHeroLike {
  displayName: string
  heroInfo: Pick<HeroInfoDefinition, 'ability1Icon' | 'ability2Icon' | 'ability3Icon' | 'ability4Icon'>
}

const DEFAULT_PROPERTY_ICON = '/panorama/images/icons/properties/cooldown.svg'
const DEFAULT_GRID_ICON = '/panorama/images/icons/properties/damage_magic_color.svg'
const DEFAULT_HEAL_ICON = '/panorama/images/icons/properties/heal.svg'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function getScaling(value: unknown): ScalingType {
  return value === 'spirit' || value === 'courage' || value === 'melee' || value === 'boon' ? value : 'none'
}

function buildAbilityStat(value: Partial<AbilityStat> = {}): AbilityStat {
  return {
    label: getString(value.label, 'Value'),
    value: getString(value.value, '0'),
    unit: getString(value.unit),
    icon: getString(value.icon, DEFAULT_PROPERTY_ICON),
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
    icon: getString(record.icon, fallback.icon),
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

export function buildDefaultAbility(slot: number, hero: AbilityHeroLike): AbilityDefinition {
  const baseCooldown = String(18 + slot * 6)

  return {
    slot,
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
        id: `ability-${slot}-description`,
        type: 'richText',
        title: 'Description',
        text: `[b]${hero.displayName}[/b] channels custom ability ${slot}. Add [c:spirit]scaling[/c] values and [i:cooldown] timing details here.`,
      },
      {
        id: `ability-${slot}-grid`,
        type: 'grid',
        title: 'Impact',
        mainCells: [
          {
            id: `ability-${slot}-damage`,
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
            id: `ability-${slot}-heal`,
            ...buildAbilityStat({
              label: 'Bonus',
              value: String(10 + slot * 5),
              unit: '%',
              icon: DEFAULT_HEAL_ICON,
            }),
          },
        ],
      },
    ],
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
      lowerCells: normalizeStatArray(record.lowerCells, gridFallback.lowerCells).map((stat, index) => ({
        id: getString((Array.isArray(record.lowerCells) && isRecord(record.lowerCells[index]) ? record.lowerCells[index].id : undefined), gridFallback.lowerCells[index]?.id ?? `${gridFallback.id}-lower-${index + 1}`),
        ...stat,
      })),
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
  const sectionFallbacks = fallback.sections
  const sections = Array.isArray(record.sections)
    ? record.sections.map((section, index) => normalizeSection(section, sectionFallbacks[index] ?? sectionFallbacks[0]))
    : sectionFallbacks

  return {
    slot: Number(record.slot) || fallback.slot,
    name: getString(record.name, fallback.name),
    icon: getString(record.icon, fallback.icon),
    cooldown: normalizeAbilityStat(record.cooldown, fallback.cooldown),
    hasCharges: getBoolean(record.hasCharges, fallback.hasCharges),
    charges: normalizeAbilityStat(record.charges, fallback.charges),
    rechargeTime: normalizeAbilityStat(record.rechargeTime, fallback.rechargeTime),
    subStats: normalizeStatArray(record.subStats, fallback.subStats),
    sections,
  }
}

export function buildDefaultAbilityStats(hero: HeroDefinition | AbilityHeroLike): AbilityStatsPayload {
  return {
    abilities: [1, 2, 3, 4].map(slot => buildDefaultAbility(slot, hero)),
  }
}

export function normalizeAbilityStats(value: unknown, hero: HeroDefinition | AbilityHeroLike): AbilityStatsPayload {
  const defaults = buildDefaultAbilityStats(hero)
  const record = isRecord(value) ? value : {}
  const sourceAbilities = Array.isArray(record.abilities) ? record.abilities : []
  const abilities = defaults.abilities.map((fallback, index) => normalizeAbilityDefinition(sourceAbilities[index], fallback))

  return {
    abilities,
  }
}
