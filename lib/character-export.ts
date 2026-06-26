import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'

export const CHARACTER_CARD_WIDTH = 1200
export const CHARACTER_CARD_HEIGHT = 630
export const CHARACTER_CARD_WATERMARK = 'charlock.app'

export interface CharacterExportStat {
  label: string
  value: string
}

export interface CharacterExportPayload {
  id?: string | null
  name: string
  portrait: string
  render: string
  tags: string[]
  stats: CharacterExportStat[]
  accentColor: string
  tagColor: string
  tagTextColor: string
  watermark: string
}

interface ExportHeroLike extends Pick<HeroDefinition, 'displayName' | 'portrait' | 'render' | 'heroInfo'> {
  id?: string
  background?: string
}

function getStatValue(stats: HeroStatsPayload, group: 'weapon' | 'vitality' | 'spirit', label: string) {
  if (group === 'weapon') {
    return stats.weapon.stats.find(stat => stat.label === label)?.value
  }

  if (group === 'vitality') {
    return stats.vitality.stats.find(stat => stat.label === label)?.value
  }

  return stats.spirit.topStats.find(stat => stat.label === label)?.value
}

function formatExportStatValue(value: string | number | null | undefined, unit = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue ? `${normalizedValue}${unit}` : '0'
}

export function getSiteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}

export function getAbsoluteAssetUrl(src: string, origin = getSiteOrigin()) {
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) {
    return src
  }

  const normalizedSrc = src.startsWith('/') ? src : `/${src}`

  return `${origin.replace(/\/$/, '')}${normalizedSrc}`
}

export function buildCharacterExportPayload(
  hero: ExportHeroLike,
  stats: HeroStatsPayload,
  options: {
    name?: string | null
    render?: string | null
    heroInfo?: HeroInfoDefinition | null
    watermark?: string
  } = {},
): CharacterExportPayload {
  const heroInfo = options.heroInfo ?? stats.heroInfo ?? hero.heroInfo
  const name = options.name?.trim() || hero.displayName
  const render = options.render?.trim() || hero.render || hero.background || hero.portrait
  const maxHealth = getStatValue(stats, 'vitality', 'Max Health')
  const spiritPower = stats.spirit.spiritPowerStat?.value ?? getStatValue(stats, 'spirit', 'Spirit Power')
  const bulletDamage = getStatValue(stats, 'weapon', 'Bullet Damage')

  return {
    id: hero.id ?? null,
    name,
    portrait: hero.portrait,
    render,
    tags: [heroInfo.tag1Text, heroInfo.tag2Text, heroInfo.tag3Text].map(tag => tag.trim()).filter(Boolean),
    stats: [
      { label: 'DPS', value: formatExportStatValue(stats.weapon.bulletDPS) },
      { label: 'Health', value: formatExportStatValue(maxHealth) },
      { label: 'Spirit', value: formatExportStatValue(spiritPower) },
      { label: 'Bullet', value: formatExportStatValue(bulletDamage) },
    ],
    accentColor: heroInfo.nameColor,
    tagColor: heroInfo.tagColor,
    tagTextColor: heroInfo.tagTextColor,
    watermark: options.watermark ?? CHARACTER_CARD_WATERMARK,
  }
}
