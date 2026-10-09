import type { CreatorProfileSummary } from '@/lib/custom-hero-types'
import type { HeroInfoDefinition } from '@/lib/hero-data'
import { UNKNOWN_CREATOR_NAME, type PublicCreator, type PublicHeroDetail, type PublicProfileSeo } from '@/lib/public-page-types'

// Pure helpers for public hero and profile pages. No server-only, mongoose, Clerk,
// or next imports, so client islands, lib/profile.ts, and unit tests can use it.

export const HERO_SLUG_PATTERN = /^[a-z0-9-]{1,160}$/
export const GUEST_ACTION_HREF = '/sign-up'
export const SEO_DESCRIPTION_MAX_LENGTH = 160

/** Mirrors next.config.ts images.remotePatterns (exact hosts). A unit test enforces parity. */
export const OG_IMAGE_REMOTE_HOSTS: readonly string[] = [
  'img.clerk.com',
  'images.clerk.dev',
  'clerk.cursedconcepts.xyz',
  'utfs.io',
]

/** Mirrors next.config.ts images.remotePatterns (`**.` wildcard hosts). A unit test enforces parity. */
export const OG_IMAGE_REMOTE_HOST_SUFFIXES: readonly string[] = [
  '.public.blob.vercel-storage.com',
]

// Same text as DEFAULT_PROFILE_BIO in lib/profile.ts; it counts as "no bio".
const DEFAULT_PROFILE_BIO_TEXT = 'No profile bio has been added yet.'
const SEO_DESCRIPTION_CUT_LENGTH = 157
const SEO_DESCRIPTION_MIN_WORD_CUT = 80
const SITE_RELATIVE_IMAGE_PATTERN = /^\/[A-Za-z0-9/_.-]+$/
const SAFE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const BLOCKED_URL_SCHEMES = ['data:', 'blob:', 'javascript:']
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/

function isControlCharacter(code: number) {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
}

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (isControlCharacter(value.charCodeAt(index))) return true
  }

  return false
}

/** Removes control characters, collapses whitespace to single spaces, and trims. */
function toPlainText(value: string | null | undefined) {
  if (typeof value !== 'string') return ''

  let withoutControls = ''

  for (let index = 0; index < value.length; index += 1) {
    withoutControls += isControlCharacter(value.charCodeAt(index)) ? ' ' : value[index]
  }

  return withoutControls.replace(/\s+/g, ' ').trim()
}

function truncateDescription(value: string) {
  if (value.length <= SEO_DESCRIPTION_MAX_LENGTH) return value

  let cut = value.slice(0, SEO_DESCRIPTION_CUT_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')

  if (lastSpace > SEO_DESCRIPTION_MIN_WORD_CUT) {
    cut = cut.slice(0, lastSpace)
  }

  return `${cut.trimEnd()}...`
}

export function isValidHeroSlug(slug: string): boolean {
  return typeof slug === 'string' && HERO_SLUG_PATTERN.test(slug)
}

export function getHeroPath(slug: string): string {
  return `/characters/${slug}`
}

export function getPublicProfilePath(username: string): string {
  return `/profile/${encodeURIComponent(username)}`
}

export function getHeroTemplateHref(heroId: string): string {
  return `/?tab=browse&heroId=${encodeURIComponent(heroId)}`
}

/** The non-empty tag texts of a hero, in order. */
export function getHeroTags(heroInfo: Pick<HeroInfoDefinition, 'tag1Text' | 'tag2Text' | 'tag3Text'> | null | undefined): string[] {
  if (!heroInfo) return []

  return [heroInfo.tag1Text, heroInfo.tag2Text, heroInfo.tag3Text]
    .map(tag => toPlainText(tag))
    .filter(tag => tag.length > 0)
}

export function buildHeroSeoDescription(input: {
  displayName: string
  backstory?: string | null
  tags: string[]
  creatorName: string
}): string {
  const backstory = toPlainText(input.backstory)

  if (backstory) return truncateDescription(backstory)

  const displayName = toPlainText(input.displayName) || 'This hero'
  const creatorName = toPlainText(input.creatorName) || UNKNOWN_CREATOR_NAME
  const tags = input.tags.map(tag => toPlainText(tag)).filter(Boolean)
  const tagText = tags.length ? ` Tags: ${tags.join(', ')}.` : ''

  return truncateDescription(toPlainText(`${displayName} is a fan-made Deadlock hero concept by ${creatorName}.${tagText}`))
}

export function buildProfileSeoDescription(input: {
  username: string
  bio?: string | null
  publicHeroCount: number
}): string {
  const bio = toPlainText(input.bio)

  if (bio && bio !== DEFAULT_PROFILE_BIO_TEXT) return truncateDescription(bio)

  const username = toPlainText(input.username) || 'This creator'
  const count = Number.isFinite(input.publicHeroCount) ? Math.max(0, Math.floor(input.publicHeroCount)) : 0

  return truncateDescription(`${username} has published ${count} fan-made Deadlock hero concept${count === 1 ? '' : 's'} on Cursed Concepts.`)
}

function hasSafeImageExtension(path: string) {
  const lowerPath = path.toLowerCase()

  return SAFE_IMAGE_EXTENSIONS.some(extension => lowerPath.endsWith(extension))
}

function isSafeSiteRelativeImagePath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return false
  if (!SITE_RELATIVE_IMAGE_PATTERN.test(value)) return false
  if (value.split('/').some(segment => segment === '..')) return false

  return hasSafeImageExtension(value)
}

