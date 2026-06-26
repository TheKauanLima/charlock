import 'server-only'

import { auth } from '@clerk/nextjs/server'
import { Types } from 'mongoose'

import { ApiRequestError } from '@/lib/api-errors'
import dbConnect, { isDatabaseConnectionError } from '@/lib/dbConnect'
import CustomHero from '@/lib/models/CustomHero'
import type { ICustomHero } from '@/lib/models/CustomHero'
import HeroInfo from '@/lib/models/HeroInfo'
import Notification from '@/lib/models/Notification'
import type { INotification, NotificationType } from '@/lib/models/Notification'
import User from '@/lib/models/User'

interface Actor {
  clerkId: string
  ownerIds: string[]
}

interface UserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
}

interface HeroRecord extends ICustomHero {
  _id: Types.ObjectId
}

interface HeroInfoRecord {
  heroId: Types.ObjectId
  tagColor: string
}

interface NotificationRecord extends INotification {
  _id: Types.ObjectId
}

export interface NotificationListFilters {
  unreadOnly?: boolean
  type?: NotificationType
  limit?: number
}

export interface NotificationCreateInput {
  recipientId: string
  actorId: string
  type: NotificationType
  targetId: Types.ObjectId
  relatedHeroId?: Types.ObjectId
}

export interface ProfileNotificationItem {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  relativeTime: string
  actorId: string
  actorName: string
  actorInitials: string
  action: string
  targetId: string
  relatedHeroId: string | null
  heroName: string | null
  heroAccent: string
  href: string
}

export interface NotificationListResult {
  hasNotifications: boolean
  count: number
  items: ProfileNotificationItem[]
}

const DEFAULT_HERO_ACCENT = '#d4af37'

async function getActor(): Promise<Actor> {
  const session = await auth()

  if (!session.userId) {
    throw new ApiRequestError('Authentication required', 401)
  }

  const claim = session.sessionClaims?.mongo_user_id
  const mongoUserId = typeof claim === 'string' && claim.length > 0 ? claim : null

  return {
    clerkId: session.userId,
    ownerIds: [session.userId, mongoUserId].filter((value): value is string => Boolean(value)),
  }
}

async function getOptionalActor(): Promise<Actor | null> {
  const session = await auth()

  if (!session.userId) {
    return null
  }

  const claim = session.sessionClaims?.mongo_user_id
  const mongoUserId = typeof claim === 'string' && claim.length > 0 ? claim : null

  return {
    clerkId: session.userId,
    ownerIds: [session.userId, mongoUserId].filter((value): value is string => Boolean(value)),
  }
}

function getDisplayName(user: UserRecord | undefined, fallbackId: string) {
  if (!user) {
    return fallbackId
  }

  return user.username?.trim() || user.email.split('@')[0] || user.clerkId
}

function getInitials(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C'
}

function getRelativeTime(value: Date) {
  const diffMs = Date.now() - value.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) {
    return 'now'
  }

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))}m ago`
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`
  }

  return `${Math.floor(diffMs / day)}d ago`
}

async function getUserMap(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))

  if (!uniqueIds.length) {
    return new Map<string, UserRecord>()
  }

  const users = await User.find({ clerkId: { $in: uniqueIds } }).lean<UserRecord[]>()

  return new Map(users.map(user => [user.clerkId, user]))
}

async function getHeroMap(heroIds: Types.ObjectId[]) {
  if (!heroIds.length) {
    return new Map<string, HeroRecord>()
  }

  const heroes = await CustomHero.find({ _id: { $in: heroIds } }).lean<HeroRecord[]>()

  return new Map(heroes.map(hero => [hero._id.toString(), hero]))
}

async function getHeroInfoMap(heroIds: Types.ObjectId[]) {
  if (!heroIds.length) {
    return new Map<string, HeroInfoRecord>()
  }

  const heroInfoRecords = await HeroInfo.find({ heroId: { $in: heroIds } })
    .select('heroId tagColor')
    .lean<HeroInfoRecord[]>()

  return new Map(heroInfoRecords.map(heroInfo => [heroInfo.heroId.toString(), heroInfo]))
}

function buildNotificationHref(notification: NotificationRecord, actorUser: UserRecord | undefined) {
  const heroId = notification.relatedHeroId?.toString()

  if (notification.type === 'follow') {
    const profileSegment = actorUser?.username || actorUser?.clerkId || notification.actorId

    return `/profile/${encodeURIComponent(profileSegment)}`
  }

  if (heroId) {
    return `/?tab=browse&heroId=${encodeURIComponent(heroId)}${notification.type === 'comment' ? `#comment-${notification.targetId.toString()}` : ''}`
  }

  return '/'
}

