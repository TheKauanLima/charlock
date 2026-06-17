import 'server-only'

import { auth, currentUser } from '@clerk/nextjs/server'
import { Types } from 'mongoose'

import { CustomHeroError } from '@/lib/custom-heroes'
import dbConnect, { isDatabaseConnectionError } from '@/lib/dbConnect'
import { HEROES } from '@/lib/hero-data'
import CustomHero from '@/lib/models/CustomHero'
import type { ICustomHero } from '@/lib/models/CustomHero'
import Comment from '@/lib/models/Comment'
import type { IComment } from '@/lib/models/Comment'
import Follow from '@/lib/models/Follow'
import User from '@/lib/models/User'

const FALLBACK_HERO_PORTRAIT = HEROES[0]?.portrait ?? ''

interface Actor {
  clerkId: string
  storageUserId: string
  ownerIds: string[]
}

interface HeroRecord extends ICustomHero {
  _id: Types.ObjectId
}

interface CommentRecord extends IComment {
  _id: Types.ObjectId
}

interface UserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
  bookmarks?: Types.ObjectId[]
}

export interface HeroComment {
  id: string
  heroId: string
  userId: string
  authorName: string
  content: string
  viewerCanDelete: boolean
  createdAt: string
  updatedAt: string
}

export interface ActivityFeedItem {
  id: string
  type: 'published_hero' | 'comment'
  createdAt: string
  heroId: string
  heroName: string
  heroPortrait: string
  actorId: string
  actorName: string
  content?: string
}

function getValidObjectId(id: string, label = 'Hero not found') {
  if (!Types.ObjectId.isValid(id)) {
    throw new CustomHeroError(label, 404)
  }

  return new Types.ObjectId(id)
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

function getDisplayName(user: UserRecord | undefined, fallbackId: string) {
  if (!user) {
    return fallbackId
  }

  return user.username?.trim() || user.email.split('@')[0] || user.clerkId
}

async function getUserMap(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))

  if (!uniqueIds.length) {
    return new Map<string, UserRecord>()
  }

  const users = await User.find({ clerkId: { $in: uniqueIds } }).lean<UserRecord[]>()

  return new Map(users.map(user => [user.clerkId, user]))
}

