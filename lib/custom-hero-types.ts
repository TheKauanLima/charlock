import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import type { HeroStatsPayload, SpiritStatsPayload, VitalityStatsPayload, WeaponStatsPayload } from '@/lib/hero-stats-shared'

export type CustomHeroStatus = 'private' | 'published'
export type CustomHeroSort = 'new' | 'liked' | 'trending'

export interface CustomHeroListFilters {
  status: CustomHeroStatus
  sort: CustomHeroSort
  search: string
  limit: number
  offset: number
}

export interface CustomHeroPagination {
  limit: number
  offset: number
  total: number
  hasMore: boolean
}

export interface CustomHeroListResult {
  heroes: CustomHeroSummary[]
  pagination: CustomHeroPagination
}

export interface CustomHeroSavePayload {
  id?: string | null
  name: string
  status: CustomHeroStatus
  hero: {
    portrait: string
    render: string
    background: string
  }
  allowCopies: boolean
  heroInfo: HeroInfoDefinition
  weapon: WeaponStatsPayload
  vitality: VitalityStatsPayload
  spirit: SpiritStatsPayload
  abilityStats: AbilityStatsPayload
}

export interface CustomHeroSummary extends HeroDefinition {
  id: string
  creatorId: string
  status: CustomHeroStatus
  likesCount: number
  likedByCurrentUser: boolean
  bookmarkedByCurrentUser?: boolean
  allowCopies: boolean
  background: string
  viewerCanEdit: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomHeroDetail extends CustomHeroSummary {
  stats: HeroStatsPayload
  abilityStats: AbilityStatsPayload
}
