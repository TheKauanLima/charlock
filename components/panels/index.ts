export { default as HeroStatsSpiritPanel } from '@/components/panels/hero-stats-spirit-panel'
export { default as HeroStatsVitalityPanel } from '@/components/panels/hero-stats-vitality-panel'
export { default as WeaponPanel } from '@/components/panels/weapon-panel'

export { buildSpiritPowerStat, buildSpiritStatsArray, buildTopSpiritStatsArray } from '@/components/panels/spirit-stats-mapper'
export { buildVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
export { buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'
export { getNextScaling } from '@/components/panels/scaling-utils'
export type { PanelStat, ScalingState, ScalingType, StatsRow } from '@/components/panels/scaling-utils'
