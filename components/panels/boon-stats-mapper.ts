import type { PanelStat } from '@/components/panels/scaling-utils'

export const BOON_STAT_DEFINITIONS = [
  { label: 'Base Bullet Damage', value: '0.31', icon: 'damage_bullet_color' },
  { label: 'Base Melee Damage', value: '1.6', icon: 'damage_melee_color' },
  { label: 'Spirit Power', value: '1.1', icon: 'damage_magic_color' },
  { label: 'Base Health', value: '39', icon: 'health' },
] as const

export function buildBoonStatsArray(stats?: PanelStat[]): PanelStat[] {
  return BOON_STAT_DEFINITIONS.map(definition => {
    const stored = stats?.find(stat => stat.label === definition.label)
    const scalingValue = stored?.scaling === 'boon'
      ? String(stored.scalingValue)
      : String(stored?.value ?? definition.value)

    return {
      label: definition.label,
      value: scalingValue,
      unit: '',
      icon: definition.icon,
      scaling: 'boon',
      scalingValue,
    }
  })
}
