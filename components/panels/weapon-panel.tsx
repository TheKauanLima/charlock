'use client'

import { useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'

import { formatPanelValue, getNextScaling } from '@/components/panels/scaling-utils'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import { buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'
import cn from '@/lib/utilsd'

import styles from './WeaponPanel.module.css'

interface WeaponPanelProps {
  weaponName?: string
  weaponDesc?: string
  secondaryWeaponDesc?: string
  gunImageSrc?: string
  weaponAttributes?: string[]
  weaponStats?: PanelStat[]
  statsSource?: StatsRow
  bulletDPS?: string | number | null
  weaponMinRange?: string | number | null
  weaponMaxRange?: string | number | null
  initialStats?: PanelStat[]
  secondaryStats?: PanelStat[]
  otherStats?: PanelStat[]
  showSecondaryWeapon?: boolean
  panelType?: 'weapon' | 'armor' | 'tech'
  isEditable?: boolean
  onStatsChange?: (stats: PanelStat[], changedStat: PanelStat) => void
}

interface CompactStatElementProps extends PanelStat {
  isEditable?: boolean
  panelType: 'weapon' | 'armor' | 'tech'
  onChange?: (updates: Partial<PanelStat>) => void
}

interface IconAsset {
  url?: string
  maskUrl?: string
  opacity?: number
}

interface PanelTheme {
  background: string
  iconColor: string
  labelClassName: string
  valueClassName: string
}

const PANEL_THEMES: Record<'weapon' | 'armor' | 'tech', PanelTheme> = {
  weapon: {
    background: '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_weapon_psd.png',
    iconColor: '#ff9100',
    labelClassName: styles.weaponLabel,
    valueClassName: styles.weaponValue,
  },
  armor: {
    background: '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_vitality_psd.png',
    iconColor: '#00ff99',
    labelClassName: styles.armorLabel,
    valueClassName: styles.armorValue,
  },
  tech: {
    background: '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_spirit_psd.png',
    iconColor: '#de9cff',
    labelClassName: styles.techLabel,
    valueClassName: styles.techValue,
  },
}

const ICON_ASSETS: Record<string, IconAsset> = {
  ammoClipSize: { maskUrl: '/panorama/images/icons/properties/ammo_clip_size.svg' },
  ammoReload: { maskUrl: '/panorama/images/icons/properties/ammo_reload.svg' },
  ammoReloadReduction: { maskUrl: '/panorama/images/icons/properties/ammo_reload.svg', opacity: 0.45 },
  bulletDamage: { url: '/panorama/images/icons/properties/damage_bullet_color.svg' },
  bulletVelocity: { maskUrl: '/panorama/images/icons/properties/bullet_velocity.svg' },
  critBonusScale: { url: '/panorama/images/icons/properties/damage_crit_color.svg' },
  fireRate: { maskUrl: '/panorama/images/icons/properties/fire_rate.svg' },
  healthStealBullets: { url: '/panorama/images/icons/properties/health_stealing_bullets_color.svg' },
  melee: { maskUrl: '/panorama/images/icons/properties/melee.svg' },
}

const DEFAULT_WEAPON_STATS: PanelStat[] = [
  { label: 'Bullet Damage', value: '3.6', unit: '', icon: 'bulletDamage', scaling: 'none', scalingValue: '0' },
  { label: 'Weapon Damage', value: '0', unit: '%', icon: 'dot', scaling: 'none', scalingValue: '0' },
  { label: 'Bullets per sec', value: '1.59', unit: '', icon: 'fireRate', scaling: 'none', scalingValue: '0' },
  { label: 'Fire Rate', value: '0', unit: '%', icon: 'fireRate', scaling: 'none', scalingValue: '0' },
  { label: 'Ammo', value: '9', unit: '', icon: 'ammoClipSize', scaling: 'none', scalingValue: '0' },
  { label: 'Clip Size Increase', value: '0', unit: '%', icon: 'ammoClipSize', scaling: 'none', scalingValue: '0' },
  { label: 'Reload Time', value: '0.35', unit: 's', icon: 'ammoReload', scaling: 'none', scalingValue: '0' },
  { label: 'Reload Reduction', value: '0', unit: '%', icon: 'ammoReloadReduction', scaling: 'none', scalingValue: '0' },
  { label: 'Bullet Velocity', value: '610', unit: 'm/s', icon: 'bulletVelocity', scaling: 'none', scalingValue: '0' },
  { label: 'Bullet Velocity Increase', value: '0', unit: '%', icon: 'bulletVelocity', scaling: 'none', scalingValue: '0' },
  { label: 'Bullet Lifesteal', value: '0', unit: '%', icon: 'healthStealBullets', scaling: 'none', scalingValue: '0' },
  { label: 'Crit Bonus Scale', value: '0', unit: '%', icon: 'critBonusScale', scaling: 'none', scalingValue: '0' },
  { label: 'Light Melee', value: '50', unit: '', icon: 'melee', scaling: 'none', scalingValue: '0' },
  { label: 'Heavy Melee', value: '116', unit: '', icon: 'melee', scaling: 'none', scalingValue: '0' },
]

function normalizeStat(stat: PanelStat): PanelStat {
  return {
    ...stat,
    scaling: stat.scaling ?? 'none',
    scalingValue: stat.scalingValue ?? '0',
  }
}

function splitRows(items: PanelStat[]) {
  const rows: PanelStat[][] = []

  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2))
  }

  return rows
}

