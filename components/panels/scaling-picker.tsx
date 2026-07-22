'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, KeyboardEvent, MouseEvent, RefObject } from 'react'

import IconSearchModal, { getAbilityIconGroupsAsAssets } from '@/components/IconSearchModal/IconSearchModal'
import {
  limitScalingValuePrecision,
  normalizeCustomScaling,
  SCALING_ICONS,
  SCALING_LABELS,
  SCALING_TYPES,
} from '@/components/panels/scaling-utils'
import type { CustomScalingDefinition, ScalingState, ScalingType } from '@/components/panels/scaling-utils'
import { ABILITY_ICON_GROUPS, PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import { getSquareIconStyle, isSquareIcon } from '@/lib/square-icon'
import cn from '@/lib/utilsd'

import styles from './ScalingPicker.module.css'

interface ScalingPickerProps extends ScalingState {
  label: string
  boundaryRef?: RefObject<HTMLElement | null>
  openPickerId: string | null
  className?: string
  menuPosition?: 'above' | 'below'
  allowedScalingTypes?: readonly ScalingType[]
  onChange: (updates: ScalingState) => void
  onOpenPickerChange: (pickerId: string | null) => void
}

const SCALING_COLOR_SWATCHES = [
  { id: 'cream', label: 'Cream', value: '#f5eadb' },
  { id: 'spirit', label: 'Spirit', value: '#e1a0ff' },
  { id: 'boon', label: 'Boon', value: '#99ffd6' },
  { id: 'gun', label: 'Gun', value: '#de972d' },
  { id: 'green', label: 'Green', value: '#84c955' },
  { id: 'white', label: 'White', value: '#ffffff' },
] as const

const CUSTOM_SCALING_ABILITY_ICON_GROUPS = getAbilityIconGroupsAsAssets(ABILITY_ICON_GROUPS)

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

function getScalingButtonIconStyle(scaling: ScalingType, customScaling?: CustomScalingDefinition): CSSProperties | undefined {
  if (scaling === 'custom') {
    return getCustomScalingIconStyle(customScaling)
  }

  const icon = SCALING_ICONS[scaling]

  return icon ? { backgroundImage: `url('${icon}')` } : undefined
}

export default function ScalingPicker({ label, scaling, scalingValue, customScaling, boundaryRef, openPickerId, className, menuPosition = 'below', allowedScalingTypes = SCALING_TYPES, onChange, onOpenPickerChange }: ScalingPickerProps) {
  const pickerId = useId()
  const pickerRef = useRef<HTMLSpanElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [menuSide, setMenuSide] = useState<'left' | 'right'>('left')
  const [iconSearch, setIconSearch] = useState('')
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)
  const isOpen = openPickerId === pickerId
  const normalizedCustomScaling = normalizeCustomScaling(customScaling)
  const customScalingDraft = {
    ...normalizedCustomScaling,
    ...(typeof customScaling?.name === 'string' ? { name: customScaling.name } : {}),
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function closeWhenOutside(event: globalThis.PointerEvent | globalThis.FocusEvent) {
      const target = event.target

      if (target instanceof Node && (pickerRef.current?.contains(target) || isIconModalOpen)) {
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
  }, [isIconModalOpen, isOpen, onOpenPickerChange])

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
      ...(nextScaling === 'custom' ? { customScaling: normalizedCustomScaling } : {}),
    })
  }

  function updateScalingValue(event: ChangeEvent<HTMLInputElement>) {
    onChange({
      scaling,
      scalingValue: limitScalingValuePrecision(event.target.value),
      ...(scaling === 'custom' ? { customScaling: normalizedCustomScaling } : {}),
    })
  }

  function updateCustomScaling(updates: Partial<CustomScalingDefinition>) {
    const nextCustomScaling = {
      ...normalizedCustomScaling,
      ...(typeof customScaling?.name === 'string' ? { name: customScaling.name } : {}),
      ...updates,
    }

    onChange({
      scaling: 'custom',
      scalingValue: scalingValue || '0',
      customScaling: {
        ...normalizeCustomScaling(nextCustomScaling),
        ...(typeof updates.name === 'string' ? { name: updates.name } : {}),
      },
    })
  }

  function handleCustomNameChange(event: ChangeEvent<HTMLInputElement>) {
    updateCustomScaling({ name: event.target.value })
  }

  function handleCustomColorChange(event: ChangeEvent<HTMLInputElement>) {
    updateCustomScaling({ color: event.target.value })
  }

  function handleCustomIconSelect(icon: string) {
    updateCustomScaling({ icon })
    setIsIconModalOpen(false)
    setIconSearch('')
  }

  const iconStyle = getScalingButtonIconStyle(scaling, customScaling)
  const customIconStyle = getCustomScalingIconStyle(normalizedCustomScaling)
  const customFieldsId = `${pickerId}-custom-fields`

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
            {allowedScalingTypes.map(nextScaling => {
              const scalingIconStyle = getScalingButtonIconStyle(nextScaling, normalizedCustomScaling)
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
          {scaling === 'custom' ? (
            <span className={styles.customFields} id={customFieldsId}>
              <label className={styles.customNameRow}>
                <span>Name</span>
                <input type="text" value={customScalingDraft.name} maxLength={80} aria-label={`${label} custom scaling name`} onChange={handleCustomNameChange} />
              </label>
              <span className={styles.customControlRow}>
                <button type="button" className={styles.customIconButton} aria-label={`${label} custom scaling icon`} onClick={() => setIsIconModalOpen(true)}>
                  <span aria-hidden="true" style={customIconStyle} />
                </button>
                <label className={styles.customColorInput}>
                  <span className={styles.srOnly}>{label} custom scaling color</span>
                  <input type="color" value={normalizedCustomScaling.color} aria-label={`${label} custom scaling color`} onChange={handleCustomColorChange} />
                </label>
                <span className={styles.customSwatches} aria-label={`${label} custom scaling color presets`}>
                  {SCALING_COLOR_SWATCHES.map(swatch => (
                    <button
                      key={swatch.id}
                      type="button"
                      style={{ backgroundColor: swatch.value }}
                      aria-label={`${swatch.label} custom scaling color`}
                      aria-pressed={normalizedCustomScaling.color.toLowerCase() === swatch.value}
                      onClick={() => updateCustomScaling({ color: swatch.value })}
                    />
                  ))}
                </span>
              </span>
            </span>
          ) : null}
        </span>
      ) : null}
      {isIconModalOpen ? (
        <IconSearchModal
          groups={CUSTOM_SCALING_ABILITY_ICON_GROUPS}
          statGroups={PROPERTY_ICON_GROUPS}
          search={iconSearch}
          selectedIconColor={normalizedCustomScaling.color}
          title={`${label} custom scaling icon selector`}
          testId="custom-scaling-icon-modal"
          searchPlaceholder="Search ability or property icons"
          previewMode="ability"
          closeLabel={`Close ${label} custom scaling icon selector`}
          onIconColorChange={color => updateCustomScaling({ color })}
          onSearch={setIconSearch}
          onSelect={handleCustomIconSelect}
          onClose={() => setIsIconModalOpen(false)}
        />
      ) : null}
    </span>
  )
}
