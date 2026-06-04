import type { CSSProperties, ChangeEvent, MouseEvent } from 'react'

import { limitScalingValuePrecision, SCALING_ICONS, SCALING_VALUE_COLORS, SCALING_VALUE_CONFIG } from '@/components/panels/scaling-utils'
import type { ScalingType } from '@/components/panels/scaling-utils'

interface ScalingValueEditorProps {
  scaling: ScalingType
  scalingValue: string
  isEditable?: boolean
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

export default function ScalingValueEditor({ scaling, scalingValue, isEditable = false, onChange }: ScalingValueEditorProps) {
  const scalingIconStyle = getScalingIconStyle(scaling)

  if (!scalingIconStyle) {
    return null
  }

  function handleScalingValueChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(limitScalingValuePrecision(event.target.value))
  }

  function stopStatCellClick(event: MouseEvent<HTMLInputElement>) {
    event.stopPropagation()
  }

  return (
    <span className="group/scaling relative mt-[-5px] mr-[-5px] block h-6 w-[34px] shrink-0" title={`${scaling} scaling ${scalingValue}`}>
      <span className="block h-6 w-[34px] bg-contain bg-no-repeat" style={scalingIconStyle} aria-hidden="true" />
      {isEditable && scaling !== 'none' ? (
        <input
          type="text"
          value={scalingValue}
          onChange={handleScalingValueChange}
          onClick={stopStatCellClick}
          onMouseDown={stopStatCellClick}
          aria-label={`${scaling} scaling value`}
          className="pointer-events-auto absolute top-1/2 right-full z-20 w-14 -translate-y-1/2 border-0 bg-transparent px-0 py-0 text-center opacity-0 outline-none transition group-hover/scaling:opacity-100 hover:opacity-100 focus:opacity-100"
          style={getScalingValueStyle(scaling)}
        />
      ) : null}
    </span>
  )
}
