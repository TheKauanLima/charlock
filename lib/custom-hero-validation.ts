import type { ZodIssue } from 'zod'

import { customHeroSaveSchema } from '@/lib/custom-hero-schemas'
import type { CustomHeroSavePayload } from '@/lib/custom-hero-types'

type IssueLimit = string | number | bigint | boolean | undefined

const EXACT_FIELD_LABELS: Record<string, string> = {
  id: 'Saved hero id',
  name: 'Hero name',
  status: 'Hero visibility',
  hero: 'Hero image settings',
  'hero.portrait': 'Hero portrait',
  'hero.render': 'Hero render',
  'hero.background': 'Hero background',
  'hero.renderPosition.x': 'Hero render horizontal position',
  'hero.renderPosition.y': 'Hero render vertical position',
  allowCopies: 'Allow copies',
  heroInfo: 'Hero info',
  'heroInfo.nameType': 'Hero name mode',
  'heroInfo.nameValue': 'Hero name text or image',
  'heroInfo.nameColor': 'Hero name color',
  'heroInfo.nameFontSize': 'Hero name font size',
  'heroInfo.nameFontFamily': 'Hero name font family',
  'heroInfo.nameFontWeight': 'Hero name font weight',
  'heroInfo.tag1Text': 'Tag 1 text',
  'heroInfo.tag2Text': 'Tag 2 text',
  'heroInfo.tag3Text': 'Tag 3 text',
  'heroInfo.tagColor': 'Tag background color',
  'heroInfo.tagTextColor': 'Tag text color',
  'heroInfo.ability1Icon': 'Ability 1 icon',
  'heroInfo.ability2Icon': 'Ability 2 icon',
  'heroInfo.ability3Icon': 'Ability 3 icon',
  'heroInfo.ability4Icon': 'Ability 4 icon',
  'heroInfo.abilityCircleColor': 'Ability circle color',
  'heroInfo.abilityIconColor': 'Ability icon color',
  'heroInfo.backstory': 'Backstory',
  boon: 'Boon panel',
  'boon.name': 'Boon panel name',
  'boon.stats': 'Boon stats',
  'boon.panels': 'Boon panel variants',
  weapon: 'Weapon panel',
  'weapon.weaponName': 'Weapon name',
  'weapon.weaponDesc': 'Weapon description',
  'weapon.gunImageSrc': 'Weapon image',
  'weapon.weaponAttributes': 'Weapon tags',
  'weapon.bulletDPS': 'Weapon DPS',
  'weapon.weaponMinRange': 'Minimum falloff range',
  'weapon.weaponMaxRange': 'Maximum falloff range',
  'weapon.stats': 'Weapon stats',
  'weapon.panels': 'Weapon panel variants',
  vitality: 'Vitality panel',
  'vitality.name': 'Vitality panel name',
  'vitality.stats': 'Vitality stats',
  'vitality.panels': 'Vitality panel variants',
  spirit: 'Spirit panel',
  'spirit.name': 'Spirit panel name',
  'spirit.topStats': 'Spirit top stats',
  'spirit.spiritPowerStat': 'Spirit Power stat',
  'spirit.panels': 'Spirit panel variants',
  abilityStats: 'Ability stats',
  'abilityStats.abilities': 'Primary abilities',
  'abilityStats.secondaryAbilities': 'Secondary abilities',
  'abilityStats.secondaryAbilitySlots': 'Secondary ability slots',
  'abilityStats.secondaryAbilityAnchorIndex': 'Secondary ability anchor',
  interactions: 'Interactions',
}

