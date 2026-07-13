'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useState } from 'react'
import type { CSSProperties, ChangeEvent, PointerEvent } from 'react'

import { BOON_DEFAULT_STAT_COUNT, BOON_STAT_DEFINITIONS, buildBoonStatsArray, createBoonStat } from '@/components/panels/boon-stats-mapper'
import { formatPanelValue, type PanelStat } from '@/components/panels/scaling-utils'
import { PROPERTY_ICON_GROUPS } from '@/lib/editor-assets'
import {
  SQUARE_ICON_SIZE_OPTIONS,
  getSquareIconOption,
  getSquareIconStyle,
  getSquareIconToken,
  isSquareIcon,
  type SquareIconSize,
} from '@/lib/square-icon'

import styles from './HeroStatsBoonPanel.module.css'

interface HeroStatsBoonPanelProps {
  heroName: string
  stats?: PanelStat[]
  isEditable?: boolean
  onStatsChange?: (stats: PanelStat[]) => void
}

const ICON_PATHS: Record<string, string> = {
  damage_bullet_color: '/panorama/images/icons/properties/damage_bullet_color.svg',
  damage_melee_color: '/panorama/images/icons/properties/damage_melee_color.svg',
  damage_magic_color: '/panorama/images/icons/properties/damage_magic_color.svg',
  health: '/panorama/images/icons/properties/health.svg',
}

const BOON_ICON_COLOR_SWATCHES = [
  { id: 'default', label: 'Default', value: '' },
  { id: 'green', label: 'Green', value: '#2e9860' },
  { id: 'freshGreen', label: 'Fresh Green', value: '#84c955' },
  { id: 'olive', label: 'Olive', value: '#919814' },
  { id: 'amber', label: 'Amber', value: '#e5a535' },
  { id: 'spirit', label: 'Spirit', value: '#7e61a1' },
  { id: 'cream', label: 'Cream', value: '#f5eadb' },
] as const

function getNextCustomBoonStatLabel(stats: PanelStat[]) {
  const baseLabel = 'Extra Stat'
  const usedLabels = new Set(stats.map(stat => stat.label))

  if (!usedLabels.has(baseLabel)) {
    return baseLabel
  }

  for (let index = 2; index <= 20; index += 1) {
    const label = `${baseLabel} ${index}`

    if (!usedLabels.has(label)) {
      return label
    }
  }

  return `${baseLabel} ${stats.length + 1}`
}

function getIconPath(icon: string | undefined) {
  if (isSquareIcon(icon)) {
    return icon
  }

  if (icon?.startsWith('/')) {
    return icon
  }

  return ICON_PATHS[icon ?? ''] ?? ICON_PATHS.damage_magic_color
}

function getDefaultIconForIndex(index: number) {
  return BOON_STAT_DEFINITIONS[index]?.icon ?? createBoonStat().icon ?? 'damage_magic_color'
}

function isIntrinsicColorPropertyIcon(pathOrName: string) {
  if (isSquareIcon(pathOrName)) {
    return false
  }

  const fileName = pathOrName.split('/').at(-1)?.toLowerCase() ?? pathOrName.toLowerCase()

  return fileName.includes('color') || fileName.endsWith('.png')
}

function getIconVisualStyle(icon: string | undefined, iconColor = ''): CSSProperties {
  const iconPath = getIconPath(icon)

  if (isSquareIcon(iconPath)) {
    return getSquareIconStyle(iconPath, iconColor || '#fff8ec', 'stat')
  }

  if (isIntrinsicColorPropertyIcon(iconPath)) {
    return {
      backgroundImage: `url('${iconPath}')`,
    }
  }

  return {
    backgroundColor: iconColor || '#fff8ec',
    WebkitMaskImage: `url('${iconPath}')`,
    maskImage: `url('${iconPath}')`,
  }
}

