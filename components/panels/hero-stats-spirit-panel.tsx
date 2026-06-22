'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, RefObject } from 'react'

import { buildSpiritPowerStat, buildTopSpiritStatsArray } from '@/components/panels/spirit-stats-mapper'
import { formatPanelValue } from '@/components/panels/scaling-utils'
import ScalingPicker from '@/components/panels/scaling-picker'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

import styles from './HeroStatsSpiritPanel.module.css'

interface HeroStatsSpiritPanelProps {
  hero?: HeroDefinition
  statsSource?: StatsRow
  stats?: PanelStat[]
  spiritPowerStat?: PanelStat
  isEditable?: boolean
  showDetails?: boolean
  onStatsChange?: (stats: PanelStat[], changedStat: PanelStat) => void
  onSpiritPowerStatChange?: (stat: PanelStat) => void
}

interface SpiritStatCellProps extends PanelStat {
  isPower?: boolean
  isEditable?: boolean
  showDetails?: boolean
  boundaryRef?: RefObject<HTMLElement | null>
  openScalingPickerId?: string | null
  onChange?: (updates: Partial<PanelStat>) => void
  onOpenScalingPickerChange?: (pickerId: string | null) => void
}

interface IconAsset {
  url?: string
  maskUrl?: string
  opacity?: number
}

const SPIRIT_PANEL_BACKGROUND = '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_spirit_psd.png'
const ICON_ASSETS: Record<string, IconAsset> = {
  abilityCooldown: { maskUrl: '/panorama/images/icons/properties/cooldown.svg' },
  abilityDuration: { maskUrl: '/panorama/images/icons/properties/duration.svg' },
  abilityRange: { maskUrl: '/panorama/images/icons/properties/range.svg' },
  chargeCooldown: { maskUrl: '/panorama/images/icons/properties/recharge.svg' },
  maxCharges: { maskUrl: '/panorama/images/icons/properties/charge.svg' },
  spiritLifesteal: { url: '/panorama/images/icons/properties/health_stealing_spirit_color.svg' },
  spiritPower: { maskUrl: '/panorama/images/icons/properties/spirit.svg' },
}

function getIconStyle(icon = 'dot'): CSSProperties {
  const asset = ICON_ASSETS[icon]

  if (!asset) {
    return { backgroundColor: '#de9cff', borderRadius: '999px' }
  }

  if (asset.url) {
    return {
      backgroundColor: 'transparent',
      backgroundImage: `url('${asset.url}')`,
    }
  }

  return {
    backgroundColor: '#de9cff',
    WebkitMaskImage: `url('${asset.maskUrl}')`,
    maskImage: `url('${asset.maskUrl}')`,
    opacity: asset.opacity,
  }
}

function SpiritStatCell({ label, value, unit = '', icon = 'dot', scaling = 'none', scalingValue = '0', isPower = false, isEditable = false, showDetails = false, boundaryRef, openScalingPickerId = null, onChange, onOpenScalingPickerChange }: SpiritStatCellProps) {
  function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.({ value: event.target.value })
  }

  const content = (
    <>
      <span
        className={cn(styles.icon, isPower && styles.powerIcon)}
        style={getIconStyle(icon)}
        aria-hidden="true"
      />
      <span className={styles.content}>
        {isEditable ? (
          <input
            type="text"
            className={styles.input}
            value={value}
            onChange={handleValueChange}
            placeholder="0"
            aria-label={`${label} value`}
          />
        ) : (
          <span className={styles.value}>{formatPanelValue(value)}</span>
        )}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
        <span className={styles.label}>{label}</span>
      </span>
      {isEditable && onOpenScalingPickerChange ? (
        <ScalingPicker
          label={label}
          scaling={scaling}
          scalingValue={scalingValue}
          boundaryRef={boundaryRef}
          openPickerId={openScalingPickerId}
          onChange={updates => onChange?.(updates)}
          onOpenPickerChange={onOpenScalingPickerChange}
        />
      ) : (
        <ScalingValueEditor scaling={scaling} scalingValue={scalingValue} showValue={showDetails} position="raised" />
      )}
    </>
  )

  if (isEditable) {
    return (
      <div
        className={cn(styles.cell, styles.editableCell, isPower && styles.powerCell)}
        data-scaling={scaling}
        role="group"
        aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        styles.cell,
        isPower && styles.powerCell,
      )}
      data-scaling={scaling}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      {content}
    </button>
  )
}

export default function HeroStatsSpiritPanel({ statsSource, stats, spiritPowerStat: spiritPowerStatProp, isEditable = false, showDetails = false, onStatsChange, onSpiritPowerStatChange }: HeroStatsSpiritPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const sourceTopStats = stats ?? buildTopSpiritStatsArray(statsSource)
  const sourceSpiritPowerStat = spiritPowerStatProp ?? buildSpiritPowerStat(statsSource)
  const [editedTopStats, setEditedTopStats] = useState<PanelStat[]>(() => sourceTopStats)
  const [editedSpiritPowerStat, setEditedSpiritPowerStat] = useState<PanelStat>(() => sourceSpiritPowerStat)
  const topStats = isEditable && !onStatsChange ? editedTopStats : sourceTopStats
  const spiritPowerStat = isEditable && !onSpiritPowerStatChange ? editedSpiritPowerStat : sourceSpiritPowerStat
  const [openScalingPickerId, setOpenScalingPickerId] = useState<string | null>(null)

  function handleTopStatChange(index: number, updates: Partial<PanelStat>) {
    const nextStats = topStats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat))

    if (onStatsChange) {
      onStatsChange(nextStats, nextStats[index])
      return
    }

    setEditedTopStats(nextStats)
  }

  function handleSpiritPowerStatChange(updates: Partial<PanelStat>) {
    const nextStat = {
      ...spiritPowerStat,
      ...updates,
    }

    if (onSpiritPowerStatChange) {
      onSpiritPowerStatChange(nextStat)
      return
    }

    setEditedSpiritPowerStat(nextStat)
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      aria-label="Spirit stats"
      data-testid="hero-stats-spirit-panel"
    >
      <span className={styles.background} style={{ backgroundImage: `url('${SPIRIT_PANEL_BACKGROUND}')` }} aria-hidden="true" />

      <header className={styles.header}>
        <h2 className={styles.title}>Spirit Stats</h2>
      </header>

      <div className={styles.topStats}>
        <div className={styles.row}>
          {topStats.map((stat, index) => (
            <SpiritStatCell key={`spirit-top-${stat.label}`} {...stat} isEditable={isEditable} showDetails={showDetails} boundaryRef={panelRef} openScalingPickerId={openScalingPickerId} onOpenScalingPickerChange={setOpenScalingPickerId} onChange={updates => handleTopStatChange(index, updates)} />
          ))}
        </div>
      </div>

      <section className={styles.powerSection} aria-label="Spirit power impact">
        <div className={styles.powerHeader}>
          <h3 className={styles.powerTitle}>Spirit Power Impact</h3>
        </div>
        <div className={styles.powerContent}>
          <SpiritStatCell {...spiritPowerStat} isPower isEditable={isEditable} showDetails={showDetails} boundaryRef={panelRef} openScalingPickerId={openScalingPickerId} onOpenScalingPickerChange={setOpenScalingPickerId} onChange={handleSpiritPowerStatChange} />
          {spiritPowerStat.description ? <p className={styles.description}>{spiritPowerStat.description}</p> : null}
        </div>
      </section>
    </section>
  )
}
