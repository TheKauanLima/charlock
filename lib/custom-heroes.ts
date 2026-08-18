import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { Types, type PipelineStage } from 'mongoose'

import dbConnect, { isDatabaseConnectionError } from '@/lib/dbConnect'
import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import { normalizeAbilityStats } from '@/lib/ability-editor-types'
import { ApiRequestError } from '@/lib/api-errors'
import { customHeroSaveSchema, stripDatabaseMetadata } from '@/lib/custom-hero-schemas'
import { DEFAULT_HERO_NAME_FONT_FAMILY, DEFAULT_HERO_NAME_FONT_SIZE, DEFAULT_HERO_NAME_FONT_WEIGHT, HEROES, type HeroInfoDefinition } from '@/lib/hero-data'
import type { RenderPosition } from '@/lib/editor-assets'
import type { CreatorProfileSummary, CustomHeroDetail, CustomHeroListFilters, CustomHeroListResult, CustomHeroSavePayload, CustomHeroSort, CustomHeroStatus, CustomHeroSummary, HeroInteraction } from '@/lib/custom-hero-types'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'
import AbilityStats from '@/lib/models/AbilityStats'
import BoonStats from '@/lib/models/BoonStats'
import Comment from '@/lib/models/Comment'
import CustomHero from '@/lib/models/CustomHero'
import Follow from '@/lib/models/Follow'
import HeroInfo from '@/lib/models/HeroInfo'
import Like from '@/lib/models/Like'
import Notification from '@/lib/models/Notification'
import SpiritStats from '@/lib/models/SpiritStats'
import User from '@/lib/models/User'
import VitalityStats from '@/lib/models/VitalityStats'
import WeaponStats from '@/lib/models/WeaponStats'
import type { ICustomHero } from '@/lib/models/CustomHero'
import type { IPanelStat } from '@/lib/models/WeaponStats'
import { normalizeVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import { buildBoonStatsArray } from '@/components/panels/boon-stats-mapper'
import { normalizeCustomScaling } from '@/components/panels/scaling-utils'
import { createNotification, resolveRecipientClerkId } from '@/lib/notifications'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getMissingAbilityIconSaveIssueMessages } from '@/lib/custom-hero-validation'
import { assertUserNotSuspended } from '@/lib/user-suspension'
import { getUserLevel } from '@/lib/user-level'

interface Actor {
  clerkId: string
  storageUserId: string
  ownerIds: string[]
}

interface HeroRecord extends ICustomHero {
  _id: Types.ObjectId
}

interface HeroInfoRecord extends HeroInfoDefinition {
  heroId: Types.ObjectId
}

interface WeaponStatsRecord {
  weaponName: string
  weaponDesc: string
  gunImageSrc: string
  weaponAttributes: string[]
  bulletDPS: number
  weaponMinRange: number
  weaponMaxRange: number
  stats: IPanelStat[]
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
  stats: IPanelStat[]
  panels?: Array<{ id: string; name: string; stats: IPanelStat[] }>
}

interface SpiritStatsRecord {
  name?: string
  topStats: IPanelStat[]
  spiritPowerStat: IPanelStat
  panels?: Array<{ id: string; name: string; topStats: IPanelStat[]; spiritPowerStat: IPanelStat }>
}

interface BoonStatsRecord {
  name?: string
  stats: IPanelStat[]
  panels?: Array<{ id: string; name: string; stats: IPanelStat[] }>
}

interface AbilityStatsRecord {
  abilities: AbilityStatsPayload['abilities']
  secondaryAbilities?: AbilityStatsPayload['secondaryAbilities']
  secondaryAbilitySlots?: AbilityStatsPayload['secondaryAbilitySlots']
  secondaryAbilityAnchorIndex?: AbilityStatsPayload['secondaryAbilityAnchorIndex']
}

interface HeroBundle {
  hero: HeroRecord
  heroInfo: HeroInfoRecord | null
  boon: BoonStatsRecord | null
  weapon: WeaponStatsRecord | null
  vitality: VitalityStatsRecord | null
  spirit: SpiritStatsRecord | null
  abilityStats: AbilityStatsRecord | null
}

interface HeroAggregateRecord extends HeroRecord {
  heroInfo?: HeroInfoRecord | null
  abilityStats?: AbilityStatsRecord | null
}

export class CustomHeroError extends ApiRequestError {
  constructor(message: string, status: number) {
    super(message, status)
    this.name = 'CustomHeroError'
  }
}

const DEFAULT_HERO_INFO = HEROES[0].heroInfo
const DEFAULT_BACKGROUND = '/panorama/images/heroes/backgrounds/generic_bg_psd.png'
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function getNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

interface CreatorUserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
  profileImageUrl?: string | null
  preferredHero?: string | null
}

interface CreatorContributionCount {
  _id: string
  count: number
}

function normalizeInteractionDate(value: string, fallback: string) {
  const timestamp = new Date(value)

  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString()
}

interface CustomInteractionTarget {
  id: string
  name: string
  portrait: string
}

function normalizeInteractions(
  interactions: HeroInteraction[] | undefined,
  customHeroId?: string,
  customTargets: Map<string, CustomInteractionTarget> = new Map(),
  requireKnownTargets = false,
): HeroInteraction[] {
  const now = new Date().toISOString()

  return (interactions ?? []).map(interaction => {
    const officialTarget = HEROES.find(hero => hero.slug === interaction.targetHeroId)
    const customTarget = customTargets.get(interaction.targetHeroId)
    const targetHero = officialTarget
      ? { id: officialTarget.slug, name: officialTarget.displayName, portrait: undefined }
      : customTarget
        ? customTarget
        : !requireKnownTargets && interaction.targetHeroPortrait
          ? {
              id: interaction.targetHeroId,
              name: interaction.targetHeroName,
              portrait: interaction.targetHeroPortrait,
            }
          : null

    if (!targetHero) {
      throw new CustomHeroError(`Unknown interaction target: ${interaction.targetHeroName}`, 400)
    }

    const createdAt = normalizeInteractionDate(interaction.createdAt, now)

    return {
      id: interaction.id,
      targetHeroId: targetHero.id,
      targetHeroName: targetHero.name,
      ...(targetHero.portrait ? { targetHeroPortrait: targetHero.portrait } : {}),
      title: interaction.title.trim() || 'New Conversation',
      lines: interaction.lines
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((line, order) => ({
          id: line.id,
          speakerSide: line.speakerSide,
          speakerHeroId: line.speakerSide === 'left' && customHeroId
            ? customHeroId
            : line.speakerSide === 'right'
              ? targetHero.id
              : line.speakerHeroId,
          text: line.text,
          order,
        })),
      createdAt,
      updatedAt: normalizeInteractionDate(interaction.updatedAt, createdAt),
    }
  })
}

