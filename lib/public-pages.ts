import 'server-only'

import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { Types } from 'mongoose'
import { cache } from 'react'

import { ApiRequestError } from '@/lib/api-errors'
import type { CustomHeroDetail } from '@/lib/custom-hero-types'
import { getCustomHeroBySlug } from '@/lib/custom-heroes'
import dbConnect from '@/lib/dbConnect'
import CustomHero from '@/lib/models/CustomHero'
import User from '@/lib/models/User'
import {
  type PublicComment,
  type PublicHeroDetail,
  type PublicHeroMetadata,
  type PublicHeroPageData,
  type PublicHeroVisibility,
  type PublicProfileSeo,
  type PublicSitemapEntry,
} from '@/lib/public-page-types'
import {
  buildHeroSeoDescription,
  buildProfileSeoDescription,
  getHeroPath,
  getHeroTags,
  getPublicProfilePath,
  isProfileIndexable,
  isSafeOgImageUrl,
  isValidHeroSlug,
  toPublicCreator,
} from '@/lib/public-page-utils'
import { listPublicHeroComments } from '@/lib/social-engagement'

export * from '@/lib/public-page-utils'

const DEFAULT_SITEMAP_LIMIT = 5000
const OG_IMAGE_FETCH_TIMEOUT_MS = 3000
const OG_IMAGE_MAX_BYTES = 4 * 1024 * 1024
const OG_IMAGE_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif'])
const OG_IMAGE_LOCAL_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
}
// Same text as DEFAULT_PROFILE_BIO in lib/profile.ts.
const DEFAULT_PROFILE_BIO_TEXT = 'No profile bio has been added yet.'
const UNREGISTERED_PROFILE_NAME = 'This creator'

/** "Public" hero predicate shared by every guest-reachable query. */
const PUBLIC_HERO_FILTER = { status: 'published', moderationStatus: { $ne: 'hidden' } } as const

interface SitemapHeroRecord {
  slug?: unknown
  updatedAt?: unknown
}

interface CreatorLatestHeroRecord {
  _id: string
  updatedAt: Date
}

interface SitemapUserRecord {
  _id: Types.ObjectId
  clerkId: string
  username?: string | null
  updatedAt?: Date | null
}

interface ProfileSeoUserRecord {
  _id: Types.ObjectId
  clerkId: string
  username?: string | null
  isPublic?: boolean | null
  customBio?: string | null
  profileImageUrl?: string | null
  suspendedAt?: Date | null
  updatedAt?: Date | null
}

function getHeroVisibility(detail: Pick<CustomHeroDetail, 'status' | 'moderationStatus'>): PublicHeroVisibility {
  if (detail.moderationStatus === 'hidden') return 'owner-hidden'
  if (detail.status !== 'published') return 'owner-private'

  return 'public'
}

function toPublicHeroDetail(detail: CustomHeroDetail): PublicHeroDetail {
  const { creatorId: _creatorId, creator: _creator, interactions: _interactions, ...hero } = detail

  void _creatorId
  void _creator
  void _interactions

  return hero
}