export default function HeroStatsBoonPanel({ heroName, stats, isEditable = false, onStatsChange }: HeroStatsBoonPanelProps) {
  const normalizedStats = buildBoonStatsArray(stats)
  const [iconTargetIndex, setIconTargetIndex] = useState<number | null>(null)
  const [squareIconSize, setSquareIconSize] = useState<SquareIconSize>('medium')
  const selectedIconColor = iconTargetIndex === null ? '' : normalizedStats[iconTargetIndex]?.iconColor ?? ''
  const squareIconOption = getSquareIconOption(squareIconSize)

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    onStatsChange?.(normalizedStats.map((stat, statIndex) => (
      statIndex === index ? { ...stat, value: event.target.value, scaling: 'boon', scalingValue: event.target.value } : stat
    )))
  }

  function handleLabelChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    onStatsChange?.(normalizedStats.map((stat, statIndex) => (
      statIndex === index ? { ...stat, label: event.target.value, scaling: 'boon', scalingValue: String(stat.value) } : stat
    )))
  }

  function handleAddStat() {
    onStatsChange?.([...normalizedStats, createBoonStat(getNextCustomBoonStatLabel(normalizedStats))])
  }

  function handleRemoveStat(index: number) {
    onStatsChange?.(normalizedStats.filter((_, statIndex) => statIndex !== index))
  }

  function handleIconChange(iconPath: string) {
    if (iconTargetIndex === null) {
      return
    }

    const iconColor = isIntrinsicColorPropertyIcon(iconPath) ? '' : selectedIconColor

    onStatsChange?.(normalizedStats.map((stat, statIndex) => (
      statIndex === iconTargetIndex ? { ...stat, icon: iconPath, iconColor, scaling: 'boon', scalingValue: String(stat.value) } : stat
    )))
    setIconTargetIndex(null)
  }

  function handleDefaultIconChange() {
    if (iconTargetIndex === null) {
      return
    }

    onStatsChange?.(normalizedStats.map((stat, statIndex) => (
      statIndex === iconTargetIndex ? { ...stat, icon: getDefaultIconForIndex(iconTargetIndex), iconColor: '', scaling: 'boon', scalingValue: String(stat.value) } : stat
    )))
    setIconTargetIndex(null)
  }

  function handleIconColorChange(iconColor: string) {
    if (iconTargetIndex === null) {
      return
    }

    onStatsChange?.(normalizedStats.map((stat, statIndex) => (
      statIndex === iconTargetIndex ? { ...stat, iconColor, scaling: 'boon', scalingValue: String(stat.value) } : stat
    )))
  }

  function handleIconPickerBackdropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIconTargetIndex(null)
    }
  }

  const iconPickerModal = iconTargetIndex !== null ? (
    <div className={styles.iconPickerBackdrop} role="dialog" aria-modal="true" aria-label="Boon stat icon selector" data-testid="boon-stat-icon-modal" onPointerDown={handleIconPickerBackdropPointerDown}>
      <div className={styles.iconPicker} data-testid="boon-stat-icon-picker">
        <header className={styles.iconPickerHeader}>
          <div>
            <h3>Choose Boon Stat Icon</h3>
            <p>{normalizedStats[iconTargetIndex]?.label ?? 'Boon stat'}</p>
          </div>
          <button type="button" aria-label="Close Boon stat icon selector" onClick={() => setIconTargetIndex(null)}>×</button>
        </header>
        <section className={styles.iconColorPicker} aria-label="Boon icon color">
          {BOON_ICON_COLOR_SWATCHES.map(swatch => (
            <button
              key={swatch.id}
              type="button"
              className={selectedIconColor === swatch.value ? styles.iconColorSwatchActive : undefined}
              style={swatch.value ? { backgroundColor: swatch.value } : undefined}
              aria-label={`${swatch.label} icon color`}
              aria-pressed={selectedIconColor === swatch.value}
              onClick={() => handleIconColorChange(swatch.value)}
            >
              {swatch.value ? null : 'Default'}
            </button>
          ))}
        </section>
        <section className={styles.squareIconPicker} aria-label="Boon square icon">
          <button type="button" className={styles.squareIconSelect} aria-label="Use Square Icon" onClick={() => handleIconChange(getSquareIconToken(squareIconSize))}>
            <span
              className={styles.squareIconPreview}
              aria-hidden="true"
              style={{
                width: squareIconOption.previewSize,
                height: squareIconOption.previewSize,
                backgroundColor: selectedIconColor || '#fff8ec',
              }}
            />
            <span>
              <strong>Square Icon</strong>
              <em>{squareIconOption.label}</em>
            </span>
          </button>
          <div className={styles.iconSizePicker} aria-label="Boon square icon size">
            {SQUARE_ICON_SIZE_OPTIONS.map(sizeOption => (
              <button
                key={sizeOption.id}
                type="button"
                className={squareIconSize === sizeOption.id ? styles.iconSizeSwatchActive : undefined}
                aria-label={`${sizeOption.label} square icon size`}
                aria-pressed={squareIconSize === sizeOption.id}
                onClick={() => setSquareIconSize(sizeOption.id)}
              >
                <span aria-hidden="true" style={{ width: sizeOption.swatchSize, height: sizeOption.swatchSize }} />
                <em>{sizeOption.label}</em>
              </button>
            ))}
          </div>
        </section>
        <div className={styles.iconPickerDefault}>
          <button type="button" aria-label="Use Default Icon" onClick={handleDefaultIconChange}>
            <span aria-hidden="true" style={getIconVisualStyle(getDefaultIconForIndex(iconTargetIndex), '')} />
            <span>
              <strong>Default Icon</strong>
              <em>Native colors</em>
            </span>
          </button>
        </div>
        <div className={styles.iconPickerGrid}>
          {PROPERTY_ICON_GROUPS.flatMap(group => group.assets).map(asset => (
            <button key={asset.path} type="button" aria-label={`Use ${asset.label}`} onClick={() => handleIconChange(asset.path)}>
              <span aria-hidden="true" style={getIconVisualStyle(asset.path, selectedIconColor || '#ffffff')} />
              {asset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  return (
    <section className={styles.panel} data-testid="boon-rewards-panel" data-hero-stat-panel="true" aria-label={`${heroName} boon rewards`}>
      <header className={styles.header}>
        <h2 className={styles.title}>Boon Rewards</h2>
        <p className={styles.thresholdCopy}>At each threshold, {heroName} gains:</p>
        <div className={styles.unlockRow}>
          <Image className={styles.unlockIcon} src="/panorama/images/hud/unlock_icon.svg" alt="" width={32} height={32} data-testid="boon-unlock-icon" />
          <span className={styles.orText}>or</span>
          <span className={styles.apIcon} data-testid="boon-ap-icon" aria-hidden="true" />
          <span className={styles.unlockCopy}>
            <strong>Ability Unlock or AP</strong>
            <em>Abilities unlock at Boons 0, 2, 4 and 6</em>
          </span>
        </div>
      </header>

      <div className={styles.rewards}>
        <h3>Stat Increases</h3>
        <p>Rewards max at Boon 35</p>
        <div className={styles.grid}>
          {normalizedStats.map((stat, index) => {
            const isProtectedStat = index < BOON_DEFAULT_STAT_COUNT

            return (
            <div className={styles.stat} key={isProtectedStat ? `default-boon-stat-${index}` : `custom-boon-stat-${index}`}>
              <span className={styles.valueRow}>
                {isEditable ? (
                  <button type="button" className={styles.iconButton} aria-label={`Change ${stat.label || 'Boon stat'} icon`} onClick={() => setIconTargetIndex(index)}>
                    <span data-testid={stat.icon === 'health' ? 'boon-base-health-icon' : undefined} aria-hidden="true" style={getIconVisualStyle(stat.icon, stat.iconColor)} />
                  </button>
                ) : stat.icon === 'health' ? (
                  <span className={styles.healthIcon} data-testid="boon-base-health-icon" aria-hidden="true" />
                ) : (
                  <Image src={getIconPath(stat.icon)} alt="" width={23} height={23} />
                )}
                <span aria-hidden="true">+</span>
                {isEditable ? (
                  <input aria-label={`${stat.label} value`} value={stat.value} onChange={event => handleChange(index, event)} />
                ) : (
                  <strong>{formatPanelValue(stat.value)}</strong>
                )}
              </span>
              {isEditable ? (
                <label className={styles.customLabel}>
                  <span className={styles.srOnly}>Boon stat {index + 1} label</span>
                  <input aria-label={`Boon stat ${index + 1} label`} value={stat.label} onChange={event => handleLabelChange(index, event)} />
                </label>
              ) : (
                <span className={styles.statLabel}>{stat.label}</span>
              )}
              {isEditable && !isProtectedStat ? (
                <button type="button" className={styles.removeStatButton} aria-label={`Remove ${stat.label || 'Boon stat'}`} onClick={() => handleRemoveStat(index)}>
                  ×
                </button>
              ) : null}
            </div>
            )
          })}
        </div>
        {isEditable ? (
          <button type="button" className={styles.addStatButton} onClick={handleAddStat}>
            Add Boon Stat
          </button>
        ) : null}
      </div>

      {iconPickerModal && typeof document !== 'undefined' ? createPortal(iconPickerModal, document.body) : null}
    </section>
  )
}
