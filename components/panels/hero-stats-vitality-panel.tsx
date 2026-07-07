'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, RefObject } from 'react'

import { formatPanelValue } from '@/components/panels/scaling-utils'
import ScalingPicker from '@/components/panels/scaling-picker'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import { buildVitalityStatsArray, normalizeVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

import styles from './HeroStatsVitalityPanel.module.css'

interface HeroStatsVitalityPanelProps {
  hero?: HeroDefinition
  statsSource?: StatsRow
  stats?: PanelStat[]
  isEditable?: boolean
  showDetails?: boolean
  onStatsChange?: (stats: PanelStat[], changedStat: PanelStat) => void
}

interface VitalityStatCellProps extends PanelStat {
  isBottom?: boolean
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
}

const VITALITY_PANEL_BACKGROUND = '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_vitality_psd.png'
const ICON_ASSETS: Record<string, IconAsset> = {
  bulletResist: { url: '/panorama/images/icons/properties/armor_bullet_color.svg' },
  critReduction: { url: '/panorama/images/icons/properties/damage_crit_color.svg' },
  debuffResist: { maskUrl: '/panorama/images/icons/properties/debuff_remove.svg' },
  healAmp: { maskUrl: '/panorama/images/icons/properties/healing_booster.svg' },
  healthRegen: { maskUrl: '/panorama/images/icons/properties/health_regen.svg' },
  lifestealEffectiveness: { maskUrl: '/panorama/images/icons/properties/health_steal.svg' },
  maxHealth: { maskUrl: '/panorama/images/icons/properties/health.svg' },
  meleeResist: { url: '/panorama/images/icons/properties/armor_melee_color.svg' },
  moveSpeed: { maskUrl: '/panorama/images/icons/properties/move_speed.svg' },
  moveSprint: { maskUrl: '/panorama/images/icons/properties/move_sprint.svg' },
  spiritResist: { url: '/panorama/images/icons/properties/armor_spirit_color.svg' },
  stamina: { maskUrl: '/panorama/images/icons/properties/move_stamina.svg' },
  staminaRecovery: { maskUrl: '/panorama/images/icons/properties/move_stamina_recharge.svg' },
}

function splitRows(items: PanelStat[]) {
  const rows: PanelStat[][] = []

  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2))
  }

  return rows
}

function getIconStyle(icon = 'dot'): CSSProperties {
  const asset = ICON_ASSETS[icon]

  if (!asset) {
    return { backgroundColor: '#00ff99', borderRadius: '999px' }
  }

  if (asset.url) {
    return {
      backgroundColor: 'transparent',
      backgroundImage: `url('${asset.url}')`,
    }
  }

  return {
    backgroundColor: '#00ff99',
    WebkitMaskImage: `url('${asset.maskUrl}')`,
    maskImage: `url('${asset.maskUrl}')`,
  }
}

function VitalityStatCell({ label, value, unit = '', icon = 'dot', scaling = 'none', scalingValue = '0', isBottom = false, isEditable = false, showDetails = false, boundaryRef, openScalingPickerId = null, onChange, onOpenScalingPickerChange }: VitalityStatCellProps) {
  function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.({ value: event.target.value })
  }

  const content = (
    <>
      <span
        className={styles.icon}
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
      <span className={styles.scalingWrap}>
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
      </span>
    </>
  )

  if (isEditable) {
    return (
      <div
        className={cn(styles.cell, styles.editableCell, isBottom && styles.bottomCell)}
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
        isBottom && styles.bottomCell,
      )}
      data-scaling={scaling}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      {content}
    </button>
  )
}

export default function HeroStatsVitalityPanel({ statsSource, stats, isEditable = false, showDetails = false, onStatsChange }: HeroStatsVitalityPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const sourceVitalityStats = stats ? normalizeVitalityStatsArray(stats) : buildVitalityStatsArray(statsSource)
  const [editedStats, setEditedStats] = useState<PanelStat[]>(() => sourceVitalityStats)
  const vitalityStats = isEditable && !onStatsChange ? editedStats : sourceVitalityStats
  const topRows = splitRows(vitalityStats.slice(0, 10))
  const bottomRows = splitRows(vitalityStats.slice(10))
  const [openScalingPickerId, setOpenScalingPickerId] = useState<string | null>(null)

  function handleStatChange(index: number, updates: Partial<PanelStat>) {
    const nextStats = vitalityStats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat))

    if (onStatsChange) {
      onStatsChange(nextStats, nextStats[index])
      return
    }

    setEditedStats(nextStats)
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      aria-label="Vitality stats"
      data-testid="hero-stats-vitality-panel"
    >
      <span className={styles.background} style={{ backgroundImage: `url('${VITALITY_PANEL_BACKGROUND}')` }} aria-hidden="true" />

      <header className={styles.header}>
        <h2 className={styles.title}>Vitality Stats</h2>
      </header>

      <div className={styles.topStats}>
        {topRows.map((row, rowIndex) => (
          <div key={`vitality-top-${rowIndex}`} className={styles.row}>
            {row.map((stat, statIndex) => (
              <VitalityStatCell key={`vitality-top-${stat.label}`} {...stat} isEditable={isEditable} showDetails={showDetails} boundaryRef={panelRef} openScalingPickerId={openScalingPickerId} onOpenScalingPickerChange={setOpenScalingPickerId} onChange={updates => handleStatChange(rowIndex * 2 + statIndex, updates)} />
            ))}
          </div>
        ))}
      </div>

      <div className={styles.bottomStats}>
        {bottomRows.map((row, rowIndex) => (
          <div key={`vitality-bottom-${rowIndex}`} className={styles.bottomRow}>
            {row.map((stat, statIndex) => (
              <VitalityStatCell key={`vitality-bottom-${stat.label}`} {...stat} isBottom isEditable={isEditable} showDetails={showDetails} boundaryRef={panelRef} openScalingPickerId={openScalingPickerId} onOpenScalingPickerChange={setOpenScalingPickerId} onChange={updates => handleStatChange(10 + rowIndex * 2 + statIndex, updates)} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