function getNotificationAction(notification: NotificationRecord, heroName: string | null) {
  if (notification.type === 'comment') {
    return `commented on ${heroName ?? 'your character'}`
  }

  if (notification.type === 'like') {
    return `liked ${heroName ?? 'your character'}`
  }

  if (notification.type === 'follow') {
    return 'followed you'
  }

  return `published ${heroName ?? 'a character'}`
}

function serializeNotification(
  notification: NotificationRecord,
  usersByClerkId: Map<string, UserRecord>,
  heroesById: Map<string, HeroRecord>,
  heroInfoById: Map<string, HeroInfoRecord>,
): ProfileNotificationItem {
  const actorUser = usersByClerkId.get(notification.actorId)
  const actorName = getDisplayName(actorUser, notification.actorId)
  const hero = notification.relatedHeroId ? heroesById.get(notification.relatedHeroId.toString()) : undefined
  const heroInfo = notification.relatedHeroId ? heroInfoById.get(notification.relatedHeroId.toString()) : undefined
  const heroName = hero?.name ?? null

  return {
    id: notification._id.toString(),
    type: notification.type,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
    relativeTime: getRelativeTime(notification.createdAt),
    actorId: notification.actorId,
    actorName,
    actorInitials: getInitials(actorName),
    action: getNotificationAction(notification, heroName),
    targetId: notification.targetId.toString(),
    relatedHeroId: notification.relatedHeroId?.toString() ?? null,
    heroName,
    heroAccent: heroInfo?.tagColor ?? DEFAULT_HERO_ACCENT,
    href: buildNotificationHref(notification, actorUser),
  }
}

export async function resolveRecipientClerkId(ownerId: string) {
  const objectIdQuery = Types.ObjectId.isValid(ownerId) ? [{ _id: new Types.ObjectId(ownerId) }] : []
  const user = await User.findOne({
    $or: [
      { clerkId: ownerId },
      ...objectIdQuery,
    ],
  }).select('clerkId').lean<Pick<UserRecord, 'clerkId'> | null>()

  return user?.clerkId ?? (objectIdQuery.length ? null : ownerId)
}

export async function createNotification(input: NotificationCreateInput) {
  if (input.recipientId === input.actorId) {
    return null
  }

  return Notification.findOneAndUpdate(
    {
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      targetId: input.targetId,
    },
    {
      $setOnInsert: {
        recipientId: input.recipientId,
        actorId: input.actorId,
        type: input.type,
        targetId: input.targetId,
        relatedHeroId: input.relatedHeroId,
        read: false,
      },
    },
    {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
}

export async function listNotifications(filters: NotificationListFilters = {}): Promise<NotificationListResult> {
  const actor = await getActor()

  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { hasNotifications: false, count: 0, items: [] }
    }

    throw error
  }

  const query: Record<string, unknown> = { recipientId: actor.clerkId }

  if (filters.unreadOnly) {
    query.read = false
  }

  if (filters.type) {
    query.type = filters.type
  }

  const [unreadCount, notifications] = await Promise.all([
    Notification.countDocuments({ recipientId: actor.clerkId, read: false }),
    Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit ?? 40)
      .lean<NotificationRecord[]>(),
  ])
  const usersByClerkId = await getUserMap(notifications.map(notification => notification.actorId))
  const heroIds = notifications
    .map(notification => notification.relatedHeroId)
    .filter((id): id is Types.ObjectId => Boolean(id))
  const heroesById = await getHeroMap(heroIds)
  const heroInfoById = await getHeroInfoMap(heroIds)
  const items = notifications.map(notification => serializeNotification(notification, usersByClerkId, heroesById, heroInfoById))

  return {
    hasNotifications: unreadCount > 0,
    count: unreadCount,
    items,
  }
}

export async function getNotificationState() {
  const actor = await getOptionalActor()

  if (!actor) {
    return { hasNotifications: false, count: 0, items: [] }
  }

  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { hasNotifications: false, count: 0, items: [] }
    }

    throw error
  }

  const count = await Notification.countDocuments({ recipientId: actor.clerkId, read: false })

  return {
    hasNotifications: count > 0,
    count,
    items: [],
  }
}

export async function markNotificationRead(notificationId: string, read = true) {
  const actor = await getActor()

  if (!Types.ObjectId.isValid(notificationId)) {
    throw new ApiRequestError('Notification not found', 404)
  }

  await dbConnect()

  const notification = await Notification.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId),
      recipientId: actor.clerkId,
    },
    {
      $set: {
        read,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  ).lean<NotificationRecord | null>()

  if (!notification) {
    throw new ApiRequestError('Notification not found', 404)
  }

  return { id: notification._id.toString(), read: notification.read }
}

export async function markAllNotificationsRead() {
  const actor = await getActor()

  await dbConnect()

  const result = await Notification.updateMany(
    {
      recipientId: actor.clerkId,
      read: false,
    },
    {
      $set: {
        read: true,
      },
    },
  )

  return { modifiedCount: result.modifiedCount }
}