async function getOwnedCustomInteractionTargets(
  interactions: HeroInteraction[] | undefined,
  actor: Actor,
  customHeroId: string,
) {
  const customTargetIds = [...new Set((interactions ?? [])
    .map(interaction => interaction.targetHeroId)
    .filter(targetHeroId => !HEROES.some(hero => hero.slug === targetHeroId)))]

  if (customTargetIds.includes(customHeroId)) {
    throw new CustomHeroError('A hero cannot target itself in an interaction', 400)
  }

  if (!customTargetIds.length) return new Map<string, CustomInteractionTarget>()

  if (customTargetIds.some(targetHeroId => !Types.ObjectId.isValid(targetHeroId))) {
    const unknownTarget = (interactions ?? []).find(interaction => customTargetIds.includes(interaction.targetHeroId))

    throw new CustomHeroError(`Unknown interaction target: ${unknownTarget?.targetHeroName ?? 'Custom hero'}`, 400)
  }

  const targets = await CustomHero.find({
    _id: { $in: customTargetIds.map(targetHeroId => new Types.ObjectId(targetHeroId)) },
    createdByUserId: { $in: actor.ownerIds },
  }).select('_id name portrait').lean<Array<{ _id: Types.ObjectId; name: string; portrait: string }>>()
  const targetMap = new Map(targets.map(target => [target._id.toString(), {
    id: target._id.toString(),
    name: target.name,
    portrait: target.portrait,
  }]))

  if (targetMap.size !== customTargetIds.length) {
    const unknownTargetId = customTargetIds.find(targetHeroId => !targetMap.has(targetHeroId))
    const unknownTarget = (interactions ?? []).find(interaction => interaction.targetHeroId === unknownTargetId)

    throw new CustomHeroError(`Unknown interaction target: ${unknownTarget?.targetHeroName ?? 'Custom hero'}`, 400)
  }

  return targetMap
}

function normalizeRenderPosition(value: RenderPosition | null | undefined): RenderPosition {
  return {
    x: getNumber(value?.x),
    y: getNumber(value?.y),
  }
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(item => getString(item)).filter(Boolean) : []
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeStatus(value: unknown): CustomHeroStatus {
  return value === 'published' ? 'published' : 'private'
}

function getPanelScaling(value: unknown): IPanelStat['scaling'] {
  const scaling = getString(value)

  return scaling === 'spirit' || scaling === 'courage' || scaling === 'melee' || scaling === 'boon' || scaling === 'custom'
    ? scaling
    : 'none'
}

function normalizeCustomPanelScaling(value: unknown): IPanelStat['customScaling'] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return normalizeCustomScaling({
    name: getString(value.name),
    icon: getString(value.icon),
    color: getString(value.color),
  })
}

function normalizePanelStat(value: unknown): IPanelStat {
  const record = isRecord(value) ? value : {}
  const scaling = getPanelScaling(record.scaling)

  return {
    label: getString(record.label),
    value: getString(record.value, '0'),
    unit: getString(record.unit),
    append: getString(record.append),
    icon: getString(record.icon, 'dot'),
    iconColor: getString(record.iconColor),
    scaling,
    scalingValue: scaling === 'none' ? '0' : getString(record.scalingValue, '0'),
    ...(scaling === 'custom' ? { customScaling: normalizeCustomPanelScaling(record.customScaling) ?? normalizeCustomScaling() } : {}),
    ...(getString(record.description) ? { description: getString(record.description) } : {}),
  }
}

function normalizeStats(value: unknown) {
  return Array.isArray(value) ? value.map(normalizePanelStat).filter(stat => stat.label) : []
}

function normalizeVitalityStats(value: unknown) {
  return normalizeVitalityStatsArray(normalizeStats(value))
}

function normalizeBoonStats(value: unknown) {
  const stats = Array.isArray(value) ? value.map(stat => {
    const record = isRecord(stat) ? stat : {}

    const scaling = getPanelScaling(record.scaling)

    return {
      label: getString(record.label),
      value: getString(record.value, '0'),
      unit: '',
      icon: getString(record.icon, 'dot'),
      iconColor: getString(record.iconColor),
      scaling,
      scalingValue: scaling === 'none' ? '0' : getString(record.scalingValue, '0'),
      ...(scaling === 'custom' ? { customScaling: normalizeCustomPanelScaling(record.customScaling) ?? normalizeCustomScaling() } : {}),
    }
  }).filter(stat => stat.label) : []

  return buildBoonStatsArray(stats)
}

function normalizeBoonPanels(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((panel, index) => {
    const record = isRecord(panel) ? panel : {}

    return {
      id: getString(record.id, `boon-panel-${index + 1}`),
      name: getString(record.name, `Boon ${index + 2}`),
      stats: normalizeBoonStats(record.stats),
    }
  })
}

interface WeaponPanelFallback {
  weaponDesc: string
  gunImageSrc: string
  weaponAttributes: string[]
}

function normalizeWeaponPanels(value: unknown, fallback?: WeaponPanelFallback) {
  if (!Array.isArray(value)) return []

  return value.map((panel, index) => {
    const record = isRecord(panel) ? panel : {}

    return {
      id: getString(record.id, `weapon-panel-${index + 1}`),
      name: getString(record.name, `Weapon ${index + 2}`),
      weaponDesc: getString(record.weaponDesc, fallback?.weaponDesc ?? ''),
      gunImageSrc: getString(record.gunImageSrc, fallback?.gunImageSrc ?? ''),
      weaponAttributes: Array.isArray(record.weaponAttributes)
        ? getStringArray(record.weaponAttributes)
        : fallback?.weaponAttributes ?? [],
      bulletDPS: getNumber(record.bulletDPS),
      weaponMinRange: getNumber(record.weaponMinRange),
      weaponMaxRange: getNumber(record.weaponMaxRange),
      stats: normalizeStats(record.stats),
    }
  })
}

function normalizeVitalityPanels(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((panel, index) => {
    const record = isRecord(panel) ? panel : {}

    return {
      id: getString(record.id, `vitality-panel-${index + 1}`),
      name: getString(record.name, `Vitality ${index + 2}`),
      stats: normalizeVitalityStats(record.stats),
    }
  })
}

function normalizeSpiritPanels(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((panel, index) => {
    const record = isRecord(panel) ? panel : {}

    return {
      id: getString(record.id, `spirit-panel-${index + 1}`),
      name: getString(record.name, `Spirit ${index + 2}`),
      topStats: normalizeStats(record.topStats),
      spiritPowerStat: normalizePanelStat(record.spiritPowerStat),
    }
  })
}

