'use client'

import { useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'

import { formatPanelValue, getNextScaling } from '@/components/panels/scaling-utils'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import { buildWeaponStatsArray } from '@/components/panels/weapon-stats-mapper'
import cn from '@/lib/utilsd'

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
  onSaveStats?: (stats: PanelStat[]) => void
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
    labelClassName: 'text-[#ffefd7]/95',
    valueClassName: 'text-[#ffefd7]',
  },
  armor: {
    background: '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_vitality_psd.png',
    iconColor: '#00ff99',
    labelClassName: 'text-[#f3f7ef]/90',
    valueClassName: 'text-[#f3f7ef]',
  },
  tech: {
    background: '/panorama/images/shop/catalog/catalog_tooltip_bg_modifies_spirit_psd.png',
    iconColor: '#de9cff',
    labelClassName: 'text-[#f0d7ff]/95',
    valueClassName: 'text-white',
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
        'relative z-[1] flex min-h-9 cursor-pointer items-center gap-1.5 overflow-visible rounded-[3px] border-0 bg-black/20 px-2 py-1.5 text-left font-sans text-white hover:bg-white/[0.04]',
        isEditable && 'border border-[#8a55b3]/30 bg-[#8a55b3]/15 hover:border-[#8a55b3]/40 hover:bg-[#8a55b3]/20',
      )}
      onClick={handleScalingClick}
      data-scaling={scaling}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      <span
        className="inline-block size-[18px] shrink-0 bg-center bg-contain bg-no-repeat [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
        style={getIconStyle(icon, theme.iconColor)}
        aria-hidden="true"
      />
      <span className="flex w-full min-w-0 items-baseline gap-1 overflow-visible font-sans leading-tight">
        {isEditable ? (
          <input
            type="text"
            className={cn('w-auto min-w-8 max-w-16 shrink-0 border-0 border-b border-dashed border-[#ffefd7]/55 bg-transparent px-0 py-0 font-sans text-lg font-bold leading-none outline-none transition focus:border-[#2fc890] focus:bg-transparent focus:shadow-none', theme.valueClassName)}
            value={value}
            onChange={handleValueChange}
            placeholder="0"
            onClick={event => event.stopPropagation()}
            aria-label={`${label} value`}
          />
        ) : (
          <span className={cn('shrink-0 text-lg font-bold', theme.valueClassName)}>{formatPanelValue(value)}</span>
        )}
        {unit ? <span className="shrink-0 text-[15px] font-semibold text-white/45">{unit}</span> : null}
        <span className={cn('min-w-0 whitespace-normal break-words text-sm leading-[1.05] font-medium', theme.labelClassName)}>{label}</span>
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
  onSaveStats,
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

  function handleSave() {
    onSaveStats?.(editedStats)
  }

  function handleCancel() {
    setEditedStats(normalizedWeaponStats)
  }

  return (
    <section
      className="relative isolate overflow-hidden rounded-lg bg-[rgba(12,10,8,0.86)] text-[#ffefd7] before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:bg-[linear-gradient(rgb(255_255_255_/_2%)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_2%)_1px,transparent_1px)] before:bg-[length:18px_18px] before:opacity-40"
      aria-label={`${weaponName} weapon stats`}
      data-testid="weapon-panel"
      data-secondary-visible={showSecondaryWeapon}
    >
      <span className="absolute inset-0 z-[-2] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${theme.background}')` }} aria-hidden="true" />

      <div className="relative z-[1] flex h-[110px] min-h-[110px] w-full overflow-visible bg-black/30">
        <span className="absolute top-0 right-0 h-[110px] w-[270px] bg-cover bg-center bg-no-repeat opacity-90 max-[900px]:opacity-35" role="img" aria-label={`${weaponName} weapon`} style={{ backgroundImage: `url('${gunImageSrc}')` }} />

        <div className="box-border w-full px-[15px] pt-[5px] pb-[15px]">
          <span className="block font-serif text-lg font-semibold uppercase tracking-[0.02em] opacity-70">Weapon Stats</span>
          <span className="mt-0.5 block font-sans text-[22px] font-bold">{weaponName}</span>
          <div className="flex min-h-[27px] w-[min(370px,calc(100%-140px))] flex-wrap max-[900px]:w-full" aria-label="Weapon attributes">
            {weaponAttributes.map(attribute => (
              <span key={attribute} className="mt-3 mr-2 rounded-[3px] bg-[rgba(16,19,13,0.5)] px-1.5 pb-px font-sans text-base font-bold">
                {attribute}
              </span>
            ))}
          </div>
        </div>

        {bulletDPS !== null ? (
          <div className="absolute top-[5px] right-2.5 z-[2] flex w-max max-w-[calc(100%-8px)] items-center justify-end gap-1 font-sans text-[105%] font-bold">
            <span className="block size-[18px] shrink-0 bg-[url('/panorama/images/icons/properties/damage_bullet_color.svg')] bg-contain bg-center bg-no-repeat" aria-hidden="true" />
            <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap leading-none">
              <span>{formatPanelValue(bulletDPS)}</span>
              <span className="text-[0.9em] font-bold text-white/45">DPS</span>
            </span>
          </div>
        ) : null}

        {hasFalloffRange ? (
          <div className="absolute right-0 bottom-0 flex w-max flex-col bg-[rgba(16,19,13,0.93)] px-1.5 pb-1">
            <span className="mx-auto mb-[-6px] block max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap text-center font-sans text-[13px] font-bold uppercase opacity-35">Falloff Range</span>
            <div className="flex w-max items-center justify-center gap-0.5">
              {weaponMinRange !== null ? (
                <span className="mr-[-12px] flex min-w-[50px] items-center justify-center bg-transparent px-1">
                  <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap font-sans font-bold">
                    <span>{formatPanelValue(weaponMinRange)}</span>
                    <span className="text-[0.9em] font-bold text-white/45">m</span>
                  </span>
                </span>
              ) : null}
              <span className="size-5 self-center bg-[url('/panorama/images/control_icons/arrow_right_png.png')] bg-contain" aria-hidden="true" />
              {weaponMaxRange !== null ? (
                <span className="flex min-w-[50px] items-center justify-center bg-transparent px-1">
                  <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap font-sans font-bold">
                    <span>{formatPanelValue(weaponMaxRange)}</span>
                    <span className="text-[0.9em] font-bold text-white/45">m</span>
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-[1] box-border flex w-full flex-col overflow-hidden rounded-b-lg bg-black/20 px-4 pt-3.5">
        {weaponDesc ? <p className="mt-[-2px] mb-2.5 font-sans text-base font-medium opacity-90">{weaponDesc}</p> : null}
        <div className="flex w-full flex-col gap-1">
          {primaryWeaponStatRows.map((row, rowIndex) => (
            <div key={`weapon-row-${rowIndex}`} className="grid w-full grid-cols-1 gap-1 min-[900px]:grid-cols-2">
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
        <div className="mt-3 -mr-4 -ml-4 flex flex-col gap-1 rounded-b-lg bg-black/25 px-4 py-4">
          {bottomWeaponStatRows.map((row, rowIndex) => (
            <div key={`weapon-bottom-row-${rowIndex}`} className="grid w-full grid-cols-1 gap-1 min-[900px]:grid-cols-2">
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
        {isEditable ? (
          <div className="mt-3 flex justify-end gap-2 border-t border-[#8a55b3]/20 pt-3">
            <button type="button" className="rounded-[3px] border-0 bg-green-600/80 px-4 py-1.5 font-sans text-sm font-semibold uppercase text-white/95 transition hover:bg-green-600 hover:shadow-[0_0_8px_rgba(76,175,80,0.4)]" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="rounded-[3px] border-0 bg-red-600/70 px-4 py-1.5 font-sans text-sm font-semibold uppercase text-white/95 transition hover:bg-red-600/90 hover:shadow-[0_0_8px_rgba(244,67,54,0.3)]" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
