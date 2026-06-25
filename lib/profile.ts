import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import type { Types } from 'mongoose'

import dbConnect, { isDatabaseConnectionError } from '@/lib/dbConnect'
import type { CustomHeroSummary } from '@/lib/custom-hero-types'
import { HEROES, type HeroDefinition } from '@/lib/hero-data'
import CustomHero from '@/lib/models/CustomHero'
import Follow from '@/lib/models/Follow'
import HeroInfo from '@/lib/models/HeroInfo'
import User from '@/lib/models/User'

export interface UserLevel {
  label: 'New User' | 'Contributor' | 'Power User' | 'Community Leader'
  tone: 'rookie' | 'investigator' | 'lead' | 'chief'
  nextAt: number | null
  progress: number
}

export interface ProfileUser {
  id: string
  clerkId: string
  email: string
  username: string
  preferredHero: string
  profileBackground: string
  isPublic: boolean
  anonymousEdits: boolean
  customBio: string
  createdAt: string
  updatedAt: string
}

export interface ProfileHeroCard {
  id: string
  name: string
  slug: string
  portrait: string
  render: string
  updatedAt: string
  status: string
}

export interface ProfileBackgroundVisual {
  id: string
  label: string
  render: string
  accent: string
  nameColor: string
}

export interface UserProfileData {
  user: ProfileUser
  viewerIsOwner: boolean
  avatarUrl: string | null
  preferredHero: HeroDefinition
  profileBackground: ProfileBackgroundVisual
  authoredHeroes: ProfileHeroCard[]
  savedHeroes: CustomHeroSummary[]
  bookmarkedHeroes: CustomHeroSummary[]
  privateHeroes: CustomHeroSummary[]
  viewerFollowsUser: boolean
  followerCount: number
  level: UserLevel
  charactersCreated: number
  userContributions: number
}

interface UserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
  preferredHero?: string | null
  profileBackground?: string | null
  isPublic?: boolean | null
  anonymousEdits?: boolean | null
  customBio?: string | null
  bookmarks?: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

interface HeroRecord {
  _id: Types.ObjectId
  name: string
  slug: string
  portrait: string
  render: string
  status: string
  updatedAt: Date
}

const DEFAULT_PROFILE_BIO = 'No profile bio has been added yet.'

export class ProfileUnavailableError extends Error {
  constructor() {
    super('Profile data is temporarily unavailable')
    this.name = 'ProfileUnavailableError'
  }
}

export function isProfileUnavailableError(error: unknown) {
  return error instanceof ProfileUnavailableError
}

export function getUserLevel(contributionCount: number): UserLevel {
  if (contributionCount > 50) {
    return {
      label: 'Community Leader',
      tone: 'chief',
      nextAt: null,
      progress: 100,
    }
  }

  if (contributionCount > 20) {
    return {
      label: 'Power User',
      tone: 'lead',
      nextAt: 51,
      progress: Math.min(100, Math.round((contributionCount / 51) * 100)),
    }
  }

  if (contributionCount > 5) {
    return {
      label: 'Contributor',
      tone: 'investigator',
      nextAt: 21,
      progress: Math.min(100, Math.round((contributionCount / 21) * 100)),
    }
  }

  return {
    label: 'New User',
    tone: 'rookie',
    nextAt: 6,
    progress: Math.min(100, Math.round((contributionCount / 6) * 100)),
  }
}

export function getProfileHero(slug?: string | null) {
  return HEROES.find(hero => hero.slug === slug) ?? HEROES[0]
}

export function getProfilePathSegment(user: { username?: string | null; clerkId: string }) {
  return encodeURIComponent(user.username?.trim() || user.clerkId)
}

export function getProfileRedirectPath(user: { username?: string | null; clerkId: string }) {
  return `/profile/${getProfilePathSegment(user)}`
}

export function isProfilePathSegmentForUser(segment: string, user: { username?: string | null; clerkId: string }) {
  const decodedSegment = decodeURIComponent(segment)

  return [user.username?.trim(), user.clerkId].filter(Boolean).includes(decodedSegment)
}

function buildOwnerIds(user: UserRecord) {
  return [user.clerkId, user._id.toString()]
}