function isIpLiteralHostname(hostname: string) {
  return hostname.startsWith('[') || hostname.includes(':') || IPV4_PATTERN.test(hostname)
}

function isAllowlistedHostname(hostname: string) {
  return OG_IMAGE_REMOTE_HOSTS.includes(hostname)
    || OG_IMAGE_REMOTE_HOST_SUFFIXES.some(suffix => hostname.length > suffix.length && hostname.endsWith(suffix))
}

/**
 * True for https URLs on the remotePatterns allowlist (no credentials, port, or IP
 * literal) and for safe site-relative image paths inside public/ (no `..`).
 */
export function isSafeOgImageUrl(url: string): boolean {
  if (typeof url !== 'string' || !url) return false
  if (url.includes('\\') || /\s/.test(url) || hasControlCharacter(url)) return false

  const lowerUrl = url.toLowerCase()

  if (BLOCKED_URL_SCHEMES.some(scheme => lowerUrl.startsWith(scheme))) return false

  if (url.startsWith('/')) return isSafeSiteRelativeImagePath(url)

  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password || parsed.port) return false

  const hostname = parsed.hostname.toLowerCase()

  if (!hostname || isIpLiteralHostname(hostname)) return false

  return isAllowlistedHostname(hostname)
}

/** Prefixes site-relative paths with siteUrl; returns absolute URLs unchanged. */
export function toAbsoluteSiteUrl(pathOrUrl: string, siteUrl: string): string {
  if (pathOrUrl.startsWith('/') && !pathOrUrl.startsWith('//')) {
    return `${siteUrl.replace(/\/+$/, '')}${pathOrUrl}`
  }

  return pathOrUrl
}

/** The one indexing predicate for profile metadata and the profile sitemap. */
export function isProfileIndexable(input: {
  isPublic: boolean
  registeredUsername: string | null
  publicHeroCount: number
  suspended: boolean
}): boolean {
  return input.isPublic
    && input.registeredUsername !== null
    && input.registeredUsername.length > 0
    && input.publicHeroCount >= 1
    && !input.suspended
}

export function toPublicCreator(
  summary: CreatorProfileSummary | null,
  account: { registeredUsername: string | null; isPublic: boolean } | null,
): PublicCreator {
  const registeredUsername = account?.registeredUsername?.trim() || null
  const avatarUrl = summary?.avatarUrl && isSafeOgImageUrl(summary.avatarUrl) ? summary.avatarUrl : undefined

  return {
    username: registeredUsername ?? UNKNOWN_CREATOR_NAME,
    profilePath: account?.isPublic && registeredUsername ? getPublicProfilePath(registeredUsername) : null,
    ...(avatarUrl ? { avatarUrl } : {}),
    level: summary?.level ?? 'New User',
  }
}

export function buildHeroJsonLd(input: {
  hero: PublicHeroDetail
  creator: PublicCreator
  description: string
  siteUrl: string
}): Record<string, unknown> {
  const { hero, creator, description, siteUrl } = input
  const url = `${siteUrl}${getHeroPath(hero.slug)}`
  const tags = getHeroTags(hero.heroInfo)

  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${url}#hero`,
    name: hero.displayName,
    description,
    url,
    ...(isSafeOgImageUrl(hero.portrait) ? { image: toAbsoluteSiteUrl(hero.portrait, siteUrl) } : {}),
    ...(creator.username !== UNKNOWN_CREATOR_NAME
      ? {
          author: {
            '@type': 'Person',
            name: creator.username,
            ...(creator.profilePath !== null ? { url: `${siteUrl}${creator.profilePath}` } : {}),
          },
        }
      : {}),
    datePublished: hero.publishedAt ?? hero.createdAt,
    dateModified: hero.updatedAt,
    ...(tags.length ? { keywords: tags.join(', ') } : {}),
    inLanguage: 'en',
    isPartOf: { '@id': `${siteUrl}/#website` },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/LikeAction',
      userInteractionCount: hero.likesCount,
    },
  }
}

/** Intended for seo.status === 'indexable' only. */
export function buildProfileJsonLd(input: { seo: PublicProfileSeo; siteUrl: string }): Record<string, unknown> {
  const { seo, siteUrl } = input
  const path = seo.canonicalPath ?? (seo.username ? getPublicProfilePath(seo.username) : '')
  const url = `${siteUrl}${path}`

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${url}#profile`,
    url,
    ...(seo.updatedAt ? { dateModified: seo.updatedAt } : {}),
    isPartOf: { '@id': `${siteUrl}/#website` },
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name: seo.username ?? UNKNOWN_CREATOR_NAME,
      url,
      ...(seo.ogImageUrl ? { image: toAbsoluteSiteUrl(seo.ogImageUrl, siteUrl) } : {}),
      ...(seo.bio ? { description: seo.bio } : {}),
    },
  }
}
