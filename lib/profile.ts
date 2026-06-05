import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import type { Types } from 'mongoose'

import dbConnect from '@/lib/dbConnect'
import { HEROES, type HeroDefinition } from '@/lib/hero-data'
import Hero from '@/lib/models/Hero'
import HeroInfo from '@/lib/models/HeroInfo'
import User from '@/lib/models/User'

export interface DetectiveRank {
  label: 'Rookie' | 'Investigator' | 'Lead Detective' | 'Chief of Occult Crimes'
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

export interface ProfileDossierData {
  user: ProfileUser
  viewerIsOwner: boolean
  avatarUrl: string | null
  preferredHero: HeroDefinition
  authoredHeroes: ProfileHeroCard[]
  rank: DetectiveRank
  casesClosed: number
  intelligenceReports: number
}

interface UserRecord {
  _id: Types.ObjectId
  clerkId: string
  email: string
  username?: string | null
  preferredHero?: string | null
  isPublic?: boolean | null
  anonymousEdits?: boolean | null
  customBio?: string | null
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

const DEFAULT_PROFILE_BIO = 'No field report has been filed for this detective.'

export function getDetectiveRank(contributionCount: number): DetectiveRank {
  if (contributionCount > 50) {
    return {
      label: 'Chief of Occult Crimes',
      tone: 'chief',
      nextAt: null,
      progress: 100,
    }
  }

  if (contributionCount > 20) {
    return {
      label: 'Lead Detective',
      tone: 'lead',
      nextAt: 51,
      progress: Math.min(100, Math.round((contributionCount / 51) * 100)),
    }
  }

  if (contributionCount > 5) {
    return {
      label: 'Investigator',
      tone: 'investigator',
      nextAt: 21,
      progress: Math.min(100, Math.round((contributionCount / 21) * 100)),
    }
  }

  return {
    label: 'Rookie',
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

function buildOwnerIds(user: UserRecord) {
  return [user.clerkId, user._id.toString()]
}

function serializeUser(user: UserRecord): ProfileUser {
  const username = user.username?.trim() || user.email.split('@')[0] || user.clerkId

  return {
    id: user._id.toString(),
    clerkId: user.clerkId,
    email: user.email,
    username,
    preferredHero: user.preferredHero || 'abrams',
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
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean<UserRecord | null>()
}

export async function getProfileDossier(username: string): Promise<ProfileDossierData> {
  await dbConnect()

  const decodedUsername = decodeURIComponent(username)
  const user = await User.findOne({
    $or: [
      { username: decodedUsername },
      { clerkId: decodedUsername },
    ],
  }).lean<UserRecord | null>()

  if (!user) {
    notFound()
  }

  const { userId } = await auth()
  const viewerIsOwner = userId === user.clerkId

  if (!viewerIsOwner && user.isPublic === false) {
    notFound()
  }

  const ownerIds = buildOwnerIds(user)
  const authoredHeroRecords = await Hero.find({ createdByUserId: { $in: ownerIds } })
    .sort({ updatedAt: -1 })
    .lean<HeroRecord[]>()
  const authoredHeroIds = authoredHeroRecords.map(hero => hero._id)

  const [heroInfoContributionCount, intelligenceReports, avatarUrl] = await Promise.all([
    HeroInfo.countDocuments({ createdByUserId: { $in: ownerIds } }),
    authoredHeroIds.length
      ? HeroInfo.countDocuments({
          heroId: { $in: authoredHeroIds },
          backstory: { $type: 'string', $ne: '' },
        })
      : Promise.resolve(0),
    getAvatarUrl(user.clerkId),
  ])

  const casesClosed = authoredHeroRecords.length
  const contributionCount = casesClosed + heroInfoContributionCount
  const serializedUser = serializeUser(user)

  return {
    user: serializedUser,
    viewerIsOwner,
    avatarUrl,
    preferredHero: getProfileHero(serializedUser.preferredHero),
    authoredHeroes: authoredHeroRecords.map(serializeHero),
    rank: getDetectiveRank(contributionCount),
    casesClosed,
    intelligenceReports,
  }
}