function serializeComment(comment: CommentRecord, usersByClerkId: Map<string, UserRecord>, actor: Actor | null): HeroComment {
  return {
    id: comment._id.toString(),
    heroId: comment.heroId.toString(),
    userId: comment.userId,
    authorName: getDisplayName(usersByClerkId.get(comment.userId), comment.userId),
    content: comment.content,
    viewerCanDelete: Boolean(actor && comment.userId === actor.clerkId),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

async function getPublishedHero(id: string) {
  const objectId = getValidObjectId(id)
  const hero = await CustomHero.findOne({ _id: objectId, status: 'published' }).lean<HeroRecord | null>()

  if (!hero) {
    throw new CustomHeroError('Hero not found', 404)
  }

  return hero
}

export async function listHeroComments(heroId: string): Promise<HeroComment[]> {
  const actor = await getOptionalActor()

  await dbConnect()
  await getPublishedHero(heroId)

  const comments = await Comment.find({ heroId: getValidObjectId(heroId) })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean<CommentRecord[]>()
  const usersByClerkId = await getUserMap(comments.map(comment => comment.userId))

  return comments.map(comment => serializeComment(comment, usersByClerkId, actor))
}

export async function postHeroComment(heroId: string, content: unknown): Promise<HeroComment> {
  const actor = await getActor()
  const trimmedContent = typeof content === 'string' ? content.trim() : ''

  if (!trimmedContent) {
    throw new CustomHeroError('Comment content is required', 400)
  }

  if (trimmedContent.length > 500) {
    throw new CustomHeroError('Comments cannot exceed 500 characters', 400)
  }

  await dbConnect()
  const hero = await getPublishedHero(heroId)
  const comment = await Comment.create({
    heroId: hero._id,
    userId: actor.clerkId,
    content: trimmedContent,
  }) as CommentRecord
  const usersByClerkId = await getUserMap([actor.clerkId])

  return serializeComment(comment, usersByClerkId, actor)
}

export async function deleteHeroComment(heroId: string, commentId: string): Promise<{ deleted: true }> {
  const actor = await getActor()

  await dbConnect()
  await getPublishedHero(heroId)

  const comment = await Comment.findOne({
    _id: getValidObjectId(commentId, 'Comment not found'),
    heroId: getValidObjectId(heroId),
  }).lean<CommentRecord | null>()

  if (!comment) {
    throw new CustomHeroError('Comment not found', 404)
  }

  if (comment.userId !== actor.clerkId) {
    throw new CustomHeroError('You can only delete your own comments', 403)
  }

  await Comment.deleteOne({ _id: comment._id })

  return { deleted: true }
}

async function ensureCurrentUserRecord() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    throw new CustomHeroError('Authentication required', 401)
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    throw new CustomHeroError('A verified email is required', 400)
  }

  const metadataUsername = clerkUser.unsafeMetadata?.username
  const username = clerkUser.username || (typeof metadataUsername === 'string' ? metadataUsername : null)

  return User.findOneAndUpdate(
    { clerkId: clerkUser.id },
    {
      $set: {
        clerkId: clerkUser.id,
        email,
        username,
        emailVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean<UserRecord | null>()
}

export async function toggleHeroBookmark(heroId: string) {
  const actor = await getActor()

  await dbConnect()
  await getPublishedHero(heroId)
  await ensureCurrentUserRecord()

  const objectId = getValidObjectId(heroId)
  const user = await User.findOne({ clerkId: actor.clerkId }).select('bookmarks').lean<UserRecord | null>()
  const isBookmarked = Boolean(user?.bookmarks?.some(bookmark => bookmark.toString() === heroId))

  await User.updateOne(
    { clerkId: actor.clerkId },
    isBookmarked ? { $pull: { bookmarks: objectId } } : { $addToSet: { bookmarks: objectId } },
  )

  return {
    heroId,
    bookmarked: !isBookmarked,
  }
}

async function findTargetUser(targetUserId: string) {
  const objectIdQuery = Types.ObjectId.isValid(targetUserId) ? [{ _id: new Types.ObjectId(targetUserId) }] : []

  return User.findOne({
    $or: [
      { clerkId: targetUserId },
      ...objectIdQuery,
    ],
  }).lean<UserRecord | null>()
}

export async function toggleFollow(targetUserId: string) {
  const actor = await getActor()

  await dbConnect()

  const targetUser = await findTargetUser(targetUserId)

  if (!targetUser) {
    throw new CustomHeroError('User not found', 404)
  }

  if (targetUser.clerkId === actor.clerkId) {
    throw new CustomHeroError('You cannot follow yourself', 400)
  }

  const existing = await Follow.findOne({
    followerId: actor.clerkId,
    followingId: targetUser.clerkId,
  }).lean()

  if (existing) {
    await Follow.deleteOne({ _id: existing._id })
  } else {
    await Follow.create({
      followerId: actor.clerkId,
      followingId: targetUser.clerkId,
    })
  }

  const followerCount = await Follow.countDocuments({ followingId: targetUser.clerkId })

  return {
    userId: targetUser.clerkId,
    following: !existing,
    followerCount,
  }
}

export async function getActivityFeed(): Promise<ActivityFeedItem[]> {
  const actor = await getActor()

  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return []
    }

    throw error
  }

  try {
    const follows = await Follow.find({ followerId: actor.clerkId }).lean<{ followingId: string }[]>()
    const followedClerkIds = follows.map(follow => follow.followingId)
    const followedUsers = await User.find({ clerkId: { $in: followedClerkIds } }).lean<UserRecord[]>()
    const followedOwnerIds = [
      ...followedClerkIds,
      ...followedUsers.map(user => user._id.toString()),
    ]
    const followedHeroes = followedOwnerIds.length
      ? await CustomHero.find({ status: 'published', createdByUserId: { $in: followedOwnerIds } })
          .sort({ publishedAt: -1, updatedAt: -1 })
          .limit(20)
          .lean<HeroRecord[]>()
      : []

    const ownHeroes = await CustomHero.find({ createdByUserId: { $in: actor.ownerIds } }).select('_id name portrait createdByUserId').lean<HeroRecord[]>()
    const comments = ownHeroes.length
      ? await Comment.find({ heroId: { $in: ownHeroes.map(hero => hero._id) } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean<CommentRecord[]>()
      : []

    const heroById = new Map([...followedHeroes, ...ownHeroes].map(hero => [hero._id.toString(), hero]))
    const usersByClerkId = await getUserMap([
      ...followedHeroes.map(hero => hero.createdByUserId),
      ...comments.map(comment => comment.userId),
    ])
    const publishedItems = followedHeroes.map(hero => ({
      id: `hero:${hero._id.toString()}`,
      type: 'published_hero' as const,
      createdAt: (hero.publishedAt ?? hero.updatedAt).toISOString(),
      heroId: hero._id.toString(),
      heroName: hero.name,
      heroPortrait: hero.portrait,
      actorId: hero.createdByUserId,
      actorName: getDisplayName(usersByClerkId.get(hero.createdByUserId), hero.createdByUserId),
    }))
    const commentItems = comments.map(comment => {
      const hero = heroById.get(comment.heroId.toString())

      return {
        id: `comment:${comment._id.toString()}`,
        type: 'comment' as const,
        createdAt: comment.createdAt.toISOString(),
        heroId: comment.heroId.toString(),
        heroName: hero?.name ?? 'Unknown Hero',
        heroPortrait: hero?.portrait ?? FALLBACK_HERO_PORTRAIT,
        actorId: comment.userId,
        actorName: getDisplayName(usersByClerkId.get(comment.userId), comment.userId),
        content: comment.content,
      }
    })

    return [...publishedItems, ...commentItems]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 30)
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return []
    }

    throw error
  }
}

export async function getNotificationState() {
  const actor = await getOptionalActor()

  if (!actor) {
    return { hasNotifications: false, count: 0 }
  }

  await dbConnect()

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const follows = await Follow.find({ followerId: actor.clerkId }).lean<{ followingId: string }[]>()
  const followedClerkIds = follows.map(follow => follow.followingId)
  const followedUsers = followedClerkIds.length
    ? await User.find({ clerkId: { $in: followedClerkIds } }).lean<UserRecord[]>()
    : []
  const followedOwnerIds = [
    ...followedClerkIds,
    ...followedUsers.map(user => user._id.toString()),
  ]
  const ownHeroes = await CustomHero.find({ createdByUserId: { $in: actor.ownerIds } }).select('_id').lean<HeroRecord[]>()

  const [newHeroCount, commentCount] = await Promise.all([
    followedOwnerIds.length
      ? CustomHero.countDocuments({ status: 'published', createdByUserId: { $in: followedOwnerIds }, publishedAt: { $gte: since } })
      : Promise.resolve(0),
    ownHeroes.length
      ? Comment.countDocuments({ heroId: { $in: ownHeroes.map(hero => hero._id) }, userId: { $ne: actor.clerkId }, createdAt: { $gte: since } })
      : Promise.resolve(0),
  ])
  const count = newHeroCount + commentCount

  return {
    hasNotifications: count > 0,
    count,
  }
}
