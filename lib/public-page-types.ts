import type { CreatorProfileSummary, CustomHeroDetail } from '@/lib/custom-hero-types'
import type { ProfileBackgroundVisual } from '@/lib/profile'
import type { UserLevel } from '@/lib/user-level'

export const UNKNOWN_CREATOR_NAME = 'Unknown creator'
export const UNKNOWN_COMMENTER_NAME = 'Unknown user'

export type PublicHeroVisibility = 'public' | 'owner-private' | 'owner-hidden'

/** CustomHeroDetail without the creator's internal ID, the creator summary (which carries userId), and interactions. */
export type PublicHeroDetail = Omit<CustomHeroDetail, 'creatorId' | 'creator' | 'interactions'>

export interface PublicCreator {
  /** Registered username, else UNKNOWN_CREATOR_NAME. Never the email local-part. */
  username: string
  /** Only when the creator's profile is public and they have a registered username. */
  profilePath: string | null
  /** Only if isSafeOgImageUrl passes. */
  avatarUrl?: string
  level: CreatorProfileSummary['level']
}

/** HeroComment without userId; authorName never falls back to the email local-part. */
export interface PublicComment {
  id: string
  heroId: string
  authorName: string
  content: string
  viewerCanDelete: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicHeroViewer {
  isSignedIn: boolean
  isOwner: boolean
  liked: boolean
  bookmarked: boolean
}

export interface PublicHeroPageData {
  hero: PublicHeroDetail
  creator: PublicCreator
  /** Empty unless visibility === 'public'. */
  comments: PublicComment[]
  viewer: PublicHeroViewer
  visibility: PublicHeroVisibility
  /** `/characters/${slug}` */
  canonicalPath: string
  /** buildHeroSeoDescription */
  description: string
}

/** Public-only and session-independent. */
export interface PublicHeroMetadata {
  id: string
  slug: string
  displayName: string
  description: string
  portrait: string
  tags: string[]
  /** heroInfo.tagColor */
  accentColor: string
  creator: PublicCreator
  likesCount: number
  canonicalPath: string
}

export interface PublicSitemapEntry {
  /** Site-relative, e.g. `/characters/abrams-2`. */
  path: string
  lastModified: Date
}

export type PublicProfileSeoStatus = 'indexable' | 'noindex' | 'private' | 'missing'

export interface PublicProfileSeo {
  status: PublicProfileSeoStatus
  /** Registered username only; null for private, missing, or unregistered. */
  username: string | null
  /** Only when status === 'indexable'. */
  canonicalPath: string | null
  /** Null for private and missing. */
  description: string | null
  /** Custom bio only. */
  bio: string | null
  /** Stored profileImageUrl if isSafeOgImageUrl passes; only for public statuses. */
  ogImageUrl: string | null
  publicHeroCount: number
  updatedAt: string | null
}

export interface PublicProfileHeroCard {
  id: string
  name: string
  slug: string
  href: string
  portrait: string
  render: string
  background: string
  updatedAt: string
}

export interface PublicProfileView {
  /** registeredUsername ?? UNKNOWN_CREATOR_NAME */
  username: string
  /** Clerk ID; known exposure (the follow API needs it). */
  followTargetId: string
  avatarUrl: string | null
  bio: string
  profileBackground: ProfileBackgroundVisual
  level: UserLevel
  charactersCreated: number
  userContributions: number
  followerCount: number
  viewer: { isSignedIn: boolean; follows: boolean }
  heroes: PublicProfileHeroCard[]
}