function getIconStyle(icon: string | undefined, iconColor: string): CSSProperties {
  const asset = ICON_ASSETS[icon ?? 'dot']

  if (!asset) {
    return { backgroundColor: iconColor, borderRadius: '999px' }
  }

  if (asset.url) {
    return {
      backgroundColor: 'transparent',
      backgroundImage: `url('${asset.url}')`,
      opacity: asset.opacity,
    }
  }

  return {
    backgroundColor: iconColor,
    WebkitMaskImage: `url('${asset.maskUrl}')`,
    maskImage: `url('${asset.maskUrl}')`,
    opacity: asset.opacity,
  }
}

function CompactStatElement({ label, value, unit = '', icon = 'dot', scaling = 'none', scalingValue = '0', isEditable = false, panelType, onChange }: CompactStatElementProps) {
  const theme = PANEL_THEMES[panelType]

  function handleScalingClick() {
    const nextScaling = getNextScaling(scaling)

    onChange?.({
      scaling: nextScaling,
      scalingValue: nextScaling === 'none' ? '0' : scalingValue,
    })
  }

  function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.({ value: event.target.value })
  }

  return (
    <button
      type="button"
      className={cn(
        styles.statCell,
        isEditable && styles.editableCell,
      )}
      onClick={handleScalingClick}
      data-scaling={scaling}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      <span
        className={styles.statIcon}
        style={getIconStyle(icon, theme.iconColor)}
        aria-hidden="true"
      />
      <span className={styles.statContent}>
        {isEditable ? (
          <input
            type="text"
            className={cn(styles.statInput, theme.valueClassName)}
            value={value}
            onChange={handleValueChange}
            placeholder="0"
            onClick={event => event.stopPropagation()}
            aria-label={`${label} value`}
          />
        ) : (
          <span className={cn(styles.statValue, theme.valueClassName)}>{formatPanelValue(value)}</span>
        )}
        {unit ? <span className={styles.statUnit}>{unit}</span> : null}
        <span className={cn(styles.statLabel, theme.labelClassName)}>{label}</span>
      </span>
      <ScalingValueEditor scaling={scaling} scalingValue={scalingValue} isEditable={isEditable} onChange={nextScalingValue => onChange?.({ scalingValue: nextScalingValue })} />
    </button>
  )
}

