import 'server-only'

import type { Types } from 'mongoose'

import dbConnect from '@/lib/dbConnect'
import Hero from '@/lib/models/Hero'
import SpiritStats from '@/lib/models/SpiritStats'
import VitalityStats from '@/lib/models/VitalityStats'
import WeaponStats from '@/lib/models/WeaponStats'
import type { IPanelStat } from '@/lib/models/WeaponStats'
import type { PanelStat } from '@/components/panels/scaling-utils'
import type { HeroStatsPayload } from '@/lib/hero-stats-shared'
export { buildFallbackHeroStatsBySlug, buildHeroStatsSeed, buildHeroStatsSource } from '@/lib/hero-stats-shared'
export type { HeroStatsPayload, SpiritStatsPayload, VitalityStatsPayload, WeaponStatsPayload } from '@/lib/hero-stats-shared'

interface HeroRecord {
  _id: Types.ObjectId
  slug: string
  name: string
  portrait: string
  render: string
}

interface WeaponStatsRecord {
  weaponName: string
  weaponDesc: string
  gunImageSrc: string
  weaponAttributes: string[]
  bulletDPS: number
  weaponMinRange: number
  weaponMaxRange: number
  stats: IPanelStat[]
}

interface VitalityStatsRecord {
  stats: IPanelStat[]
}

interface SpiritStatsRecord {
  topStats: IPanelStat[]
  spiritPowerStat: IPanelStat
}

function serializeStoredStat(stat: IPanelStat): PanelStat {
  return {
    label: stat.label,
    value: stat.value,
    unit: stat.unit,
    icon: stat.icon,
    scaling: stat.scaling,
    scalingValue: stat.scalingValue,
    ...(stat.description ? { description: stat.description } : {}),
  }
}

export async function getHeroStatsBySlug(slug: string): Promise<HeroStatsPayload | null> {
  await dbConnect()

  const hero = await Hero.findOne({ slug }).select('_id slug name portrait render').lean<HeroRecord | null>()

  if (!hero) {
    return null
  }

  const [weapon, vitality, spirit] = await Promise.all([
    WeaponStats.findOne({ heroId: hero._id }).select('weaponName weaponDesc gunImageSrc weaponAttributes bulletDPS weaponMinRange weaponMaxRange stats').lean<WeaponStatsRecord | null>(),
    VitalityStats.findOne({ heroId: hero._id }).select('stats').lean<VitalityStatsRecord | null>(),
    SpiritStats.findOne({ heroId: hero._id }).select('topStats spiritPowerStat').lean<SpiritStatsRecord | null>(),
  ])

  if (!weapon || !vitality || !spirit) {
    return null
  }

  return {
    hero: {
      slug: hero.slug,
      name: hero.name,
      portrait: hero.portrait,
      render: hero.render,
    },
    weapon: {
      weaponName: weapon.weaponName,
      weaponDesc: weapon.weaponDesc,
      gunImageSrc: weapon.gunImageSrc,
      weaponAttributes: weapon.weaponAttributes,
      bulletDPS: weapon.bulletDPS,
      weaponMinRange: weapon.weaponMinRange,
      weaponMaxRange: weapon.weaponMaxRange,
      stats: weapon.stats.map(serializeStoredStat),
    },
    vitality: {
      stats: vitality.stats.map(serializeStoredStat),
    },
    spirit: {
      topStats: spirit.topStats.map(serializeStoredStat),
      spiritPowerStat: serializeStoredStat(spirit.spiritPowerStat),
    },
  }
}
