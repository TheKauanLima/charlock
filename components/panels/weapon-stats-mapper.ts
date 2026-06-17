import { mapStatScaling } from '@/components/panels/scaling-utils'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'

interface StatDefinition {
  label: string
  valueField: string
  fallback: string | number
  unit: string
  icon: string
  scalingBase: string
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { label: 'Bullet Damage', valueField: 'bullet_damage', fallback: 0, unit: '', icon: 'bulletDamage', scalingBase: 'bullet_damage' },
  { label: 'Weapon Damage', valueField: 'weapon_damage_percent', fallback: 0, unit: '%', icon: 'bulletDamage', scalingBase: 'weapon_damage_percent' },
  { label: 'Bullets per sec', valueField: 'bullets_per_sec', fallback: 0, unit: '', icon: 'fireRate', scalingBase: 'bullets_per_sec' },
  { label: 'Fire Rate', valueField: 'fire_rate_percent', fallback: 0, unit: '%', icon: 'fireRate', scalingBase: 'fire_rate_percent' },
  { label: 'Ammo', valueField: 'ammo', fallback: 0, unit: '', icon: 'ammoClipSize', scalingBase: 'ammo' },
  { label: 'Clip Size Increase', valueField: 'clip_size_increase_percent', fallback: 0, unit: '%', icon: 'ammoClipSize', scalingBase: 'clip_size_increase_percent' },
  { label: 'Reload Time', valueField: 'reload_time', fallback: 0, unit: 's', icon: 'ammoReload', scalingBase: 'reload_time' },
  { label: 'Reload Reduction', valueField: 'reload_reduction_percent', fallback: 0, unit: '%', icon: 'ammoReloadReduction', scalingBase: 'reload_reduction_percent' },
  { label: 'Bullet Velocity', valueField: 'bullet_velocity', fallback: 0, unit: 'm/s', icon: 'bulletVelocity', scalingBase: 'bullet_velocity' },
  { label: 'Bullet Velocity Increase', valueField: 'bullet_velocity_increase_percent', fallback: 0, unit: '%', icon: 'bulletVelocity', scalingBase: 'bullet_velocity_increase_percent' },
  { label: 'Bullet Lifesteal', valueField: 'bullet_lifesteal_percent', fallback: 0, unit: '%', icon: 'healthStealBullets', scalingBase: 'bullet_lifesteal_percent' },
  { label: 'Crit Bonus Scale', valueField: 'crit_bonus_scale_percent', fallback: 0, unit: '%', icon: 'critBonusScale', scalingBase: 'crit_bonus_scale_percent' },
  { label: 'Light Melee', valueField: 'light_melee_damage', fallback: 50, unit: '', icon: 'melee', scalingBase: 'light_melee_damage' },
  { label: 'Heavy Melee', valueField: 'heavy_melee_damage', fallback: 116, unit: '', icon: 'melee', scalingBase: 'heavy_melee_damage' },
]

export function buildWeaponStatsArray(row?: StatsRow): PanelStat[] {
  return STAT_DEFINITIONS.map(definition => ({
    label: definition.label,
    value: String(row?.[definition.valueField] ?? definition.fallback),
    unit: definition.unit,
    icon: definition.icon,
    ...mapStatScaling(row, definition.scalingBase),
  }))
}