export default function WeaponPanel({
  weaponName = 'Generic Gun',
  weaponDesc = 'Weapon description',
  gunImageSrc = '/panorama/images/hud/abilities/weapon_damage_psd.png',
  weaponAttributes = [],
  weaponStats,
  statsSource,
  bulletDPS = null,
  weaponMinRange = null,
  weaponMaxRange = null,
  initialStats = [],
  secondaryStats = [],
  otherStats = [],
  showSecondaryWeapon = true,
  panelType = 'weapon',
  isEditable = false,
  onStatsChange,
}: WeaponPanelProps) {
  const theme = PANEL_THEMES[panelType]
  const sourceStats = weaponStats ?? (statsSource ? buildWeaponStatsArray(statsSource) : DEFAULT_WEAPON_STATS)
  const combinedWeaponStats = sourceStats.length ? sourceStats : [...initialStats, ...secondaryStats, ...otherStats]
  const normalizedWeaponStats = combinedWeaponStats.map(stat => normalizeStat(stat))
  const [editedStats, setEditedStats] = useState<PanelStat[]>(() => normalizedWeaponStats)
  const displayStats = isEditable && onStatsChange ? normalizedWeaponStats : isEditable ? editedStats : normalizedWeaponStats
  const weaponStatRows = splitRows(displayStats)
  const primaryWeaponStatRows = weaponStatRows.slice(0, -1)
  const bottomWeaponStatRows = weaponStatRows.slice(-1)
  const hasFalloffRange = weaponMinRange !== null || weaponMaxRange !== null

  function handleStatChange(index: number, updates: Partial<PanelStat>) {
    const nextStats = displayStats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat))

    if (onStatsChange) {
      onStatsChange(nextStats, nextStats[index])
      return
    }

    setEditedStats(nextStats)
  }

  return (
    <section
      className={styles.panel}
      aria-label={`${weaponName} weapon stats`}
      data-testid="weapon-panel"
      data-secondary-visible={showSecondaryWeapon}
    >
      <span className={styles.background} style={{ backgroundImage: `url('${theme.background}')` }} aria-hidden="true" />

      <div className={styles.header}>
        <span className={styles.gunImage} role="img" aria-label={`${weaponName} weapon`} style={{ backgroundImage: `url('${gunImageSrc}')` }} />

        <div className={styles.headerContent}>
          <span className={styles.eyebrow}>Weapon Stats</span>
          <span className={styles.weaponName}>{weaponName}</span>
          <div className={styles.attributes} aria-label="Weapon attributes">
            {weaponAttributes.map(attribute => (
              <span key={attribute} className={styles.attribute}>
                {attribute}
              </span>
            ))}
          </div>
        </div>

        {bulletDPS !== null ? (
          <div className={styles.dps}>
            <span className={styles.dpsIcon} aria-hidden="true" />
            <span className={styles.inlineValue}>
              <span>{formatPanelValue(bulletDPS)}</span>
              <span className={styles.mutedUnit}>DPS</span>
            </span>
          </div>
        ) : null}

        {hasFalloffRange ? (
          <div className={styles.falloff}>
            <span className={styles.falloffLabel}>Falloff Range</span>
            <div className={styles.falloffValues}>
              {weaponMinRange !== null ? (
                <span className={styles.falloffValueFirst}>
                  <span className={styles.inlineValue}>
                    <span>{formatPanelValue(weaponMinRange)}</span>
                    <span className={styles.mutedUnit}>m</span>
                  </span>
                </span>
              ) : null}
              <span className={styles.falloffArrow} aria-hidden="true" />
              {weaponMaxRange !== null ? (
                <span className={styles.falloffValue}>
                  <span className={styles.inlineValue}>
                    <span>{formatPanelValue(weaponMaxRange)}</span>
                    <span className={styles.mutedUnit}>m</span>
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        {weaponDesc ? <p className={styles.description}>{weaponDesc}</p> : null}
        <div className={styles.rows}>
          {primaryWeaponStatRows.map((row, rowIndex) => (
            <div key={`weapon-row-${rowIndex}`} className={styles.row}>
              {row.map((stat, statIndex) => {
                const absoluteIndex = rowIndex * 2 + statIndex

                return (
                  <CompactStatElement
                    key={`weapon-stat-${stat.label}`}
                    {...stat}
                    panelType={panelType}
                    isEditable={isEditable}
                    onChange={updates => handleStatChange(absoluteIndex, updates)}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className={styles.bottomBand}>
          {bottomWeaponStatRows.map((row, rowIndex) => (
            <div key={`weapon-bottom-row-${rowIndex}`} className={styles.bottomRow}>
              {row.map((stat, statIndex) => {
                const absoluteIndex = primaryWeaponStatRows.length * 2 + rowIndex * 2 + statIndex

                return (
                  <CompactStatElement
                    key={`weapon-bottom-stat-${stat.label}`}
                    {...stat}
                    panelType={panelType}
                    isEditable={isEditable}
                    onChange={updates => handleStatChange(absoluteIndex, updates)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
