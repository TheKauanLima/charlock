'use client'

import type { ChangeEvent, CSSProperties } from 'react'

import { buildSpiritPowerStat, buildTopSpiritStatsArray } from '@/components/panels/spirit-stats-mapper'
import { formatPanelValue, getNextScaling } from '@/components/panels/scaling-utils'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

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
        'relative z-[1] flex min-h-9 cursor-pointer items-center gap-1.5 overflow-visible rounded-[3px] border-0 bg-black/20 px-2 py-1.5 text-left font-sans text-white hover:bg-white/[0.04]',
        isPower && 'min-h-[42px] items-start p-2',
      )}
      data-scaling={scaling}
      onClick={handleClick}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      <span
        className={cn('inline-block size-[18px] shrink-0 bg-center bg-contain bg-no-repeat [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]', isPower && 'mt-0.5')}
        style={getIconStyle(icon)}
        aria-hidden="true"
      />
      <span className="flex w-full min-w-0 items-baseline gap-1 overflow-visible font-sans leading-tight">
        {isEditable ? (
          <input
            type="text"
            className="w-auto min-w-8 max-w-16 shrink-0 border-0 border-b border-dashed border-white/55 bg-transparent px-0 py-0 text-lg font-bold leading-none text-white outline-none transition focus:border-[#de9cff] focus:bg-transparent"
            value={value}
            onChange={handleValueChange}
            onClick={event => event.stopPropagation()}
            aria-label={`${label} value`}
          />
        ) : (
          <span className="shrink-0 text-lg font-bold text-white">{formatPanelValue(value)}</span>
        )}
        {unit ? <span className="shrink-0 text-[15px] font-semibold text-white/45">{unit}</span> : null}
        <span className="min-w-0 whitespace-normal break-words text-sm leading-[1.05] font-medium text-[#f0d7ff]/95">{label}</span>
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
      className="relative isolate overflow-hidden rounded-lg bg-[rgba(12,10,8,0.86)] text-white before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:bg-[linear-gradient(rgb(255_255_255_/_2%)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_2%)_1px,transparent_1px)] before:bg-[length:18px_18px] before:opacity-40"
      aria-label="Spirit stats"
      data-testid="hero-stats-spirit-panel"
    >
      <span className="absolute inset-0 z-[-2] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${SPIRIT_PANEL_BACKGROUND}')` }} aria-hidden="true" />

      <header className="relative z-[1] px-4 pt-3.5 pb-1.5">
        <h2 className="block font-serif text-lg font-semibold uppercase tracking-[0.02em] opacity-70">Spirit Stats</h2>
      </header>

      <div className="relative z-[1] flex flex-col gap-1 px-4 pb-3.5">
        <div className="grid w-full grid-cols-1 gap-1 min-[900px]:grid-cols-2">
          {topStats.map((stat, index) => (
            <SpiritStatCell key={`spirit-top-${stat.label}`} {...stat} isEditable={isEditable} onChange={updates => handleTopStatChange(index, updates)} />
          ))}
        </div>
      </div>

      <section className="relative z-[1] mt-0.5 overflow-hidden rounded-b-lg bg-black/40" aria-label="Spirit power impact">
        <div className="px-4 pt-3.5 pb-1.5">
          <h3 className="block font-serif text-[11px] font-semibold uppercase tracking-[0.02em] opacity-70">Spirit Power Impact</h3>
        </div>
        <div className="flex flex-col gap-1 px-4 pb-3.5">
          <SpiritStatCell {...spiritPowerStat} isPower isEditable={isEditable} onChange={handleSpiritPowerStatChange} />
          {spiritPowerStat.description ? <p className="px-0 py-1 text-[13px] leading-[1.3] text-white/70">{spiritPowerStat.description}</p> : null}
        </div>
      </section>
    </section>
  )
}