function serializeUser(user: UserRecord): ProfileUser {
  const username = user.username?.trim() || user.email.split('@')[0] || user.clerkId
  const preferredHero = user.preferredHero || 'abrams'

  return {
    id: user._id.toString(),
    clerkId: user.clerkId,
    email: user.email,
    username,
    preferredHero,
    profileBackground: user.profileBackground || `official:${preferredHero}`,
    isPublic: user.isPublic ?? true,
    anonymousEdits: user.anonymousEdits ?? false,
    customBio: user.customBio?.trim() || DEFAULT_PROFILE_BIO,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

function serializeHero(hero: HeroRecord): ProfileHeroCard {
  return {
    id: hero._id.toString(),
    name: hero.name,
    slug: hero.slug,
    portrait: hero.portrait,
    render: hero.render,
    updatedAt: hero.updatedAt.toISOString(),
    status: hero.status,
  }
}

async function getAvatarUrl(clerkId: string) {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(clerkId)

    return user.imageUrl || null
  } catch {
    return null
  }
}

async function getSavedCustomHeroes(ownerIds: string[]) {
  const { listCustomHeroesForOwner } = await import('@/lib/custom-heroes')

  return listCustomHeroesForOwner(ownerIds)
}

async function getBookmarkedCustomHeroes(bookmarks: Types.ObjectId[] | undefined, ownerIds: string[]) {
  const { listBookmarkedCustomHeroes } = await import('@/lib/custom-heroes')

  return listBookmarkedCustomHeroes(bookmarks ?? [], ownerIds)
}

export async function getCurrentProfileUser() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    notFound()
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    notFound()
  }

  const metadataUsername = clerkUser.unsafeMetadata?.username
  const username = clerkUser.username || (typeof metadataUsername === 'string' ? metadataUsername : null)

  try {
    await dbConnect()

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
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      throw new ProfileUnavailableError()
    }

    throw error
  }
}

function getProfileBackgroundVisual(value: string, preferredHero: HeroDefinition, authoredHeroes: HeroRecord[]): ProfileBackgroundVisual {
  const [type, id] = value.split(':')

  if (type === 'custom') {
    const customHero = authoredHeroes.find(hero => hero._id.toString() === id)

    if (customHero) {
      return {
        id: value,
        label: customHero.name,
        render: customHero.render,
        accent: preferredHero.heroInfo.tagColor,
        nameColor: preferredHero.heroInfo.nameColor,
      }
    }
  }

  const officialHero = HEROES.find(hero => hero.slug === (type === 'official' ? id : value)) ?? preferredHero

  return {
    id: `official:${officialHero.slug}`,
    label: officialHero.displayName,
    render: officialHero.render,
    accent: officialHero.heroInfo.tagColor,
    nameColor: officialHero.heroInfo.nameColor,
  }
}

async function getCurrentProfileUserForSegment(profileSegment: string) {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    return null
  }

  const metadataUsername = clerkUser.unsafeMetadata?.username
  const username = clerkUser.username || (typeof metadataUsername === 'string' ? metadataUsername : null)

  if (!isProfilePathSegmentForUser(profileSegment, { username, clerkId: clerkUser.id })) {
    return null
  }

  return getCurrentProfileUser()
}

export async function getUserProfile(username: string): Promise<UserProfileData> {
  let user: UserRecord | null
  const decodedUsername = decodeURIComponent(username)

  try {
    await dbConnect()

    user = await User.findOne({
      $or: [
        { username: decodedUsername },
        { clerkId: decodedUsername },
      ],
    }).lean<UserRecord | null>()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      throw new ProfileUnavailableError()
    }

    throw error
  }

  if (!user) {
    user = await getCurrentProfileUserForSegment(username)

    if (!user) {
      notFound()
    }
  }

  const { userId } = await auth()
  const viewerIsOwner = userId === user.clerkId

  if (!viewerIsOwner && user.isPublic === false) {
    notFound()
  }

  const ownerIds = buildOwnerIds(user)
  const authoredHeroRecords = await CustomHero.find({ createdByUserId: { $in: ownerIds } })
    .sort({ updatedAt: -1 })
    .lean<HeroRecord[]>()
  const authoredHeroIds = authoredHeroRecords.map(hero => hero._id)

  const [heroInfoContributionCount, userContributions, avatarUrl, savedHeroes, bookmarkedHeroes, viewerFollowsUser, followerCount] = await Promise.all([
    HeroInfo.countDocuments({ createdByUserId: { $in: ownerIds } }),
    authoredHeroIds.length
      ? HeroInfo.countDocuments({
          heroId: { $in: authoredHeroIds },
          backstory: { $type: 'string', $ne: '' },
        })
      : Promise.resolve(0),
    getAvatarUrl(user.clerkId),
    viewerIsOwner ? getSavedCustomHeroes(ownerIds) : Promise.resolve([]),
    viewerIsOwner ? getBookmarkedCustomHeroes(user.bookmarks, ownerIds) : Promise.resolve([]),
    userId && !viewerIsOwner
      ? Follow.exists({ followerId: userId, followingId: user.clerkId }).then(Boolean)
      : Promise.resolve(false),
    Follow.countDocuments({ followingId: user.clerkId }),
  ])

  const charactersCreated = authoredHeroRecords.length
  const contributionCount = charactersCreated + heroInfoContributionCount
  const serializedUser = serializeUser(user)
  const preferredHero = getProfileHero(serializedUser.preferredHero)

  return {
    user: serializedUser,
    viewerIsOwner,
    avatarUrl,
    preferredHero,
    profileBackground: getProfileBackgroundVisual(serializedUser.profileBackground, preferredHero, authoredHeroRecords),
    authoredHeroes: authoredHeroRecords.map(serializeHero),
    savedHeroes,
    bookmarkedHeroes,
    privateHeroes: savedHeroes.filter(hero => hero.status === 'private'),
    viewerFollowsUser,
    followerCount,
    level: getUserLevel(contributionCount),
    charactersCreated,
    userContributions,
  }
}