function normalizeHeroInfo(value: unknown): HeroInfoDefinition {
  const record = isRecord(value) ? value : {}

  return {
    nameType: record.nameType === 'text' ? 'text' : 'image',
    nameValue: getString(record.nameValue, DEFAULT_HERO_INFO.nameValue),
    nameColor: getString(record.nameColor, DEFAULT_HERO_INFO.nameColor),
    nameFontSize: getString(record.nameFontSize, DEFAULT_HERO_INFO.nameFontSize ?? DEFAULT_HERO_NAME_FONT_SIZE),
    nameFontFamily: getString(record.nameFontFamily, DEFAULT_HERO_INFO.nameFontFamily ?? DEFAULT_HERO_NAME_FONT_FAMILY),
    nameFontWeight: getString(record.nameFontWeight, DEFAULT_HERO_INFO.nameFontWeight ?? DEFAULT_HERO_NAME_FONT_WEIGHT),
    tag1Text: getString(record.tag1Text, DEFAULT_HERO_INFO.tag1Text),
    tag2Text: getString(record.tag2Text, DEFAULT_HERO_INFO.tag2Text),
    tag3Text: getString(record.tag3Text, DEFAULT_HERO_INFO.tag3Text),
    tagColor: getString(record.tagColor, DEFAULT_HERO_INFO.tagColor),
    tagTextColor: getString(record.tagTextColor, DEFAULT_HERO_INFO.tagTextColor),
    tag1Tilt: getNumber(record.tag1Tilt, DEFAULT_HERO_INFO.tag1Tilt),
    tag2Tilt: getNumber(record.tag2Tilt, DEFAULT_HERO_INFO.tag2Tilt),
    tag3Tilt: getNumber(record.tag3Tilt, DEFAULT_HERO_INFO.tag3Tilt),
    tag1OffsetY: getNumber(record.tag1OffsetY, DEFAULT_HERO_INFO.tag1OffsetY),
    tag2OffsetY: getNumber(record.tag2OffsetY, DEFAULT_HERO_INFO.tag2OffsetY),
    tag3OffsetY: getNumber(record.tag3OffsetY, DEFAULT_HERO_INFO.tag3OffsetY),
    ability1Icon: getString(record.ability1Icon),
    ability2Icon: getString(record.ability2Icon),
    ability3Icon: getString(record.ability3Icon),
    ability4Icon: getString(record.ability4Icon),
    abilityCircleColor: getString(record.abilityCircleColor, DEFAULT_HERO_INFO.abilityCircleColor),
    abilityIconColor: getString(record.abilityIconColor, DEFAULT_HERO_INFO.abilityIconColor),
    backstory: getString(record.backstory),
  }
}

function parseSavePayload(rawValue: unknown): CustomHeroSavePayload {
  const value = customHeroSaveSchema.parse(stripDatabaseMetadata(rawValue))
  const heroRecord = value.hero
  const boonRecord = value.boon
  const weaponRecord = value.weapon
  const vitalityRecord = value.vitality
  const spiritRecord = value.spirit
  const abilityStatsRecord = value.abilityStats
  const name = getString(value.name)
  const status = normalizeStatus(value.status)
  const allowCopies = value.allowCopies === true
  const portrait = getString(heroRecord.portrait)
  const render = getString(heroRecord.render)
  const background = getString(heroRecord.background, render || DEFAULT_BACKGROUND)
  const renderPosition = normalizeRenderPosition(heroRecord.renderPosition)
  const heroInfo = normalizeHeroInfo(value.heroInfo)
  const abilityStats = normalizeAbilityStats(abilityStatsRecord, {
    displayName: name,
    heroInfo,
  })

  if (!name) {
    throw new CustomHeroError('Hero name is required', 400)
  }

  if (status === 'published' && !portrait) {
    throw new CustomHeroError('Publishing requires a portrait', 400)
  }

  if (!render) {
    throw new CustomHeroError('Hero render is required', 400)
  }

  const missingAbilityIconMessages = getMissingAbilityIconSaveIssueMessages({ abilityStats })

  if (missingAbilityIconMessages.length) {
    throw new CustomHeroError(missingAbilityIconMessages.join(' '), 400)
  }

  return {
    id: getString(value.id) || null,
    name,
    status,
    hero: {
      portrait,
      render,
      background,
      renderPosition,
    },
    allowCopies,
    heroInfo,
    boon: {
      name: getString(boonRecord.name, 'Boon Rewards'),
      stats: normalizeBoonStats(boonRecord.stats),
      panels: normalizeBoonPanels(boonRecord.panels),
    },
    weapon: {
      weaponName: getString(weaponRecord.weaponName, `${name} Weapon`),
      weaponDesc: getString(weaponRecord.weaponDesc),
      gunImageSrc: getString(weaponRecord.gunImageSrc),
      weaponAttributes: getStringArray(weaponRecord.weaponAttributes),
      bulletDPS: getNumber(weaponRecord.bulletDPS),
      weaponMinRange: getNumber(weaponRecord.weaponMinRange),
      weaponMaxRange: getNumber(weaponRecord.weaponMaxRange),
      stats: normalizeStats(weaponRecord.stats),
      panels: normalizeWeaponPanels(weaponRecord.panels, {
        weaponDesc: getString(weaponRecord.weaponDesc),
        gunImageSrc: getString(weaponRecord.gunImageSrc),
        weaponAttributes: getStringArray(weaponRecord.weaponAttributes),
      }),
    },
    vitality: {
      name: getString(vitalityRecord.name, 'Vitality'),
      stats: normalizeVitalityStats(vitalityRecord.stats),
      panels: normalizeVitalityPanels(vitalityRecord.panels),
    },
    spirit: {
      name: getString(spiritRecord.name, 'Spirit'),
      topStats: normalizeStats(spiritRecord.topStats),
      spiritPowerStat: normalizePanelStat(spiritRecord.spiritPowerStat),
      panels: normalizeSpiritPanels(spiritRecord.panels),
    },
    abilityStats,
    interactions: normalizeInteractions(value.interactions),
  }
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'custom-hero'
}