const GENERIC_FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Name',
  label: 'Stat label',
  value: 'Stat value',
  unit: 'Stat unit',
  append: 'Stat suffix',
  icon: 'Icon',
  iconColor: 'Icon color',
  scaling: 'Scaling type',
  scalingValue: 'Scaling value',
  description: 'Description',
  weaponDesc: 'Weapon description',
  gunImageSrc: 'Weapon image',
  weaponAttributes: 'Weapon tags',
  bulletDPS: 'Weapon DPS',
  weaponMinRange: 'Minimum falloff range',
  weaponMaxRange: 'Maximum falloff range',
  stats: 'Stats',
  panels: 'Panel variants',
  topStats: 'Top stats',
  spiritPowerStat: 'Spirit Power stat',
  abilities: 'Abilities',
  secondaryAbilities: 'Secondary abilities',
  secondaryAbilitySlots: 'Secondary ability slots',
  secondaryAbilityAnchorIndex: 'Secondary ability anchor',
  slot: 'Ability slot',
  tiers: 'Ability tiers',
  tier: 'Ability tier',
  upgradeText: 'Tier upgrade text',
  variant: 'Tier ability variant',
  cooldown: 'Cooldown stat',
  hasCooldown: 'Cooldown toggle',
  hasCharges: 'Charges toggle',
  charges: 'Charges stat',
  rechargeTime: 'Recharge Time stat',
  subStats: 'Sub-header stats',
  sections: 'Ability sections',
  type: 'Section type',
  title: 'Section title',
  text: 'Ability text',
  mainCells: 'Main stat cells',
  lowerCells: 'Lower stat cells',
  targetHeroId: 'Target hero',
  targetHeroName: 'Target hero name',
  lines: 'Dialogue lines',
  speakerSide: 'Dialogue speaker',
  speakerHeroId: 'Speaker hero',
  order: 'Dialogue line order',
  createdAt: 'Conversation created date',
  updatedAt: 'Conversation edited date',
}

function pathToKey(path: Array<PropertyKey>) {
  return path.join('.')
}

function getPropertyName(pathPart: PropertyKey | undefined) {
  return typeof pathPart === 'string' ? pathPart : ''
}

function getHumanIndex(pathPart: PropertyKey | undefined) {
  return typeof pathPart === 'number' ? pathPart + 1 : null
}

function getFieldLabel(path: Array<PropertyKey>) {
  const key = pathToKey(path)
  const exactLabel = EXACT_FIELD_LABELS[key]

  if (exactLabel) {
    return exactLabel
  }

  const abilityIndex = path[1] === 'abilities' || path[1] === 'secondaryAbilities' ? getHumanIndex(path[2]) : null
  const abilityType = path[1] === 'secondaryAbilities' ? 'Secondary ability' : 'Ability'

  if (abilityIndex && getPropertyName(path[3]) === 'name') {
    return `${abilityType} ${abilityIndex} name`
  }

  if (abilityIndex && getPropertyName(path[3]) === 'sections') {
    return `${abilityType} ${abilityIndex} sections`
  }

  if (abilityIndex && getPropertyName(path[3]) === 'tiers') {
    const tierIndex = getHumanIndex(path[4])
    const tierPart = tierIndex ? ` tier ${tierIndex}` : ' tier'
    const tierField = getPropertyName(path[5])

    if (tierField === 'upgradeText') return `${abilityType} ${abilityIndex}${tierPart} upgrade text`
    if (tierField) return `${abilityType} ${abilityIndex}${tierPart} ${GENERIC_FIELD_LABELS[tierField]?.toLowerCase() ?? tierField}`
  }

  const panelVariantIndex = ['boon', 'weapon', 'vitality', 'spirit'].includes(getPropertyName(path[0])) && getPropertyName(path[1]) === 'panels'
    ? getHumanIndex(path[2])
    : null

  if (panelVariantIndex) {
    const panelName = getPropertyName(path[0])
    const panelField = getPropertyName(path[3])
    const panelLabel = `${panelName.charAt(0).toUpperCase()}${panelName.slice(1)} panel ${panelVariantIndex}`

    if (panelField === 'name') return `${panelLabel} name`
    if (panelField === 'stats' || panelField === 'topStats') return `${panelLabel} stats`
    if (panelField === 'weaponDesc') return `${panelLabel} weapon description`
  }

  const statIndex = getHumanIndex(path.find(part => typeof part === 'number'))
  const lastField = getPropertyName(path[path.length - 1])
  const genericLabel = GENERIC_FIELD_LABELS[lastField]

  if (genericLabel && statIndex && ['label', 'value', 'unit', 'append', 'icon', 'iconColor', 'scaling', 'scalingValue', 'description'].includes(lastField)) {
    return `${genericLabel} ${statIndex}`
  }

  if (genericLabel) {
    return genericLabel
  }

  return key || 'Draft'
}