function normalizeLimit(limit: number) {
  return Number.isFinite(limit) ? Math.floor(limit) : 0
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function getCustomBio(value: string | null | undefined) {
  const bio = value?.trim()

  return bio && bio !== DEFAULT_PROFILE_BIO_TEXT ? bio : null
}

async function loadPublicHeroComments(heroId: string): Promise<PublicComment[]> {
  try {
    return await listPublicHeroComments(heroId)
  } catch (error) {
    // The hero went private between the two lookups; render without comments.
    if (error instanceof ApiRequestError && error.status === 404) return []

    throw error
  }
}

/**
 * Owner-aware hero page data. Guests and non-owners only get public heroes; the
 * owner also gets their private or hidden hero. Returns null for an invalid slug
 * or a miss (no database call for an invalid slug).
 */
export const getPublicHeroPage = cache(async (slug: string): Promise<PublicHeroPageData | null> => {
  if (!isValidHeroSlug(slug)) return null

  const result = await getCustomHeroBySlug(slug, { includeOwner: true })

  if (!result) return null

  const visibility = getHeroVisibility(result.detail)

  // Defense in depth: the query already restricts non-public heroes to owners.
  if (visibility !== 'public' && !result.viewer.isOwner) return null

  const creator = toPublicCreator(result.creatorSummary, result.creatorAccount)
  const hero = toPublicHeroDetail(result.detail)
  const comments = visibility === 'public' ? await loadPublicHeroComments(hero.id) : []

  return {
    hero,
    creator,
    comments,
    viewer: {
      isSignedIn: result.viewer.isSignedIn,
      isOwner: result.viewer.isOwner,
      liked: result.detail.likedByCurrentUser,
      bookmarked: result.viewer.bookmarked,
    },
    visibility,
    canonicalPath: getHeroPath(hero.slug),
    description: buildHeroSeoDescription({
      displayName: hero.displayName,
      backstory: hero.heroInfo.backstory,
      tags: getHeroTags(hero.heroInfo),
      creatorName: creator.username,
    }),
  }
})

/** Public-only and session-independent (no auth(), no Clerk API). For metadata and the OG image. */
export const getPublicHeroForMetadata = cache(async (slug: string): Promise<PublicHeroMetadata | null> => {
  if (!isValidHeroSlug(slug)) return null

  const result = await getCustomHeroBySlug(slug, { includeOwner: false })

  if (!result || getHeroVisibility(result.detail) !== 'public') return null

  const { detail } = result
  const creator = toPublicCreator(result.creatorSummary, result.creatorAccount)
  const tags = getHeroTags(detail.heroInfo)

  return {
    id: detail.id,
    slug: detail.slug,
    displayName: detail.displayName,
    description: buildHeroSeoDescription({
      displayName: detail.displayName,
      backstory: detail.heroInfo.backstory,
      tags,
      creatorName: creator.username,
    }),
    portrait: detail.portrait,
    tags,
    accentColor: detail.heroInfo.tagColor,
    creator,
    likesCount: detail.likesCount,
    canonicalPath: getHeroPath(detail.slug),
  }
})

/** Public heroes for the sitemap, newest update first. Session-independent. */
export async function listPublicHeroSitemapEntries(limit = DEFAULT_SITEMAP_LIMIT): Promise<PublicSitemapEntry[]> {
  const normalizedLimit = normalizeLimit(limit)

  // limit(0) means "no limit" in MongoDB, so never send it.
  if (normalizedLimit < 1) return []

  await dbConnect()

  const heroes = await CustomHero.find(PUBLIC_HERO_FILTER)
    .sort({ updatedAt: -1 })
    .limit(normalizedLimit)
    .select('slug updatedAt')
    .lean<SitemapHeroRecord[]>()

  return heroes.flatMap(hero => (
    typeof hero.slug === 'string' && isValidHeroSlug(hero.slug) && isValidDate(hero.updatedAt)
      ? [{ path: getHeroPath(hero.slug), lastModified: hero.updatedAt }]
      : []
  ))
}

/** Indexable public profiles for the sitemap. Session-independent. */
export async function listPublicProfileSitemapEntries(limit = DEFAULT_SITEMAP_LIMIT): Promise<PublicSitemapEntry[]> {
  const normalizedLimit = normalizeLimit(limit)

  if (normalizedLimit < 1) return []

  await dbConnect()

  const latestHeroes = await CustomHero.aggregate<CreatorLatestHeroRecord>([
    { $match: PUBLIC_HERO_FILTER },
    { $group: { _id: '$createdByUserId', updatedAt: { $max: '$updatedAt' } } },
  ])
  const latestHeroByOwner = new Map(latestHeroes
    .filter(record => typeof record._id === 'string' && record._id && isValidDate(record.updatedAt))
    .map(record => [record._id, record.updatedAt]))
  const ownerIds = [...latestHeroByOwner.keys()]

  if (!ownerIds.length) return []

  const ownerObjectIds = ownerIds
    .filter(ownerId => Types.ObjectId.isValid(ownerId))
    .map(ownerId => new Types.ObjectId(ownerId))
  const users = await User.find({
    $or: [
      { clerkId: { $in: ownerIds } },
      ...(ownerObjectIds.length ? [{ _id: { $in: ownerObjectIds } }] : []),
    ],
    username: { $type: 'string', $ne: '' },
    isPublic: { $ne: false },
    suspendedAt: null,
  }).select('_id clerkId username updatedAt').lean<SitemapUserRecord[]>()

  const entries: PublicSitemapEntry[] = []

  for (const user of users) {
    const registeredUsername = user.username?.trim() || null
    const heroDates = [latestHeroByOwner.get(user.clerkId), latestHeroByOwner.get(user._id.toString())]
      .filter(isValidDate)

    if (!registeredUsername || !isProfileIndexable({
      isPublic: true,
      registeredUsername,
      publicHeroCount: heroDates.length,
      suspended: false,
    })) {
      continue
    }

    const lastModified = [...heroDates, user.updatedAt]
      .filter(isValidDate)
      .reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest))

    entries.push({ path: getPublicProfilePath(registeredUsername), lastModified })
  }

  return entries
    .sort((left, right) => right.lastModified.getTime() - left.lastModified.getTime())
    .slice(0, normalizedLimit)
}

function getMissingProfileSeo(): PublicProfileSeo {
  return {
    status: 'missing',
    username: null,
    canonicalPath: null,
    description: null,
    bio: null,
    ogImageUrl: null,
    publicHeroCount: 0,
    updatedAt: null,
  }
}