async function getUniqueSlug(name: string) {
  const baseSlug = slugify(name)

  for (let index = 0; index < 25; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`
    const existing = await CustomHero.exists({ slug: candidate })

    if (!existing) {
      return candidate
    }
  }

  return `${baseSlug}-${new Types.ObjectId().toString().slice(-8)}`
}

async function getActor(): Promise<Actor> {
  const session = await auth()

  if (!session.userId) {
    throw new CustomHeroError('Authentication required', 401)
  }

  const claim = session.sessionClaims?.mongo_user_id
  const mongoUserId = typeof claim === 'string' && claim.length > 0 ? claim : null
  const ownerIds = [session.userId, mongoUserId].filter((value): value is string => Boolean(value))

  return {
    clerkId: session.userId,
    storageUserId: mongoUserId ?? session.userId,
    ownerIds,
  }
}

async function getOptionalActor(): Promise<Actor | null> {
  const session = await auth()

  if (!session.userId) {
    return null
  }

  const claim = session.sessionClaims?.mongo_user_id
  const mongoUserId = typeof claim === 'string' && claim.length > 0 ? claim : null
  const ownerIds = [session.userId, mongoUserId].filter((value): value is string => Boolean(value))

  return {
    clerkId: session.userId,
    storageUserId: mongoUserId ?? session.userId,
    ownerIds,
  }
}

function getValidObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new CustomHeroError('Hero not found', 404)
  }

  return new Types.ObjectId(id)
}

function serializeDate(value?: Date | null) {
  return value ? value.toISOString() : null
}

function serializeHeroInfo(heroInfo: HeroInfoRecord | null): HeroInfoDefinition {
  if (!heroInfo) {
    return DEFAULT_HERO_INFO
  }

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

function serializeSummary(
  hero: HeroRecord,
  heroInfo: HeroInfoRecord | null,
  actor: Actor | null = null,
  bookmarks: Set<string> | null = null,
  abilityStatsRecord: AbilityStatsRecord | null = null,
  creator?: CreatorProfileSummary,
): CustomHeroSummary {
  const likedBy = hero.likedBy ?? []
  const viewerCanEdit = Boolean(actor?.ownerIds.some(ownerId => ownerId === hero.createdByUserId))
  const likedByCurrentUser = Boolean(actor?.ownerIds.some(ownerId => likedBy.includes(ownerId)))
  const heroId = hero._id.toString()
  const heroInfoPayload = serializeHeroInfo(heroInfo)
  const abilityStats = abilityStatsRecord
    ? normalizeAbilityStats(abilityStatsRecord, {
      displayName: hero.name,
      heroInfo: heroInfoPayload,
    })
    : null

  return {
    id: heroId,
    creatorId: hero.createdByUserId,
    ...(creator ? { creator } : {}),
    slug: hero.slug,
    assetSlug: hero.slug,
    displayName: hero.name,
    portrait: hero.portrait,
    render: hero.render,
    background: hero.background || hero.render || DEFAULT_BACKGROUND,
    renderPosition: normalizeRenderPosition(hero.renderPosition),
    heroInfo: heroInfoPayload,
    status: hero.status,
    moderationStatus: hero.moderationStatus ?? 'clean',
    likesCount: hero.likesCount ?? likedBy.length,
    likedByCurrentUser,
    bookmarkedByCurrentUser: bookmarks?.has(heroId) ?? false,
    allowCopies: hero.allowCopies ?? false,
    viewerCanEdit,
    ...(abilityStats ? { abilityStats } : {}),
    publishedAt: serializeDate(hero.publishedAt),
    createdAt: hero.createdAt.toISOString(),
    updatedAt: hero.updatedAt.toISOString(),
  }
}

function serializeDetail(bundle: HeroBundle, actor: Actor | null = null): CustomHeroDetail {
  const summary = serializeSummary(bundle.hero, bundle.heroInfo, actor)
  const abilityStats = normalizeAbilityStats(bundle.abilityStats, {
    displayName: summary.displayName,
    heroInfo: summary.heroInfo,
  })
  const stats: HeroStatsPayload = {
    hero: {
      slug: summary.slug,
      name: summary.displayName,
      portrait: summary.portrait,
      render: summary.render,
    },
    heroInfo: summary.heroInfo,
    boon: {
      name: bundle.boon?.name ?? 'Boon Rewards',
      stats: normalizeBoonStats(bundle.boon?.stats),
      panels: normalizeBoonPanels(bundle.boon?.panels),
    },
    weapon: {
      weaponName: bundle.weapon?.weaponName ?? `${summary.displayName} Weapon`,
      weaponDesc: bundle.weapon?.weaponDesc ?? '',
      gunImageSrc: bundle.weapon?.gunImageSrc ?? '',
      weaponAttributes: bundle.weapon?.weaponAttributes ?? [],
      bulletDPS: bundle.weapon?.bulletDPS ?? 0,
      weaponMinRange: bundle.weapon?.weaponMinRange ?? 0,
      weaponMaxRange: bundle.weapon?.weaponMaxRange ?? 0,
      stats: normalizeStats(bundle.weapon?.stats),
      panels: normalizeWeaponPanels(bundle.weapon?.panels, {
        weaponDesc: bundle.weapon?.weaponDesc ?? '',
        gunImageSrc: bundle.weapon?.gunImageSrc ?? '',
        weaponAttributes: bundle.weapon?.weaponAttributes ?? [],
      }),
    },
    vitality: {
      name: bundle.vitality?.name ?? 'Vitality',
      stats: normalizeVitalityStats(bundle.vitality?.stats),
      panels: normalizeVitalityPanels(bundle.vitality?.panels),
    },
    spirit: {
      name: bundle.spirit?.name ?? 'Spirit',
      topStats: normalizeStats(bundle.spirit?.topStats),
      spiritPowerStat: bundle.spirit?.spiritPowerStat ? normalizePanelStat(bundle.spirit.spiritPowerStat) : {
        label: 'Spirit Power',
        value: '0',
        unit: '',
        icon: 'spiritPower',
        scaling: 'none',
        scalingValue: '0',
      },
      panels: normalizeSpiritPanels(bundle.spirit?.panels),
    },
  }

  return {
    ...summary,
    stats,
    abilityStats,
    interactions: normalizeInteractions(
      bundle.hero.interactions?.map(interaction => ({
        id: interaction.id,
        targetHeroId: interaction.targetHeroId,
        targetHeroName: interaction.targetHeroName,
        targetHeroPortrait: interaction.targetHeroPortrait,
        title: interaction.title,
        lines: interaction.lines.map(line => ({
          id: line.id,
          speakerSide: line.speakerSide,
          speakerHeroId: line.speakerHeroId,
          text: line.text,
          order: line.order,
        })),
        createdAt: interaction.createdAt instanceof Date ? interaction.createdAt.toISOString() : String(interaction.createdAt),
        updatedAt: interaction.updatedAt instanceof Date ? interaction.updatedAt.toISOString() : String(interaction.updatedAt),
      })),
      summary.id,
    ),
  }
}

function uniqueObjectIds(values: Types.ObjectId[]) {
  const seen = new Set<string>()

  return values.filter(value => {
    const id = value.toString()

    if (seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

async function getTextSearchHeroIds(search: string) {
  const trimmedSearch = search.trim()

  if (!trimmedSearch) {
    return []
  }

  try {
    const [heroMatches, heroInfoMatches] = await Promise.all([
      CustomHero.find({ $text: { $search: trimmedSearch } }).select('_id').limit(500).lean<Array<{ _id: Types.ObjectId }>>(),
      HeroInfo.find({ $text: { $search: trimmedSearch } }).select('heroId').limit(500).lean<Array<{ heroId: Types.ObjectId }>>(),
    ])

    return uniqueObjectIds([
      ...heroMatches.map(hero => hero._id),
      ...heroInfoMatches.map(heroInfo => heroInfo.heroId),
    ])
  } catch {
    return []
  }
}

function getLookupStage(from: string, as: string): PipelineStage.Lookup {
  return {
    $lookup: {
      from,
      localField: '_id',
      foreignField: 'heroId',
      as,
    },
  }
}

function getUnwindStage(path: string): PipelineStage.Unwind {
  return {
    $unwind: {
      path,
      preserveNullAndEmptyArrays: true,
    },
  }
}

function getSortStage(sort: CustomHeroSort): PipelineStage.Sort['$sort'] {
  if (sort === 'liked') {
    return { likesCount: -1, publishedAt: -1, updatedAt: -1, _id: -1 }
  }

  if (sort === 'trending') {
    return { trendingScore: -1, publishedAt: -1, updatedAt: -1, _id: -1 }
  }

  return { publishedAt: -1, updatedAt: -1, _id: -1 }
}

async function buildHeroListPipeline(filters: CustomHeroListFilters): Promise<PipelineStage[]> {
  const trimmedSearch = filters.search.trim()
  const searchHeroIds = await getTextSearchHeroIds(trimmedSearch)

  const pipeline: PipelineStage[] = [
    { $match: { status: filters.status, moderationStatus: { $ne: 'hidden' } } },
    getLookupStage(HeroInfo.collection.name, 'heroInfo'),
    getUnwindStage('$heroInfo'),
    getLookupStage(AbilityStats.collection.name, 'abilityStats'),
    getUnwindStage('$abilityStats'),
    {
      $addFields: {
        recentLikeEvents: {
          $filter: {
            input: { $ifNull: ['$likeEvents', []] },
            as: 'event',
            cond: { $gte: ['$$event.createdAt', new Date(Date.now() - TRENDING_WINDOW_MS)] },
          },
        },
        recentCopyEvents: {
          $filter: {
            input: { $ifNull: ['$copyEvents', []] },
            as: 'event',
            cond: { $gte: ['$$event.createdAt', new Date(Date.now() - TRENDING_WINDOW_MS)] },
          },
        },
      },
    },
    {
      $addFields: {
        trendingScore: { $add: [{ $multiply: [{ $size: '$recentLikeEvents' }, 3] }, { $multiply: [{ $size: '$recentCopyEvents' }, 2] }] },
      },
    },
  ]

  if (trimmedSearch) {
    const escapedSearch = escapeRegExp(trimmedSearch)
    const searchConditions: PipelineStage.Match['$match'][] = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { 'heroInfo.backstory': { $regex: escapedSearch, $options: 'i' } },
    ]

    if (searchHeroIds.length) {
      searchConditions.push({ _id: { $in: searchHeroIds } })
    }

    pipeline.push({ $match: { $or: searchConditions } })
  }

  return pipeline
}

async function getHeroInfoMap(heroIds: Types.ObjectId[]) {
  const heroInfos = await HeroInfo.find({ heroId: { $in: heroIds } }).lean<HeroInfoRecord[]>()

  return new Map(heroInfos.map(heroInfo => [heroInfo.heroId.toString(), heroInfo]))
}

async function getAbilityStatsMap(heroIds: Types.ObjectId[]) {
  const abilityStatsRecords = await AbilityStats.find({ heroId: { $in: heroIds } }).lean<Array<AbilityStatsRecord & { heroId: Types.ObjectId }>>()

  return new Map(abilityStatsRecords.map(abilityStats => [abilityStats.heroId.toString(), abilityStats]))
}

async function getCreatorAvatarMap(users: CreatorUserRecord[]) {
  const storedAvatarMap = new Map(users
    .filter(user => Boolean(user.profileImageUrl))
    .map(user => [user.clerkId, user.profileImageUrl as string]))

  if (!users.length) return storedAvatarMap

  try {
    const client = await clerkClient()
    const response = await client.users.getUserList({
      userId: users.map(user => user.clerkId),
      limit: users.length,
    })
    const liveAvatarMap = new Map(response.data
      .filter(user => Boolean(user.imageUrl))
      .map(user => [user.id, user.imageUrl]))

    return new Map([...storedAvatarMap, ...liveAvatarMap])
  } catch {
    return storedAvatarMap
  }
}

async function getCreatorProfileMap(heroes: HeroRecord[]) {
  const creatorIds = [...new Set(heroes.map(hero => hero.createdByUserId).filter(Boolean))]

  if (!creatorIds.length) return new Map<string, CreatorProfileSummary>()

  const creatorObjectIds = creatorIds
    .filter(creatorId => Types.ObjectId.isValid(creatorId))
    .map(creatorId => new Types.ObjectId(creatorId))
  const users = await User.find({
    $or: [
      { clerkId: { $in: creatorIds } },
      ...(creatorObjectIds.length ? [{ _id: { $in: creatorObjectIds } }] : []),
    ],
  }).select('_id clerkId email username profileImageUrl preferredHero').lean<CreatorUserRecord[]>()
  const ownerAliases = [...new Set(users.flatMap(user => [user.clerkId, user._id.toString()]))]

  if (!ownerAliases.length) return new Map<string, CreatorProfileSummary>()

  const [heroCounts, heroInfoCounts, avatarMap] = await Promise.all([
    CustomHero.aggregate<CreatorContributionCount>([
      { $match: { createdByUserId: { $in: ownerAliases } } },
      { $group: { _id: '$createdByUserId', count: { $sum: 1 } } },
    ]),
    HeroInfo.aggregate<CreatorContributionCount>([
      { $match: { createdByUserId: { $in: ownerAliases } } },
      { $group: { _id: '$createdByUserId', count: { $sum: 1 } } },
    ]),
    getCreatorAvatarMap(users),
  ])
  const heroCountMap = new Map(heroCounts.map(item => [item._id, item.count]))
  const heroInfoCountMap = new Map(heroInfoCounts.map(item => [item._id, item.count]))
  const creatorProfileMap = new Map<string, CreatorProfileSummary>()

  for (const user of users) {
    const aliases = [user.clerkId, user._id.toString()]
    const contributionCount = aliases.reduce((total, ownerId) => (
      total + (heroCountMap.get(ownerId) ?? 0) + (heroInfoCountMap.get(ownerId) ?? 0)
    ), 0)
    const registeredUsername = user.username?.trim()
    const username = registeredUsername || user.email.split('@')[0] || user.clerkId
    const avatarUrl = avatarMap.get(user.clerkId)
    const creator: CreatorProfileSummary = {
      userId: user.clerkId,
      username,
      profileSlug: registeredUsername || user.clerkId,
      ...(avatarUrl ? { avatarUrl } : {}),
      level: getUserLevel(contributionCount).label,
      preferredHero: user.preferredHero || 'abrams',
    }

    for (const ownerId of aliases) {
      creatorProfileMap.set(ownerId, creator)
    }
  }

  return creatorProfileMap
}

async function getActorBookmarkSet(actor: Actor | null) {
  if (!actor) {
    return null
  }

  const user = await User.findOne({ clerkId: actor.clerkId }).select('bookmarks').lean<{ bookmarks?: Types.ObjectId[] } | null>()

  return new Set((user?.bookmarks ?? []).map(bookmark => bookmark.toString()))
}

async function getHeroBundle(hero: HeroRecord): Promise<HeroBundle> {
  const [heroInfo, boon, weapon, vitality, spirit, abilityStats] = await Promise.all([
    HeroInfo.findOne({ heroId: hero._id }).lean<HeroInfoRecord | null>(),
    BoonStats.findOne({ heroId: hero._id }).lean<BoonStatsRecord | null>(),
    WeaponStats.findOne({ heroId: hero._id }).lean<WeaponStatsRecord | null>(),
    VitalityStats.findOne({ heroId: hero._id }).lean<VitalityStatsRecord | null>(),
    SpiritStats.findOne({ heroId: hero._id }).lean<SpiritStatsRecord | null>(),
    AbilityStats.findOne({ heroId: hero._id }).lean<AbilityStatsRecord | null>(),
  ])

  return {
    hero,
    heroInfo,
    boon,
    weapon,
    vitality,
    spirit,
    abilityStats,
  }
}

export async function listCustomHeroPage(filters: CustomHeroListFilters): Promise<CustomHeroListResult> {
  const actor = await getOptionalActor()

  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return {
        heroes: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
          hasMore: false,
        },
      }
    }

    throw error
  }

  try {
    const pipeline = await buildHeroListPipeline(filters)
    const totalResult = await CustomHero.aggregate<{ total: number }>([
      ...pipeline,
      { $count: 'total' },
    ])
    const total = totalResult[0]?.total ?? 0
    const heroes = await CustomHero.aggregate<HeroAggregateRecord>([
      ...pipeline,
      { $sort: getSortStage(filters.sort) },
      { $skip: filters.offset },
      { $limit: filters.limit },
    ])
    const [bookmarks, abilityStatsById, creatorProfiles] = await Promise.all([
      getActorBookmarkSet(actor),
      getAbilityStatsMap(heroes.map(hero => hero._id)),
      getCreatorProfileMap(heroes),
    ])
    const summaries = heroes.map(hero => serializeSummary(
      hero,
      hero.heroInfo ?? null,
      actor,
      bookmarks,
      hero.abilityStats ?? abilityStatsById.get(hero._id.toString()) ?? null,
      creatorProfiles.get(hero.createdByUserId),
    ))

    return {
      heroes: summaries,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total,
        hasMore: filters.offset + summaries.length < total,
      },
    }
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return {
        heroes: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
          hasMore: false,
        },
      }
    }

    throw error
  }
}

export async function listCustomHeroes(status: CustomHeroStatus, sort: CustomHeroSort, search = ''): Promise<CustomHeroSummary[]> {
  const result = await listCustomHeroPage({
    status,
    sort,
    search,
    limit: 40,
    offset: 0,
  })

  return result.heroes
}

export async function listBookmarkedCustomHeroPage(filters: Pick<CustomHeroListFilters, 'search' | 'limit' | 'offset'>): Promise<CustomHeroListResult> {
  const actor = await getActor()

  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return {
        heroes: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
          hasMore: false,
        },
      }
    }

    throw error
  }

  try {
    const user = await User.findOne({ clerkId: actor.clerkId }).select('bookmarks').lean<{ bookmarks?: Types.ObjectId[] } | null>()
    const bookmarkedIds = uniqueObjectIds(user?.bookmarks ?? [])

    if (!bookmarkedIds.length) {
      return {
        heroes: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
          hasMore: false,
        },
      }
    }

    const pipeline = await buildHeroListPipeline({
      status: 'published',
      sort: 'new',
      search: filters.search,
      limit: filters.limit,
      offset: filters.offset,
    })
    pipeline.push({ $match: { _id: { $in: bookmarkedIds } } })

    const totalResult = await CustomHero.aggregate<{ total: number }>([
      ...pipeline,
      { $count: 'total' },
    ])
    const total = totalResult[0]?.total ?? 0
    const heroes = await CustomHero.aggregate<HeroAggregateRecord>([
      ...pipeline,
      { $sort: { updatedAt: -1, _id: -1 } },
      { $skip: filters.offset },
      { $limit: filters.limit },
    ])
    const bookmarks = new Set(bookmarkedIds.map(heroId => heroId.toString()))
    const [abilityStatsById, creatorProfiles] = await Promise.all([
      getAbilityStatsMap(heroes.map(hero => hero._id)),
      getCreatorProfileMap(heroes),
    ])
    const summaries = heroes.map(hero => serializeSummary(
      hero,
      hero.heroInfo ?? null,
      actor,
      bookmarks,
      hero.abilityStats ?? abilityStatsById.get(hero._id.toString()) ?? null,
      creatorProfiles.get(hero.createdByUserId),
    ))

    return {
      heroes: summaries,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total,
        hasMore: filters.offset + summaries.length < total,
      },
    }
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return {
        heroes: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
          hasMore: false,
        },
      }
    }

    throw error
  }
}

export async function getEditableCustomHero(id: string): Promise<CustomHeroDetail> {
  const actor = await getActor()

  await dbConnect()

  const objectId = getValidObjectId(id)
  const hero = await CustomHero.findOne({
    _id: objectId,
    $or: [
      { status: 'published', moderationStatus: { $ne: 'hidden' } },
      { createdByUserId: { $in: actor.ownerIds } },
    ],
  }).lean<HeroRecord | null>()

  if (!hero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  return serializeDetail(await getHeroBundle(hero), actor)
}

export async function deleteCustomHero(id: string) {
  const actor = await getActor()
  enforceRateLimit({
    key: `custom-hero-delete:user:${actor.storageUserId}`,
    limit: 10,
    windowMs: 60 * 1000,
  })

  await dbConnect()
  await assertUserNotSuspended(actor.clerkId)

  const objectId = getValidObjectId(id)
  const hero = await CustomHero.findOne({
    _id: objectId,
    createdByUserId: { $in: actor.ownerIds },
  }).select('_id').lean<{ _id: Types.ObjectId } | null>()

  if (!hero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  await Promise.all([
    CustomHero.deleteOne({ _id: objectId }),
    HeroInfo.deleteMany({ heroId: objectId }),
    BoonStats.deleteMany({ heroId: objectId }),
    WeaponStats.deleteMany({ heroId: objectId }),
    VitalityStats.deleteMany({ heroId: objectId }),
    SpiritStats.deleteMany({ heroId: objectId }),
    AbilityStats.deleteMany({ heroId: objectId }),
    Comment.deleteMany({ heroId: objectId }),
    Like.deleteMany({ heroId: objectId }),
    Notification.deleteMany({ $or: [{ targetId: objectId }, { relatedHeroId: objectId }] }),
    User.updateMany({}, { $pull: { bookmarks: objectId } }),
    User.updateMany({ profileBackground: `custom:${objectId.toString()}` }, { $set: { profileBackground: null } }),
  ])

  return { id: objectId.toString(), deleted: true as const }
}

export async function deleteCustomHeroes(value: unknown) {
  const actor = await getActor()
  enforceRateLimit({
    key: `custom-hero-bulk-delete:user:${actor.storageUserId}`,
    limit: 3,
    windowMs: 60 * 1000,
  })

  if (typeof value !== 'object' || value === null || !('ids' in value) || !Array.isArray(value.ids)) {
    throw new CustomHeroError('Character ids are required', 400)
  }

  if (!value.ids.length || value.ids.some(id => typeof id !== 'string' || !id.length)) {
    throw new CustomHeroError('Select at least one character', 400)
  }

  const heroIds = [...new Set(value.ids as string[])]

  const objectIds = heroIds.map(getValidObjectId)

  await dbConnect()
  await assertUserNotSuspended(actor.clerkId)

  const ownedHeroes = await CustomHero.find({
    _id: { $in: objectIds },
    createdByUserId: { $in: actor.ownerIds },
  }).select('_id').lean<Array<{ _id: Types.ObjectId }>>()

  if (ownedHeroes.length !== objectIds.length) {
    throw new CustomHeroError('One or more heroes could not be deleted', 404)
  }

  const ownedHeroIds = ownedHeroes.map(hero => hero._id)
  const ownedHeroIdStrings = ownedHeroIds.map(heroId => heroId.toString())

  await Promise.all([
    CustomHero.deleteMany({ _id: { $in: ownedHeroIds } }),
    HeroInfo.deleteMany({ heroId: { $in: ownedHeroIds } }),
    BoonStats.deleteMany({ heroId: { $in: ownedHeroIds } }),
    WeaponStats.deleteMany({ heroId: { $in: ownedHeroIds } }),
    VitalityStats.deleteMany({ heroId: { $in: ownedHeroIds } }),
    SpiritStats.deleteMany({ heroId: { $in: ownedHeroIds } }),
    AbilityStats.deleteMany({ heroId: { $in: ownedHeroIds } }),
    Comment.deleteMany({ heroId: { $in: ownedHeroIds } }),
    Like.deleteMany({ heroId: { $in: ownedHeroIds } }),
    Notification.deleteMany({
      $or: [
        { targetId: { $in: ownedHeroIds } },
        { relatedHeroId: { $in: ownedHeroIds } },
      ],
    }),
    User.updateMany({}, { $pull: { bookmarks: { $in: ownedHeroIds } } }),
    User.updateMany(
      { profileBackground: { $in: ownedHeroIdStrings.map(heroId => `custom:${heroId}`) } },
      { $set: { profileBackground: null } },
    ),
  ])

  return {
    ids: ownedHeroIdStrings,
    deletedCount: ownedHeroIdStrings.length,
  }
}

export async function getPublishedCustomHero(id: string): Promise<CustomHeroDetail> {
  const actor = await getOptionalActor()

  await dbConnect()

  const objectId = getValidObjectId(id)
  const hero = await CustomHero.findOne({
    _id: objectId,
    $or: [
      { status: 'published', moderationStatus: { $ne: 'hidden' } },
      ...(actor ? [{ createdByUserId: { $in: actor.ownerIds } }] : []),
    ],
  }).lean<HeroRecord | null>()

  if (!hero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  return serializeDetail(await getHeroBundle(hero), actor)
}

export async function listCustomHeroesForOwner(ownerIds: string[]): Promise<CustomHeroSummary[]> {
  const actor = await getOptionalActor()

  await dbConnect()

  const viewerOwnsProfile = Boolean(actor?.ownerIds.some(ownerId => ownerIds.includes(ownerId)))
  const heroes = await CustomHero.find({
    createdByUserId: { $in: ownerIds },
    ...(viewerOwnsProfile ? {} : { moderationStatus: { $ne: 'hidden' } }),
  })
    .sort({ updatedAt: -1 })
    .lean<HeroRecord[]>()
  const heroInfoById = await getHeroInfoMap(heroes.map(hero => hero._id))
  const abilityStatsById = await getAbilityStatsMap(heroes.map(hero => hero._id))
  const bookmarks = await getActorBookmarkSet(actor)

  return heroes.map(hero => serializeSummary(hero, heroInfoById.get(hero._id.toString()) ?? null, actor, bookmarks, abilityStatsById.get(hero._id.toString()) ?? null))
}

export async function listCurrentUserCustomHeroes(): Promise<CustomHeroSummary[]> {
  const actor = await getActor()

  await dbConnect()

  const heroes = await CustomHero.find({
    createdByUserId: { $in: actor.ownerIds },
  })
    .sort({ createdAt: 1 })
    .lean<HeroRecord[]>()
  const heroInfoById = await getHeroInfoMap(heroes.map(hero => hero._id))
  const abilityStatsById = await getAbilityStatsMap(heroes.map(hero => hero._id))
  const bookmarks = await getActorBookmarkSet(actor)

  return heroes.map(hero => serializeSummary(hero, heroInfoById.get(hero._id.toString()) ?? null, actor, bookmarks, abilityStatsById.get(hero._id.toString()) ?? null))
}

export async function listPrivateCustomHeroesForOwner(ownerIds: string[]): Promise<CustomHeroSummary[]> {
  const heroes = await listCustomHeroesForOwner(ownerIds)

  return heroes.filter(hero => hero.status === 'private')
}

export async function listBookmarkedCustomHeroes(heroIds: Types.ObjectId[], ownerIds: string[]): Promise<CustomHeroSummary[]> {
  await dbConnect()

  if (!heroIds.length) {
    return []
  }

  const heroes = await CustomHero.find({ _id: { $in: heroIds }, status: 'published', moderationStatus: { $ne: 'hidden' } })
    .sort({ updatedAt: -1 })
    .lean<HeroRecord[]>()
  const heroInfoById = await getHeroInfoMap(heroes.map(hero => hero._id))
  const abilityStatsById = await getAbilityStatsMap(heroes.map(hero => hero._id))
  const actor = {
    clerkId: ownerIds[0],
    storageUserId: ownerIds[0],
    ownerIds,
  }
  const bookmarks = new Set(heroIds.map(heroId => heroId.toString()))

  return heroes.map(hero => serializeSummary(hero, heroInfoById.get(hero._id.toString()) ?? null, actor, bookmarks, abilityStatsById.get(hero._id.toString()) ?? null))
}

export async function saveCustomHero(value: unknown): Promise<CustomHeroDetail> {
  const actor = await getActor()
  enforceRateLimit({
    key: `custom-hero-save:user:${actor.storageUserId}`,
    limit: 20,
    windowMs: 60 * 1000,
  })
  const payload = parseSavePayload(value)
  const isPublishing = payload.status === 'published'

  await dbConnect()
  await assertUserNotSuspended(actor.clerkId)

  const existingHero = payload.id
    ? await CustomHero.findOne({ _id: getValidObjectId(payload.id), createdByUserId: { $in: actor.ownerIds } }).lean<HeroRecord | null>()
    : null

  if (payload.id && !existingHero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  const publishedAt = isPublishing ? existingHero?.publishedAt ?? new Date() : null
  const shouldNotifyPublish = isPublishing && existingHero?.status !== 'published'
  const heroId = existingHero?._id ?? new Types.ObjectId()
  const slug = existingHero?.slug ?? await getUniqueSlug(payload.name)
  const customInteractionTargets = await getOwnedCustomInteractionTargets(
    payload.interactions,
    actor,
    heroId.toString(),
  )
  const hero = await CustomHero.findOneAndUpdate(
    { _id: heroId },
    {
      $set: {
        name: payload.name,
        slug,
        portrait: payload.hero.portrait,
        render: payload.hero.render,
        background: payload.hero.background,
        'renderPosition.x': payload.hero.renderPosition?.x ?? 0,
        'renderPosition.y': payload.hero.renderPosition?.y ?? 0,
        createdByUserId: existingHero?.createdByUserId ?? actor.storageUserId,
        status: payload.status,
        allowCopies: payload.allowCopies,
        publishedAt,
        interactions: normalizeInteractions(
          payload.interactions,
          heroId.toString(),
          customInteractionTargets,
          true,
        ),
      },
      $setOnInsert: {
        likesCount: 0,
        likedBy: [],
        likeEvents: [],
        copyEvents: [],
        reports: [],
        moderationStatus: 'clean',
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean<HeroRecord | null>()

  if (!hero) {
    throw new CustomHeroError('Failed to save hero', 500)
  }

  const abilityStatsUpdate = {
    $set: {
      heroId: hero._id,
      abilities: payload.abilityStats.abilities,
      ...(payload.abilityStats.secondaryAbilities ? {
        secondaryAbilities: payload.abilityStats.secondaryAbilities,
        secondaryAbilitySlots: payload.abilityStats.secondaryAbilitySlots,
      } : {}),
    },
    $unset: payload.abilityStats.secondaryAbilities
      ? {
          secondaryAbilityAnchorIndex: '',
        }
      : {
          secondaryAbilities: '',
          secondaryAbilitySlots: '',
          secondaryAbilityAnchorIndex: '',
        },
  }

  await Promise.all([
    HeroInfo.findOneAndUpdate(
      { heroId: hero._id },
      {
        ...payload.heroInfo,
        heroId: hero._id,
        createdByUserId: hero.createdByUserId,
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ),
    BoonStats.findOneAndUpdate(
      { heroId: hero._id },
      { ...payload.boon, heroId: hero._id },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ),
    WeaponStats.findOneAndUpdate(
      { heroId: hero._id },
      {
        ...payload.weapon,
        heroId: hero._id,
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ),
    VitalityStats.findOneAndUpdate(
      { heroId: hero._id },
      {
        ...payload.vitality,
        heroId: hero._id,
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ),
    SpiritStats.findOneAndUpdate(
      { heroId: hero._id },
      {
        ...payload.spirit,
        heroId: hero._id,
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ),
    AbilityStats.findOneAndUpdate(
      { heroId: hero._id },
      abilityStatsUpdate,
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ),
  ])

  if (shouldNotifyPublish) {
    const followers = await Follow.find({ followingId: actor.clerkId }).select('followerId').lean<{ followerId: string }[]>()

    await Promise.all(followers.map(follower => createNotification({
      recipientId: follower.followerId,
      actorId: actor.clerkId,
      type: 'publish',
      targetId: hero._id,
      relatedHeroId: hero._id,
    })))
  }

  return serializeDetail(await getHeroBundle(hero), actor)
}

export async function likeCustomHero(id: string): Promise<CustomHeroSummary> {
  const actor = await getActor()

  await dbConnect()

  const objectId = getValidObjectId(id)
  const existingHero = await CustomHero.findOne({ _id: objectId, status: 'published', moderationStatus: { $ne: 'hidden' } }).lean<HeroRecord | null>()

  if (!existingHero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  const existingLikedBy = existingHero.likedBy ?? []
  const isLiked = actor.ownerIds.some(ownerId => existingLikedBy.includes(ownerId))
  const nextLikedBy = isLiked
    ? existingLikedBy.filter(ownerId => !actor.ownerIds.includes(ownerId))
    : [...existingLikedBy, actor.storageUserId]
  const engagementUpdate = isLiked
    ? {
        $pull: {
          likeEvents: { userId: { $in: actor.ownerIds } },
        },
      }
    : {
        $push: {
          likeEvents: {
            userId: actor.storageUserId,
            createdAt: new Date(),
          },
        },
      }
  const hero = await CustomHero.findOneAndUpdate(
    { _id: objectId, status: 'published', moderationStatus: { $ne: 'hidden' } },
    {
      $set: {
        likedBy: nextLikedBy,
        likesCount: nextLikedBy.length,
      },
      ...engagementUpdate,
    },
    { returnDocument: 'after', runValidators: true },
  ).lean<HeroRecord | null>()

  if (!hero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  if (isLiked) {
    await Like.deleteMany({ heroId: objectId, userId: { $in: actor.ownerIds } })
  } else {
    await Like.findOneAndUpdate(
      { heroId: objectId, userId: actor.clerkId },
      {
        $setOnInsert: {
          heroId: objectId,
          userId: actor.clerkId,
        },
      },
      { upsert: true, runValidators: true },
    )
    const recipientId = await resolveRecipientClerkId(hero.createdByUserId)

    if (recipientId) {
      await createNotification({
        recipientId,
        actorId: actor.clerkId,
        type: 'like',
        targetId: hero._id,
        relatedHeroId: hero._id,
      })
    }
  }

  const [heroInfo, abilityStats, creatorProfiles] = await Promise.all([
    HeroInfo.findOne({ heroId: hero._id }).lean<HeroInfoRecord | null>(),
    AbilityStats.findOne({ heroId: hero._id }).lean<AbilityStatsRecord | null>(),
    getCreatorProfileMap([hero]),
  ])

  return serializeSummary(hero, heroInfo, actor, null, abilityStats, creatorProfiles.get(hero.createdByUserId))
}

export async function recordCustomHeroCopy(id: string): Promise<void> {
  const actor = await getActor()

  await dbConnect()

  const objectId = getValidObjectId(id)
  const hero = await CustomHero.findOneAndUpdate(
    { _id: objectId, status: 'published', allowCopies: true, moderationStatus: { $ne: 'hidden' } },
    {
      $push: {
        copyEvents: {
          userId: actor.storageUserId,
          createdAt: new Date(),
        },
      },
    },
    { runValidators: true },
  ).select('_id').lean<{ _id: Types.ObjectId } | null>()

  if (!hero) {
    throw new CustomHeroError('Hero not found', 404)
  }
}
