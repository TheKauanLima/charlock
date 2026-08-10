import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import type { AbilityStatsPayload } from '@/lib/ability-editor-types'
import type { RenderPosition } from '@/lib/editor-assets'
import type { BoonStatsPayload, HeroStatsPayload, SpiritStatsPayload, VitalityStatsPayload, WeaponStatsPayload } from '@/lib/hero-stats-shared'
import type { ModerationStatus } from '@/lib/moderation-types'

export type CustomHeroStatus = 'private' | 'published'
export type CustomHeroSort = 'new' | 'liked' | 'trending'
export type DialogueSpeakerSide = 'left' | 'right'

export interface DialogueLine {
  id: string
  speakerSide: DialogueSpeakerSide
  speakerHeroId: string
  text: string
  order: number
}

export interface HeroInteraction {
  id: string
  targetHeroId: string
  targetHeroName: string
  title: string
  lines: DialogueLine[]
  createdAt: string
  updatedAt: string
}

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
    renderPosition?: RenderPosition
  }
  allowCopies: boolean
  heroInfo: HeroInfoDefinition
  boon: BoonStatsPayload
  weapon: WeaponStatsPayload
  vitality: VitalityStatsPayload
  spirit: SpiritStatsPayload
  abilityStats: AbilityStatsPayload
  interactions?: HeroInteraction[]
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
  renderPosition?: RenderPosition
  viewerCanEdit: boolean
  moderationStatus?: ModerationStatus
  abilityStats?: AbilityStatsPayload
  interactions?: HeroInteraction[]
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomHeroDetail extends CustomHeroSummary {
  stats: HeroStatsPayload
  abilityStats: AbilityStatsPayload
  interactions: HeroInteraction[]
}
