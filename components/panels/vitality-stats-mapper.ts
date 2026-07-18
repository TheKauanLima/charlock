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
  { label: 'Max Health', valueField: 'max_health', fallback: 810, unit: '', icon: 'maxHealth', scalingBase: 'max_health' },
  { label: 'Health Regen', valueField: 'health_regen', fallback: 1.5, unit: '', icon: 'healthRegen', scalingBase: 'health_regen' },
  { label: 'Heal Amp', valueField: 'heal_amp_percent', fallback: 0, unit: '%', icon: 'healAmp', scalingBase: 'heal_amp_percent' },
  { label: 'Non-Combat Regen', valueField: 'non_combat_regen', fallback: 0, unit: '', icon: 'healthRegen', scalingBase: 'non_combat_regen' },
  { label: 'Lifesteal Effectiveness', valueField: 'lifesteal_effectiveness_percent', fallback: 0, unit: '%', icon: 'lifestealEffectiveness', scalingBase: 'lifesteal_effectiveness_percent' },
  { label: 'Bullet Resist', valueField: 'bullet_resist_percent', fallback: 0, unit: '%', icon: 'bulletResist', scalingBase: 'bullet_resist_percent' },
  { label: 'Spirit Resist', valueField: 'spirit_resist_percent', fallback: 0, unit: '%', icon: 'spiritResist', scalingBase: 'spirit_resist_percent' },
  { label: 'Melee Resist', valueField: 'melee_resist_percent', fallback: 0, unit: '%', icon: 'meleeResist', scalingBase: 'melee_resist_percent' },
  { label: 'Debuff Resist', valueField: 'debuff_resist_percent', fallback: 0, unit: '%', icon: 'debuffResist', scalingBase: 'debuff_resist_percent' },
  { label: 'Crit Reduction', valueField: 'crit_reduction_percent', fallback: 0, unit: '%', icon: 'critReduction', scalingBase: 'crit_reduction_percent' },
  { label: 'Move Speed', valueField: 'move_speed', fallback: 6.3, unit: 'm', icon: 'moveSpeed', scalingBase: 'move_speed' },
  { label: 'Sprint Speed', valueField: 'sprint_speed', fallback: 1.1, unit: 'm', icon: 'moveSprint', scalingBase: 'sprint_speed' },
  { label: 'Stamina Cooldown', valueField: 'stamina_cooldown', fallback: 4.5, unit: 's', icon: 'staminaRecovery', scalingBase: 'stamina_cooldown' },
  { label: 'Stamina Recovery', valueField: 'stamina_recovery_percent', fallback: 0, unit: '%', icon: 'staminaRecovery', scalingBase: 'stamina_recovery_percent' },
  { label: 'Stamina', valueField: 'stamina', fallback: 3, unit: '', icon: 'stamina', scalingBase: 'stamina' },
  { label: 'Dash Speed', valueField: 'dash_speed', fallback: 0, unit: 'm', icon: 'stamina', scalingBase: 'dash_speed' },
  { label: 'Air Control', valueField: 'air_control_percent', fallback: 0, unit: '%', icon: 'stamina', scalingBase: 'air_control_percent' },
  { label: 'Gravity Scale', valueField: 'gravity_scale_percent', fallback: 0, unit: '%', icon: 'stamina', scalingBase: 'gravity_scale_percent' },
]

export function buildVitalityStatsArray(row?: StatsRow): PanelStat[] {
  return STAT_DEFINITIONS.map(definition => ({
    label: definition.label,
    value: String(row?.[definition.valueField] ?? definition.fallback),
    unit: definition.unit,
    icon: definition.icon,
    ...mapStatScaling(row, definition.scalingBase),
  }))
}

export function normalizeVitalityStatsArray(stats?: PanelStat[]): PanelStat[] {
  const statsByLabel = new Map((stats ?? []).map(stat => [stat.label, stat]))

  return buildVitalityStatsArray().map(defaultStat => {
    const storedStat = statsByLabel.get(defaultStat.label)

    return {
      ...defaultStat,
      value: '0',
      ...storedStat,
      label: defaultStat.label,
      unit: defaultStat.unit,
      icon: defaultStat.icon,
    }
  })
}
