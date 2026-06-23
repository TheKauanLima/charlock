import type { CSSProperties, ChangeEvent, MouseEvent } from 'react'

import { limitScalingValuePrecision, SCALING_ICONS, SCALING_VALUE_COLORS, SCALING_VALUE_CONFIG } from '@/components/panels/scaling-utils'
import type { ScalingType } from '@/components/panels/scaling-utils'

import styles from './ScalingValueEditor.module.css'

interface ScalingValueEditorProps {
  scaling: ScalingType
  scalingValue: string
  isEditable?: boolean
  showValue?: boolean
  position?: 'default' | 'raised'
  valuePosition?: 'center' | 'lower'
  onChange?: (scalingValue: string) => void
}

function getScalingIconStyle(scaling: ScalingType): CSSProperties | undefined {
  const scalingIcon = SCALING_ICONS[scaling]

  if (!scalingIcon) {
    return undefined
  }

  return { backgroundImage: `url('${scalingIcon}')` }
}

function getScalingValueStyle(scaling: Exclude<ScalingType, 'none'>): CSSProperties {
  const colors = SCALING_VALUE_COLORS[scaling]

  return {
    color: colors.fill,
    WebkitTextStroke: `${SCALING_VALUE_CONFIG.borderSize} ${colors.border}`,
    paintOrder: 'stroke fill',
    fontSize: SCALING_VALUE_CONFIG.fontSize,
    fontWeight: SCALING_VALUE_CONFIG.fontWeight,
    fontFamily: SCALING_VALUE_CONFIG.fontFamily,
  }
}

export default function ScalingValueEditor({ scaling, scalingValue, isEditable = false, showValue = false, position = 'default', valuePosition = 'center', onChange }: ScalingValueEditorProps) {
  const scalingIconStyle = getScalingIconStyle(scaling)

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
    <span className={`${styles.root} ${position === 'raised' ? styles.rootRaised : ''} ${valuePosition === 'lower' ? styles.rootValueLower : ''}`} data-scaling-editor="true" title={`${scaling} scaling ${scalingValue}`}>
      <span className={styles.icon} style={scalingIconStyle} aria-hidden="true" />
      {isEditable && scaling !== 'none' ? (
        <span className={styles.valueWrap} style={getScalingValueStyle(scaling)}>
          <span className={styles.prefix} aria-hidden="true">x</span>
          <input
            type="text"
            value={scalingValue}
            onChange={handleScalingValueChange}
            onClick={stopStatCellClick}
            onMouseDown={stopStatCellClick}
            aria-label={`${scaling} scaling value`}
            placeholder="0"
            className={`${styles.input} border-0 bg-transparent`}
            style={getScalingValueStyle(scaling)}
          />
        </span>
      ) : scaling !== 'none' ? (
        <span className={`${styles.valueWrap} ${showValue ? styles.valueWrapVisible : ''}`} style={getScalingValueStyle(scaling)} aria-label={`${scaling} scaling value x${scalingValue}`}>
          <span className={styles.prefix} aria-hidden="true">x</span>
          <span className={styles.valueText}>{scalingValue}</span>
        </span>
      ) : null}
    </span>
  )
}
