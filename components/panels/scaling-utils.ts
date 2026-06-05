export const SCALING_TYPES = ['none', 'spirit', 'courage', 'melee', 'boon'] as const

export type ScalingType = (typeof SCALING_TYPES)[number]

export interface ScalingState {
  scaling: ScalingType
  scalingValue: string
}

export interface PanelStat extends ScalingState {
  label: string
  value: string | number
  unit?: string
  icon?: string
  description?: string
}

export interface StatsRow {
  [field: string]: string | number | null | undefined
}

export const SCALING_ICONS: Record<ScalingType, string | null> = {
  none: null,
  spirit: '/icon/spirit_scaling.png',
  courage: '/icon/weapon_scaling.png',
  melee: '/icon/melee_scaling.png',
  boon: '/icon/boon_scaling.png',
}

export const SCALING_VALUE_COLORS: Record<Exclude<ScalingType, 'none'>, { fill: string; border: string }> = {
  boon: { fill: '#99ffd6', border: '#0f5b3d' },
  courage: { fill: '#de972d', border: '#322309' },
  melee: { fill: '#de972d', border: '#322309' },
  spirit: { fill: '#e1a0ff', border: '#2c1139' },
}

export const SCALING_VALUE_CONFIG = {
  fontSize: '0.9rem',
  fontWeight: '100',
  fontFamily: "'Valve Pulp', sans-serif",
  borderSize: '3px',
}

function isScalingType(value: string): value is ScalingType {
  return SCALING_TYPES.some(scalingType => scalingType === value)
}

export function getNextScaling(currentScaling?: ScalingType | string | null): ScalingType {
  const normalizedScaling = currentScaling && isScalingType(currentScaling) ? currentScaling : 'none'
  const currentIndex = SCALING_TYPES.indexOf(normalizedScaling)
  const nextIndex = (currentIndex + 1) % SCALING_TYPES.length

  return SCALING_TYPES[nextIndex]
}

export function formatPanelValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return ''
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).trim())

  if (Number.isNaN(numericValue)) {
    return String(value)
  }

  const text = numericValue.toString()

  if (text.includes('e')) {
    return text
  }

  return text.replace(/(?:\.0+|(?<=\.[0-9]*?)0+)$/, match => (match === '.0' ? '' : match.replace(/0+$/, '')))
}

export function parseScalingValue(value: string | number | null | undefined) {
  if (value == null) {
    return null
  }

  const parsedValue = Number(String(value).trim())

  if (Number.isNaN(parsedValue) || parsedValue === 0) {
    return null
  }

  return parsedValue
}

export function limitScalingValuePrecision(value: string | number) {
  const rawValue = String(value)
  const isNegative = rawValue.trim().startsWith('-')
  const unsignedValue = rawValue.replaceAll('-', '').replace(/[^\d.]/g, '')
  const [integerPart = '', ...decimalParts] = unsignedValue.split('.')
  const hasDecimal = unsignedValue.includes('.')
  const decimalPart = decimalParts.join('')
  const normalizedValue = `${isNegative ? '-' : ''}${integerPart}${hasDecimal ? `.${decimalPart}` : ''}`
  let significantDigits = 0
  let hasStartedSignificantDigits = false
  let hasZeroOnlyValue = false
  let limitedValue = ''

  for (const character of normalizedValue) {
    if (!/\d/.test(character)) {
      limitedValue += character
      continue
    }

    if (!hasStartedSignificantDigits) {
      if (character === '0') {
        hasZeroOnlyValue = true
        limitedValue += character
        continue
      }

      hasStartedSignificantDigits = true
    }

    if (significantDigits >= 4) {
      continue
    }

    significantDigits += 1
    limitedValue += character
  }

  if (!hasStartedSignificantDigits && hasZeroOnlyValue) {
    return limitedValue
  }

  return limitedValue
}

export function mapStatScaling(row: StatsRow | undefined, base: string): ScalingState {
  if (!row || !base) {
    return { scaling: 'none', scalingValue: '0' }
  }

  const spirit = parseScalingValue(row[`${base}_spirit_scaling`])
  const weapon = parseScalingValue(row[`${base}_weapon_scaling`])
  const melee = parseScalingValue(row[`${base}_melee_scaling`] ?? (base.includes('melee') ? row[`${base}_weapon_scaling`] : undefined))
  const boon = parseScalingValue(row[`${base}_boon_scaling`])

  if (spirit !== null) {
    return { scaling: 'spirit', scalingValue: String(spirit) }
  }

  if (melee !== null) {
    return { scaling: 'melee', scalingValue: String(melee) }
  }

  if (weapon !== null) {
    return { scaling: 'courage', scalingValue: String(weapon) }
  }

  if (boon !== null) {
    return { scaling: 'boon', scalingValue: String(boon) }
  }

  return { scaling: 'none', scalingValue: '0' }
}