/**
 * Session-independent profile SEO (no auth(), currentUser(), or Clerk API).
 * Database errors propagate; the page metadata treats them as noindex.
 */
export const getPublicProfileSeo = cache(async (segment: string): Promise<PublicProfileSeo> => {
  if (typeof segment !== 'string') return getMissingProfileSeo()

  let decodedSegment: string

  try {
    decodedSegment = decodeURIComponent(segment)
  } catch {
    return getMissingProfileSeo()
  }

  if (!decodedSegment) return getMissingProfileSeo()

  await dbConnect()

  const user = await User.findOne({
    $or: [
      { username: decodedSegment },
      { clerkId: decodedSegment },
    ],
  }).select('_id clerkId username isPublic customBio profileImageUrl suspendedAt updatedAt').lean<ProfileSeoUserRecord | null>()

  if (!user) return getMissingProfileSeo()

  if (user.isPublic === false) {
    return { ...getMissingProfileSeo(), status: 'private' }
  }

  const registeredUsername = user.username?.trim() || null
  const publicHeroCount = await CustomHero.countDocuments({
    createdByUserId: { $in: [user.clerkId, user._id.toString()] },
    ...PUBLIC_HERO_FILTER,
  })
  const indexable = isProfileIndexable({
    isPublic: true,
    registeredUsername,
    publicHeroCount,
    suspended: Boolean(user.suspendedAt),
  })
  const bio = getCustomBio(user.customBio)
  const profileImageUrl = user.profileImageUrl ?? ''

  return {
    status: indexable ? 'indexable' : 'noindex',
    username: registeredUsername,
    canonicalPath: indexable && registeredUsername ? getPublicProfilePath(registeredUsername) : null,
    description: buildProfileSeoDescription({
      username: registeredUsername ?? UNREGISTERED_PROFILE_NAME,
      bio,
      publicHeroCount,
    }),
    bio,
    ogImageUrl: isSafeOgImageUrl(profileImageUrl) ? profileImageUrl : null,
    publicHeroCount,
    updatedAt: isValidDate(user.updatedAt) ? user.updatedAt.toISOString() : null,
  }
})

function toDataUrl(contentType: string, bytes: Uint8Array) {
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
}

async function readLimitedBody(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    total += value.byteLength

    if (total > OG_IMAGE_MAX_BYTES) {
      await reader.cancel().catch(() => undefined)

      return null
    }

    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

async function loadRemoteOgImage(url: string): Promise<string | null> {
  const response = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(OG_IMAGE_FETCH_TIMEOUT_MS),
  })

  if (!response.ok) return null

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (!OG_IMAGE_CONTENT_TYPES.has(contentType)) return null

  const declaredLength = Number(response.headers.get('content-length'))

  if (Number.isFinite(declaredLength) && declaredLength > OG_IMAGE_MAX_BYTES) return null

  const bytes = await readLimitedBody(response)

  return bytes ? toDataUrl(contentType, bytes) : null
}

async function loadLocalOgImage(sitePath: string): Promise<string | null> {
  const contentType = OG_IMAGE_LOCAL_TYPES[path.extname(sitePath).toLowerCase()]

  if (!contentType) return null

  const publicDir = path.resolve(process.cwd(), 'public')
  const filePath = path.resolve(path.join(publicDir, sitePath))

  if (!filePath.startsWith(`${publicDir}${path.sep}`)) return null

  // Resolve symlinks too, so a link inside public/ cannot point outside it.
  const [realPublicDir, realFilePath] = await Promise.all([realpath(publicDir), realpath(filePath)])

  if (!realFilePath.startsWith(`${realPublicDir}${path.sep}`)) return null

  const fileStat = await stat(realFilePath)

  if (!fileStat.isFile() || fileStat.size > OG_IMAGE_MAX_BYTES) return null

  const bytes = await readFile(realFilePath)

  if (bytes.byteLength > OG_IMAGE_MAX_BYTES) return null

  return toDataUrl(contentType, bytes)
}

/**
 * Loads an image for OG rendering as a data: URL, or null. Only URLs that pass
 * isSafeOgImageUrl are read: remote ones with redirect: 'error', a 3 s timeout,
 * a 4 MB cap, and a png/jpeg/gif content-type check; site-relative ones only from
 * inside public/ (png, jpg, jpeg, gif; no webp). Any error returns null.
 */
export async function loadOgImageDataUrl(url: string): Promise<string | null> {
  if (!isSafeOgImageUrl(url)) return null

  try {
    return url.startsWith('/') ? await loadLocalOgImage(url) : await loadRemoteOgImage(url)
  } catch {
    return null
  }
}
