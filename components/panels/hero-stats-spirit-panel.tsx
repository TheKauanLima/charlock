'use client'

import type { ChangeEvent, CSSProperties } from 'react'

import { buildSpiritPowerStat, buildTopSpiritStatsArray } from '@/components/panels/spirit-stats-mapper'
import { formatPanelValue, getNextScaling } from '@/components/panels/scaling-utils'
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
  onStatsChange?: (stats: PanelStat[], changedStat: PanelStat) => void
  onSpiritPowerStatChange?: (stat: PanelStat) => void
}

interface SpiritStatCellProps extends PanelStat {
  isPower?: boolean
  isEditable?: boolean
  onChange?: (updates: Partial<PanelStat>) => void
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

function SpiritStatCell({ label, value, unit = '', icon = 'dot', scaling = 'none', scalingValue = '0', isPower = false, isEditable = false, onChange }: SpiritStatCellProps) {
  function handleClick() {
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
        styles.cell,
        isPower && styles.powerCell,
      )}
      data-scaling={scaling}
      onClick={handleClick}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
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
            onClick={event => event.stopPropagation()}
            aria-label={`${label} value`}
          />
        ) : (
          <span className={styles.value}>{formatPanelValue(value)}</span>
        )}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
        <span className={styles.label}>{label}</span>
      </span>
      <ScalingValueEditor scaling={scaling} scalingValue={scalingValue} isEditable={isEditable} onChange={nextScalingValue => onChange?.({ scalingValue: nextScalingValue })} />
    </button>
  )
}

export default function HeroStatsSpiritPanel({ statsSource, stats, spiritPowerStat: spiritPowerStatProp, isEditable = false, onStatsChange, onSpiritPowerStatChange }: HeroStatsSpiritPanelProps) {
  const topStats = stats ?? buildTopSpiritStatsArray(statsSource)
  const spiritPowerStat = spiritPowerStatProp ?? buildSpiritPowerStat(statsSource)

  function handleTopStatChange(index: number, updates: Partial<PanelStat>) {
    const nextStats = topStats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat))

    onStatsChange?.(nextStats, nextStats[index])
  }

  function handleSpiritPowerStatChange(updates: Partial<PanelStat>) {
    onSpiritPowerStatChange?.({
      ...spiritPowerStat,
      ...updates,
    })
  }

  return (
    <section
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
            <SpiritStatCell key={`spirit-top-${stat.label}`} {...stat} isEditable={isEditable} onChange={updates => handleTopStatChange(index, updates)} />
          ))}
        </div>
      </div>

      <section className={styles.powerSection} aria-label="Spirit power impact">
        <div className={styles.powerHeader}>
          <h3 className={styles.powerTitle}>Spirit Power Impact</h3>
        </div>
        <div className={styles.powerContent}>
          <SpiritStatCell {...spiritPowerStat} isPower isEditable={isEditable} onChange={handleSpiritPowerStatChange} />
          {spiritPowerStat.description ? <p className={styles.description}>{spiritPowerStat.description}</p> : null}
        </div>
      </section>
    </section>
  )
}
