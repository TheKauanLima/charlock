'use client'

import type { ChangeEvent, CSSProperties } from 'react'

import { formatPanelValue, getNextScaling } from '@/components/panels/scaling-utils'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import { buildVitalityStatsArray } from '@/components/panels/vitality-stats-mapper'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import cn from '@/lib/utilsd'
import type { HeroDefinition } from '@/lib/hero-data'

interface HeroStatsVitalityPanelProps {
  hero?: HeroDefinition
  statsSource?: StatsRow
  stats?: PanelStat[]
  isEditable?: boolean
  onStatsChange?: (stats: PanelStat[], changedStat: PanelStat) => void
}

interface VitalityStatCellProps extends PanelStat {
  isBottom?: boolean
  isEditable?: boolean
  onChange?: (updates: Partial<PanelStat>) => void
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

function VitalityStatCell({ label, value, unit = '', icon = 'dot', scaling = 'none', scalingValue = '0', isBottom = false, isEditable = false, onChange }: VitalityStatCellProps) {
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
        'relative z-[1] flex min-h-9 cursor-pointer items-center gap-1.5 overflow-visible rounded-[3px] border-0 bg-black/[0.22] px-2 py-1.5 text-left font-sans text-[#f3f7ef] hover:bg-white/[0.04]',
        isBottom && 'bg-transparent before:pointer-events-none before:absolute before:inset-0 before:bg-black before:opacity-20',
      )}
      data-scaling={scaling}
      onClick={handleClick}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      <span
        className="relative z-[1] inline-block size-[18px] shrink-0 bg-center bg-contain bg-no-repeat [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
        style={getIconStyle(icon)}
        aria-hidden="true"
      />
      <span className="relative z-[1] flex w-full min-w-0 items-baseline gap-1 overflow-visible font-sans leading-tight">
        {isEditable ? (
          <input
            type="text"
            className="w-auto min-w-8 max-w-16 shrink-0 border-0 border-b border-dashed border-[#f3f7ef]/55 bg-transparent px-0 py-0 text-lg font-bold leading-none text-[#f3f7ef] outline-none transition focus:border-[#2fc890] focus:bg-transparent"
            value={value}
            onChange={handleValueChange}
            onClick={event => event.stopPropagation()}
            aria-label={`${label} value`}
          />
        ) : (
          <span className="shrink-0 text-lg font-bold text-[#f3f7ef]">{formatPanelValue(value)}</span>
        )}
        {unit ? <span className="shrink-0 text-[15px] font-semibold text-[#f3f7ef]/60">{unit}</span> : null}
        <span className="min-w-0 whitespace-normal break-words text-sm leading-[1.05] font-medium text-[#f3f7ef]/90">{label}</span>
      </span>
      <span className="relative z-[1]">
        <ScalingValueEditor scaling={scaling} scalingValue={scalingValue} isEditable={isEditable} onChange={nextScalingValue => onChange?.({ scalingValue: nextScalingValue })} />
      </span>
    </button>
  )
}

export default function HeroStatsVitalityPanel({ statsSource, stats, isEditable = false, onStatsChange }: HeroStatsVitalityPanelProps) {
  const vitalityStats = stats ?? buildVitalityStatsArray(statsSource)
  const topRows = splitRows(vitalityStats.slice(0, 9))
  const bottomRows = splitRows(vitalityStats.slice(9))

  function handleStatChange(index: number, updates: Partial<PanelStat>) {
    const nextStats = vitalityStats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat))

    onStatsChange?.(nextStats, nextStats[index])
  }

  return (
    <section
      className="relative isolate overflow-hidden rounded-lg bg-[rgba(12,10,8,0.86)] text-[#f3f7ef] before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:bg-[linear-gradient(rgb(255_255_255_/_2%)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_2%)_1px,transparent_1px)] before:bg-[length:18px_18px] before:opacity-40"
      aria-label="Vitality stats"
      data-testid="hero-stats-vitality-panel"
    >
      <span className="absolute inset-0 z-[-2] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${VITALITY_PANEL_BACKGROUND}')` }} aria-hidden="true" />

      <header className="relative z-[1] px-4 pt-3.5 pb-1.5">
        <h2 className="block font-serif text-lg font-semibold uppercase tracking-[0.02em] opacity-70">Vitality Stats</h2>
      </header>

      <div className="relative z-[1] flex flex-col gap-1 px-4 pb-3.5">
        {topRows.map((row, rowIndex) => (
          <div key={`vitality-top-${rowIndex}`} className="grid grid-cols-1 gap-1 min-[900px]:grid-cols-2">
            {row.map((stat, statIndex) => (
              <VitalityStatCell key={`vitality-top-${stat.label}`} {...stat} isEditable={isEditable} onChange={updates => handleStatChange(rowIndex * 2 + statIndex, updates)} />
            ))}
          </div>
        ))}
      </div>

      <div className="relative z-[1] mt-0.5 flex flex-col gap-1 overflow-hidden rounded-b-lg px-4 py-4 before:pointer-events-none before:absolute before:inset-0 before:bg-black before:opacity-20">
        {bottomRows.map((row, rowIndex) => (
          <div key={`vitality-bottom-${rowIndex}`} className="relative z-[1] grid grid-cols-1 gap-1 min-[900px]:grid-cols-2">
            {row.map((stat, statIndex) => (
              <VitalityStatCell key={`vitality-bottom-${stat.label}`} {...stat} isBottom isEditable={isEditable} onChange={updates => handleStatChange(9 + rowIndex * 2 + statIndex, updates)} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
