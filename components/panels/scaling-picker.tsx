'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, KeyboardEvent, MouseEvent, RefObject } from 'react'

import {
  limitScalingValuePrecision,
  SCALING_ICONS,
  SCALING_LABELS,
  SCALING_TYPES,
} from '@/components/panels/scaling-utils'
import type { ScalingState, ScalingType } from '@/components/panels/scaling-utils'
import cn from '@/lib/utilsd'

import styles from './ScalingPicker.module.css'

interface ScalingPickerProps extends ScalingState {
  label: string
  boundaryRef?: RefObject<HTMLElement | null>
  openPickerId: string | null
  className?: string
  menuPosition?: 'above' | 'below'
  onChange: (updates: ScalingState) => void
  onOpenPickerChange: (pickerId: string | null) => void
}

function getScalingButtonIconStyle(scaling: ScalingType): CSSProperties | undefined {
  const icon = SCALING_ICONS[scaling]

  return icon ? { backgroundImage: `url('${icon}')` } : undefined
}

export default function ScalingPicker({ label, scaling, scalingValue, boundaryRef, openPickerId, className, menuPosition = 'below', onChange, onOpenPickerChange }: ScalingPickerProps) {
  const pickerId = useId()
  const pickerRef = useRef<HTMLSpanElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [menuSide, setMenuSide] = useState<'left' | 'right'>('left')
  const isOpen = openPickerId === pickerId

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function closeWhenOutside(event: globalThis.PointerEvent | globalThis.FocusEvent) {
      const target = event.target

      if (target instanceof Node && pickerRef.current?.contains(target)) {
        return
      }

      onOpenPickerChange(null)
    }

    document.addEventListener('pointerdown', closeWhenOutside, true)
    document.addEventListener('focusin', closeWhenOutside, true)

    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside, true)
      document.removeEventListener('focusin', closeWhenOutside, true)
    }
  }, [isOpen, onOpenPickerChange])

  function stopPickerEvent(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    event.stopPropagation()

    if (event.key === 'Escape') {
      onOpenPickerChange(null)
    }
  }

  function getNextMenuSide() {
    const buttonRect = buttonRef.current?.getBoundingClientRect()
    const boundaryRect = boundaryRef?.current?.getBoundingClientRect()

    if (!buttonRect || !boundaryRect) {
      return 'left'
    }

    const menuWidth = 252
    const safeInset = 10
    const leftOpenEdge = buttonRect.right - menuWidth

    return leftOpenEdge < boundaryRect.left + safeInset ? 'right' : 'left'
  }

  function toggleMenu() {
    if (isOpen) {
      onOpenPickerChange(null)
      return
    }

    setMenuSide(getNextMenuSide())
    onOpenPickerChange(pickerId)
  }

  function updateScaling(nextScaling: ScalingType) {
    onChange({
      scaling: nextScaling,
      scalingValue: nextScaling === 'none' ? '0' : scalingValue,
    })
  }

  function updateScalingValue(event: ChangeEvent<HTMLInputElement>) {
    onChange({
      scaling,
      scalingValue: limitScalingValuePrecision(event.target.value),
    })
  }

  const iconStyle = getScalingButtonIconStyle(scaling)

  return (
    <span
      ref={pickerRef}
      className={cn(styles.root, className)}
      data-scaling-editor="true"
      data-scaling-picker="true"
      data-scaling={scaling}
      data-menu-side={menuSide}
      data-menu-position={menuPosition}
      onClick={stopPickerEvent}
      onMouseDown={stopPickerEvent}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        className={cn(styles.button, scaling !== 'none' && styles.buttonActive)}
        aria-label={`Edit ${label} scaling`}
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        {iconStyle ? (
          <span className={styles.buttonIcon} style={iconStyle} aria-hidden="true" />
        ) : (
          <span className={styles.buttonNone} aria-hidden="true">-</span>
        )}
      </button>
      {isOpen ? (
        <span className={styles.menu} data-scaling-picker-menu="true" role="dialog" aria-label={`${label} scaling controls`}>
          <span className={styles.typeRow}>
            {SCALING_TYPES.map(nextScaling => {
              const scalingIconStyle = getScalingButtonIconStyle(nextScaling)
              const scalingLabel = SCALING_LABELS[nextScaling]

              return (
                <button
                  key={nextScaling}
                  type="button"
                  data-scaling={nextScaling}
                  className={cn(styles.typeCell, scaling === nextScaling && styles.typeCellActive)}
                  aria-label={`Set ${label} scaling to ${scalingLabel.toLowerCase()}`}
                  aria-pressed={scaling === nextScaling}
                  onClick={() => updateScaling(nextScaling)}
                >
                  {scalingIconStyle ? (
                    <span className={styles.typeIcon} style={scalingIconStyle} aria-hidden="true" />
                  ) : null}
                  <span>{scalingLabel}</span>
                </button>
              )
            })}
          </span>
          <label className={styles.valueRow}>
            <span className={styles.srOnly}>{label} scaling value</span>
            <input type="text" value={scalingValue} placeholder="0" aria-label={`${label} scaling value`} onChange={updateScalingValue} />
          </label>
        </span>
      ) : null}
    </span>
  )
}
