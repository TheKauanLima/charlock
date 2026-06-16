import type { CustomHeroDetail } from '@/lib/custom-hero-types'

export type HeroTemplateId = 'assassin' | 'carry' | 'frontline' | 'pick' | 'support' | 'tank' | 'empty'

export interface HeroTemplateDefinition {
  id: HeroTemplateId
  label: string
  available: boolean
  hero: CustomHeroDetail
}
