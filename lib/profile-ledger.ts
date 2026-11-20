import 'server-only'

import { auth } from '@clerk/nextjs/server'
import { Types } from 'mongoose'

import { ApiRequestError } from '@/lib/api-errors'
import dbConnect, { isDatabaseConnectionError } from '@/lib/dbConnect'
import Comment from '@/lib/models/Comment'
import type { IComment } from '@/lib/models/Comment'
import CustomHero from '@/lib/models/CustomHero'
import type { ICustomHero } from '@/lib/models/CustomHero'
import Like from '@/lib/models/Like'
import User from '@/lib/models/User'
import type { ProfileCommentItem, ProfileCommentsLedger, ProfileLikeItem } from '@/lib/profile-ledger-types'
import { UNKNOWN_COMMENTER_NAME, UNKNOWN_CREATOR_NAME } from '@/lib/public-page-types'

interface UserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
  isPublic?: boolean
}

interface HeroRecord extends ICustomHero {
  _id: Types.ObjectId
}

interface CommentRecord extends IComment {
  _id: Types.ObjectId
}

interface LikeRecord {
  _id: Types.ObjectId
  heroId: Types.ObjectId
  userId: string
  createdAt: Date
}

function getObjectIdQuery(id: string) {
  return Types.ObjectId.isValid(id) ? [{ _id: new Types.ObjectId(id) }] : []
}

const PUBLIC_HERO_FILTER = { status: 'published', moderationStatus: { $ne: 'hidden' } } as const

/**
 * Third-party display name: registered username or a placeholder.
 * Never falls back to the email local-part or a raw ID.
 */
function getDisplayName(user: UserRecord | undefined, placeholder: string) {
  return user?.username?.trim() || placeholder
}

async function getProfileUser(userId: string) {
  const user = await User.findOne({
    $or: [
      { clerkId: userId },
      { username: userId },
      ...getObjectIdQuery(userId),
    ],
  }).lean<UserRecord | null>()

  if (!user) {
    throw new ApiRequestError('User not found', 404)
  }

  return user
}

/**
 * Loads the profile user and enforces User.isPublic. Private profiles are
 * indistinguishable from missing ones for everyone except the owner.
 */
async function resolveProfileAccess(userId: string) {
  const profileUser = await getProfileUser(userId)
  const { userId: viewerId } = await auth()
  const viewerIsOwner = Boolean(viewerId) && viewerId === profileUser.clerkId

  if (profileUser.isPublic === false && !viewerIsOwner) {
    throw new ApiRequestError('User not found', 404)
  }

  return { profileUser, viewerIsOwner }
}

async function getUserMap(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))

  if (!uniqueIds.length) {
    return new Map<string, UserRecord>()
  }

  const users = await User.find({ clerkId: { $in: uniqueIds } }).lean<UserRecord[]>()

  return new Map(users.map(user => [user.clerkId, user]))
}

function getOwnerIds(user: UserRecord) {
  return [user.clerkId, user._id.toString()]
}

function getMatchingLikeEvent(hero: HeroRecord, ownerIds: string[]) {
  return hero.likeEvents
    ?.filter(event => ownerIds.includes(event.userId))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
}