function getIssueLimit(issue: ZodIssue, propertyName: 'maximum' | 'minimum') {
  return propertyName in issue ? issue[propertyName as keyof typeof issue] as IssueLimit : undefined
}

function getIssueOrigin(issue: ZodIssue) {
  return 'origin' in issue && typeof issue.origin === 'string' ? issue.origin : ''
}

function formatLimit(limit: IssueLimit) {
  return typeof limit === 'bigint' ? limit.toString() : String(limit)
}

function getFriendlyIssueMessage(issue: ZodIssue) {
  const fieldLabel = getFieldLabel(issue.path)

  if (issue.code === 'too_big') {
    const maximum = getIssueLimit(issue, 'maximum')
    const origin = getIssueOrigin(issue)

    if (origin === 'string') return `${fieldLabel} must be ${formatLimit(maximum)} characters or fewer.`
    if (origin === 'array') return `${fieldLabel} can include at most ${formatLimit(maximum)} items.`
    if (origin === 'number') return `${fieldLabel} must be ${formatLimit(maximum)} or less.`

    return `${fieldLabel} is above the allowed limit.`
  }

  if (issue.code === 'too_small') {
    const minimum = getIssueLimit(issue, 'minimum')
    const origin = getIssueOrigin(issue)

    if (origin === 'string' && minimum === 1) return `${fieldLabel} is required.`
    if (origin === 'string') return `${fieldLabel} must be at least ${formatLimit(minimum)} characters.`
    if (origin === 'array') return `${fieldLabel} must include at least ${formatLimit(minimum)} items.`
    if (origin === 'number') return `${fieldLabel} must be ${formatLimit(minimum)} or more.`

    return `${fieldLabel} is below the allowed limit.`
  }

  if (issue.code === 'invalid_type') {
    return `${fieldLabel} has an invalid value type.`
  }

  if (issue.code === 'invalid_value') {
    return `${fieldLabel} uses an unsupported option.`
  }

  if (issue.code === 'invalid_union') {
    return `${fieldLabel} has an invalid value.`
  }

  if (issue.code === 'unrecognized_keys') {
    const keys = 'keys' in issue && Array.isArray(issue.keys) ? issue.keys.join(', ') : 'unknown fields'
    const fieldPrefix = issue.path.length ? `${fieldLabel} ` : 'This draft '

    return `${fieldPrefix}includes fields that cannot be saved: ${keys}.`
  }

  return `${fieldLabel}: ${issue.message}`
}

function dedupe(messages: string[]) {
  return Array.from(new Set(messages))
}

export function getMissingAbilityIconSaveIssueMessages(payload: Pick<CustomHeroSavePayload, 'abilityStats'>) {
  const messages: string[] = []
  const abilities = Array.isArray(payload.abilityStats?.abilities) ? payload.abilityStats.abilities : []
  const secondaryAbilities = Array.isArray(payload.abilityStats?.secondaryAbilities) ? payload.abilityStats.secondaryAbilities : []

  abilities.forEach((ability, index) => {
    if (!ability.icon?.trim()) {
      messages.push(`Ability ${index + 1} icon is required. Open Ability ${index + 1} and choose an ability icon.`)
    }
  })

  secondaryAbilities.forEach((ability, index) => {
    if (!ability.icon?.trim()) {
      messages.push(`Secondary ability ${index + 1} icon is required. Open that secondary ability and choose an ability icon.`)
    }
  })

  return messages
}

export function getCustomHeroSaveIssueMessages(payload: CustomHeroSavePayload) {
  const result = customHeroSaveSchema.safeParse(payload)
  const messages: string[] = []

  if (!result.success) {
    for (const issue of result.error.issues) {
      messages.push(getFriendlyIssueMessage(issue))
    }
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const render = typeof payload.hero?.render === 'string' ? payload.hero.render.trim() : ''
  const portrait = typeof payload.hero?.portrait === 'string' ? payload.hero.portrait.trim() : ''

  if (!name) {
    messages.push('Hero name is required.')
  }

  if (!render) {
    messages.push('Hero render is required.')
  }

  if (payload.status === 'published' && !portrait) {
    messages.push('Publishing requires a portrait.')
  }

  return dedupe(messages)
}
