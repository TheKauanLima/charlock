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

interface SpiritPowerDefinition extends StatDefinition {
  description: string
}

const TOP_STATS_DEFINITIONS: StatDefinition[] = [
  { label: 'Ability Cooldown', valueField: 'ability_cooldown_percent', fallback: 0, unit: '%', icon: 'abilityCooldown', scalingBase: 'ability_cooldown_percent' },
  { label: 'Ability Duration', valueField: 'ability_duration_percent', fallback: 0, unit: '%', icon: 'abilityDuration', scalingBase: 'ability_duration_percent' },
  { label: 'Ability Range', valueField: 'ability_range_percent', fallback: 0, unit: '%', icon: 'abilityRange', scalingBase: 'ability_range_percent' },
  { label: 'Spirit Lifesteal', valueField: 'spirit_lifesteal_percent', fallback: 0, unit: '%', icon: 'spiritLifesteal', scalingBase: 'spirit_lifesteal_percent' },
  { label: 'Max Charges Increase', valueField: 'max_charges_increase', fallback: 0, unit: '', icon: 'maxCharges', scalingBase: 'max_charges_increase' },
  { label: 'Charge Cooldown', valueField: 'charge_cooldown_percent', fallback: 0, unit: '%', icon: 'chargeCooldown', scalingBase: 'charge_cooldown_percent' },
]

const SPIRIT_POWER_DEFINITION: SpiritPowerDefinition = {
  label: 'Spirit Power',
  valueField: 'spirit_power',
  fallback: 0,
  unit: '',
  icon: 'spiritPower',
  scalingBase: 'spirit_power',
  description: 'Spirit Power increases the effectiveness of your Abilities and items.',
}

function buildStat(definition: StatDefinition, row?: StatsRow): PanelStat {
  return {
    label: definition.label,
    value: String(row?.[definition.valueField] ?? definition.fallback),
    unit: definition.unit,
    icon: definition.icon,
    ...mapStatScaling(row, definition.scalingBase),
  }
}

export function buildTopSpiritStatsArray(row?: StatsRow): PanelStat[] {
  return TOP_STATS_DEFINITIONS.map(definition => buildStat(definition, row))
}

export function buildSpiritPowerStat(row?: StatsRow): PanelStat {
  return {
    ...buildStat(SPIRIT_POWER_DEFINITION, row),
    description: SPIRIT_POWER_DEFINITION.description,
  }
}

export function buildSpiritStatsArray(row?: StatsRow): PanelStat[] {
  return buildTopSpiritStatsArray(row)
}
