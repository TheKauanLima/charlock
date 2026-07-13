import type { PanelStat } from '@/components/panels/scaling-utils'

export const BOON_STAT_DEFINITIONS = [
  { label: 'Base Bullet Damage', value: '0.31', icon: 'damage_bullet_color' },
  { label: 'Base Melee Damage', value: '1.6', icon: 'damage_melee_color' },
  { label: 'Spirit Power', value: '1.1', icon: 'damage_magic_color' },
  { label: 'Base Health', value: '39', icon: 'health' },
] as const

export const BOON_DEFAULT_STAT_COUNT = BOON_STAT_DEFINITIONS.length

const DEFAULT_BOON_STAT_LABELS: ReadonlySet<string> = new Set(BOON_STAT_DEFINITIONS.map(definition => definition.label))

export function isDefaultBoonStatLabel(label: string) {
  return DEFAULT_BOON_STAT_LABELS.has(label)
}

export function createBoonStat(label = 'Extra Stat'): PanelStat {
  return {
    label,
    value: '0',
    unit: '',
    icon: 'damage_magic_color',
    scaling: 'boon',
    scalingValue: '0',
  }
}

function normalizeCustomBoonStat(stat: PanelStat): PanelStat {
  const value = String(stat.scaling === 'boon' ? stat.scalingValue ?? stat.value ?? '0' : stat.value ?? '0')

  return {
    label: stat.label ?? 'Extra Stat',
    value,
    unit: '',
    icon: stat.icon ?? 'damage_magic_color',
    scaling: 'boon',
    scalingValue: value,
  }
}

export function buildBoonStatsArray(stats?: PanelStat[]): PanelStat[] {
  const sourceStats = stats ?? []
  const consumedIndexes = new Set<number>()
  const canUseIndexedFallback = sourceStats.length >= BOON_DEFAULT_STAT_COUNT

  const defaultStats: PanelStat[] = BOON_STAT_DEFINITIONS.map((definition, index) => {
    const indexedStored = sourceStats[index]
    const storedByLabelIndex = sourceStats.findIndex(stat => stat.label === definition.label)
    const indexedStoredLooksLikeThisDefault = canUseIndexedFallback && indexedStored && (!isDefaultBoonStatLabel(indexedStored.label ?? '') || indexedStored.label === definition.label)
    const storedIndex = storedByLabelIndex >= 0
      ? storedByLabelIndex
      : indexedStoredLooksLikeThisDefault ? index : -1
    const stored = storedIndex >= 0 ? sourceStats[storedIndex] : undefined
    const scalingValue = stored?.scaling === 'boon'
      ? String(stored.scalingValue)
      : String(stored?.value ?? definition.value)

    if (storedIndex >= 0) {
      consumedIndexes.add(storedIndex)
    }

    return {
      label: stored?.label ?? definition.label,
      value: scalingValue,
      unit: '',
      icon: stored?.icon ?? definition.icon,
      scaling: 'boon',
      scalingValue,
    }
  })

  const customStats = sourceStats
    .filter((stat, index) => !consumedIndexes.has(index) && !isDefaultBoonStatLabel(stat.label ?? ''))
    .map(normalizeCustomBoonStat)

  return [...defaultStats, ...customStats]
}