export async function listProfileLikes(userId: string, limit = 40): Promise<ProfileLikeItem[]> {
  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return []
    }

    throw error
  }

  const { profileUser } = await resolveProfileAccess(userId)
  const ownerIds = getOwnerIds(profileUser)
  const storedLikes = await Like.find({ userId: { $in: ownerIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<LikeRecord[]>()
  const storedHeroIds = storedLikes.map(like => like.heroId)
  const legacyLikedHeroes = await CustomHero.find({
    ...PUBLIC_HERO_FILTER,
    likedBy: { $in: ownerIds },
  })
    .sort({ 'likeEvents.createdAt': -1, updatedAt: -1 })
    .limit(limit)
    .lean<HeroRecord[]>()
  const heroIds = [
    ...storedHeroIds,
    ...legacyLikedHeroes.map(hero => hero._id),
  ]

  if (!heroIds.length) {
    return []
  }

  const heroes = await CustomHero.find({ _id: { $in: heroIds }, ...PUBLIC_HERO_FILTER }).lean<HeroRecord[]>()
  const heroesById = new Map(heroes.map(hero => [hero._id.toString(), hero]))
  const likesByHeroId = new Map(storedLikes.map(like => [like.heroId.toString(), like]))
  const usersByClerkId = await getUserMap(heroes.map(hero => hero.createdByUserId))
  const items = heroes.flatMap(hero => {
    const heroId = hero._id.toString()
    const like = likesByHeroId.get(heroId)
    const legacyEvent = getMatchingLikeEvent(hero, ownerIds)
    const likedAt = like?.createdAt ?? legacyEvent?.createdAt

    if (!likedAt || !heroesById.has(heroId)) {
      return []
    }

    return [{
      id: like?._id.toString() ?? `legacy:${heroId}`,
      heroId,
      heroName: hero.name,
      creatorId: hero.createdByUserId,
      creatorName: getDisplayName(usersByClerkId.get(hero.createdByUserId), UNKNOWN_CREATOR_NAME),
      likedAt: likedAt.toISOString(),
      href: `/?tab=browse&heroId=${encodeURIComponent(heroId)}`,
    }]
  })

  return items
    .sort((left, right) => Date.parse(right.likedAt) - Date.parse(left.likedAt))
    .slice(0, limit)
}

function serializeComment(
  comment: CommentRecord,
  hero: HeroRecord | undefined,
  usersByClerkId: Map<string, UserRecord>,
  viewerCanDelete: boolean,
): ProfileCommentItem {
  const heroId = comment.heroId.toString()

  return {
    id: comment._id.toString(),
    heroId,
    heroName: hero?.name ?? 'Unknown Character',
    authorId: comment.userId,
    authorName: getDisplayName(usersByClerkId.get(comment.userId), UNKNOWN_COMMENTER_NAME),
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    href: `/?tab=browse&heroId=${encodeURIComponent(heroId)}`,
    viewerCanDelete,
  }
}

async function listMadeComments(clerkId: string, viewerIsOwner: boolean, limit: number): Promise<CommentRecord[]> {
  const baseFilter = { userId: clerkId, moderationStatus: { $ne: 'hidden' } } as const

  if (viewerIsOwner) {
    return Comment.find(baseFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<CommentRecord[]>()
  }

  // Restrict to public heroes before limiting so `limit` stays accurate.
  const commentedHeroIds = await Comment.distinct('heroId', baseFilter) as Types.ObjectId[]

  if (!commentedHeroIds.length) {
    return []
  }

  const visibleHeroes = await CustomHero.find({ _id: { $in: commentedHeroIds }, ...PUBLIC_HERO_FILTER })
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>()

  if (!visibleHeroes.length) {
    return []
  }

  return Comment.find({ ...baseFilter, heroId: { $in: visibleHeroes.map(hero => hero._id) } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<CommentRecord[]>()
}

export async function listProfileComments(userId: string, limit = 40): Promise<ProfileCommentsLedger> {
  try {
    await dbConnect()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { made: [], received: [] }
    }

    throw error
  }

  const { profileUser, viewerIsOwner } = await resolveProfileAccess(userId)
  const ownerIds = getOwnerIds(profileUser)
  // Owners see everything; everyone else only sees comments on public heroes.
  const heroVisibilityFilter = viewerIsOwner ? {} : PUBLIC_HERO_FILTER
  const authoredHeroes = await CustomHero.find({ createdByUserId: { $in: ownerIds }, ...heroVisibilityFilter })
    .select('_id name createdByUserId')
    .lean<HeroRecord[]>()
  const authoredHeroIds = authoredHeroes.map(hero => hero._id)
  const [made, received] = await Promise.all([
    listMadeComments(profileUser.clerkId, viewerIsOwner, limit),
    authoredHeroIds.length
      ? Comment.find({ heroId: { $in: authoredHeroIds }, userId: { $ne: profileUser.clerkId }, moderationStatus: { $ne: 'hidden' } })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<CommentRecord[]>()
      : Promise.resolve([]),
  ])
  const heroIds = Array.from(new Set([
    ...authoredHeroIds.map(heroId => heroId.toString()),
    ...made.map(comment => comment.heroId.toString()),
    ...received.map(comment => comment.heroId.toString()),
  ]))
  const commentHeroes = heroIds.length
    ? await CustomHero.find({ _id: { $in: heroIds.map(heroId => new Types.ObjectId(heroId)) }, ...heroVisibilityFilter })
        .select('_id name createdByUserId')
        .lean<HeroRecord[]>()
    : []
  const heroesById = new Map([...authoredHeroes, ...commentHeroes].map(hero => [hero._id.toString(), hero]))
  const usersByClerkId = await getUserMap([
    profileUser.clerkId,
    ...made.map(comment => comment.userId),
    ...received.map(comment => comment.userId),
  ])
  const serializeAll = (comments: CommentRecord[]) => comments.flatMap(comment => {
    const hero = heroesById.get(comment.heroId.toString())

    if (!hero && !viewerIsOwner) {
      return []
    }

    return [serializeComment(comment, hero, usersByClerkId, viewerIsOwner)]
  })

  return {
    made: serializeAll(made),
    received: serializeAll(received),
  }
}
