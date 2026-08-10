import type { CSSProperties, ChangeEvent, MouseEvent } from 'react'

import { limitScalingValuePrecision, normalizeCustomScaling, SCALING_ICONS, SCALING_LABELS, SCALING_VALUE_COLORS, SCALING_VALUE_CONFIG } from '@/components/panels/scaling-utils'
import type { CustomScalingDefinition, ScalingType } from '@/components/panels/scaling-utils'
import { getSquareIconStyle, isSquareIcon } from '@/lib/square-icon'

import styles from './ScalingValueEditor.module.css'

interface ScalingValueEditorProps {
  scaling: ScalingType
  scalingValue: string
  customScaling?: CustomScalingDefinition
  isEditable?: boolean
  showValue?: boolean
  position?: 'default' | 'raised'
  valuePosition?: 'center' | 'lower'
  onChange?: (scalingValue: string) => void
}

function getCustomScalingIconStyle(customScaling?: CustomScalingDefinition): CSSProperties {
  const scaling = normalizeCustomScaling(customScaling)

  if (isSquareIcon(scaling.icon)) {
    return getSquareIconStyle(scaling.icon, scaling.color, 'stat')
  }

  return {
    backgroundColor: scaling.color,
    WebkitMaskImage: `url('${scaling.icon}')`,
    maskImage: `url('${scaling.icon}')`,
  }
}

function getScalingIconStyle(scaling: ScalingType, customScaling?: CustomScalingDefinition): CSSProperties | undefined {
  if (scaling === 'custom') {
    return getCustomScalingIconStyle(customScaling)
  }

  const scalingIcon = SCALING_ICONS[scaling]

  if (!scalingIcon) {
    return undefined
  }

  return { backgroundImage: `url('${scalingIcon}')` }
}

function getScalingLabel(scaling: ScalingType, customScaling?: CustomScalingDefinition) {
  return scaling === 'custom'
    ? normalizeCustomScaling(customScaling).name
    : SCALING_LABELS[scaling]
}

function getScalingValueStyle(scaling: Exclude<ScalingType, 'none'>, customScaling?: CustomScalingDefinition): CSSProperties {
  const colors = SCALING_VALUE_COLORS[scaling]
  const fill = scaling === 'custom' ? normalizeCustomScaling(customScaling).color : colors.fill

  return {
    color: fill,
    WebkitTextStroke: `${SCALING_VALUE_CONFIG.borderSize} ${colors.border}`,
    paintOrder: 'stroke fill',
    fontSize: SCALING_VALUE_CONFIG.fontSize,
    fontWeight: SCALING_VALUE_CONFIG.fontWeight,
    fontFamily: SCALING_VALUE_CONFIG.fontFamily,
  }
}

export default function ScalingValueEditor({ scaling, scalingValue, customScaling, isEditable = false, showValue = false, position = 'default', valuePosition = 'center', onChange }: ScalingValueEditorProps) {
  const scalingIconStyle = getScalingIconStyle(scaling, customScaling)
  const scalingLabel = getScalingLabel(scaling, customScaling).toLowerCase()

  if (!scalingIconStyle) {
    return isEditable ? (
      <span
        className={`${styles.root} ${styles.rootEmpty} ${position === 'raised' ? styles.rootRaised : ''}`}
        data-scaling-editor="true"
        aria-hidden="true"
      />
    ) : null
  }

  function handleScalingValueChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(limitScalingValuePrecision(event.target.value))
  }

  function stopStatCellClick(event: MouseEvent<HTMLInputElement>) {
    event.stopPropagation()
  }

  return (
    <span
      className={`${styles.root} ${position === 'raised' ? styles.rootRaised : ''} ${valuePosition === 'lower' ? styles.rootValueLower : ''}`}
      data-scaling-editor="true"
      data-scaling-value-overlay="true"
      title={`${scalingLabel} scaling ${scalingValue}`}
    >
      <span className={styles.icon} style={scalingIconStyle} aria-hidden="true" />
      {isEditable && scaling !== 'none' ? (
        <span className={styles.valueWrap} style={getScalingValueStyle(scaling, customScaling)}>
          <span className={styles.prefix} aria-hidden="true">x</span>
          <input
            type="text"
            value={scalingValue}
            onChange={handleScalingValueChange}
            onClick={stopStatCellClick}
            onMouseDown={stopStatCellClick}
            aria-label={`${scalingLabel} scaling value`}
            placeholder="0"
            className={`${styles.input} border-0 bg-transparent`}
            style={getScalingValueStyle(scaling, customScaling)}
          />
        </span>
      ) : scaling !== 'none' ? (
        <span className={`${styles.valueWrap} ${showValue ? styles.valueWrapVisible : ''}`} style={getScalingValueStyle(scaling, customScaling)} aria-label={`${scalingLabel} scaling value x${scalingValue}`}>
          <span className={styles.prefix} aria-hidden="true">x</span>
          <span className={styles.valueText}>{scalingValue}</span>
        </span>
      ) : null}
    </span>
  )
}
