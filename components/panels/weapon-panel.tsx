'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'

import { formatPanelValue, normalizePanelScaling, PANEL_SCALING_TYPES } from '@/components/panels/scaling-utils'
import ScalingPicker from '@/components/panels/scaling-picker'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type { PanelStat, StatsRow } from '@/components/panels/scaling-utils'
import { buildPelletCountStat, buildWeaponStatsArray, PELLET_COUNT_LABEL } from '@/components/panels/weapon-stats-mapper'
import { getCharacterLimitMessage, getItemLimitMessage, notifyIfLimitedTextKeyDown, notifyIfLimitedTextPaste } from '@/lib/input-limit-feedback'
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
  showDetails?: boolean
  onStatsChange?: (stats: PanelStat[], changedStat: PanelStat) => void
  weaponAttributesText?: string
  weaponImageUploadControl?: ReactNode
  onWeaponNameChange?: (value: string) => void
  onWeaponDescChange?: (value: string) => void
  onWeaponAttributesTextChange?: (value: string) => void
  onWeaponMinRangeChange?: (value: string) => void
  onWeaponMaxRangeChange?: (value: string) => void
  onOpenWeaponAssetPicker?: () => void
  onBlockedAction?: (message: string) => void
}

interface CompactStatElementProps extends PanelStat {
  isEditable?: boolean
  showDetails?: boolean
  panelType: 'weapon' | 'armor' | 'tech'
  boundaryRef?: RefObject<HTMLElement | null>
  openScalingPickerId?: string | null
  openScalingAbove?: boolean
  onChange?: (updates: Partial<PanelStat>) => void
  onOpenScalingPickerChange?: (pickerId: string | null) => void
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
  damage_bullet_color: { url: '/panorama/images/icons/properties/damage_bullet_color.svg' },
  damage_magic_color: { url: '/panorama/images/icons/properties/damage_magic_color.svg' },
  damage_melee_color: { url: '/panorama/images/icons/properties/damage_melee_color.svg' },
  bulletVelocity: { maskUrl: '/panorama/images/icons/properties/bullet_velocity.svg' },
  critBonusScale: { url: '/panorama/images/icons/properties/damage_crit_color.svg' },
  fireRate: { maskUrl: '/panorama/images/icons/properties/fire_rate.svg' },
  healthStealBullets: { url: '/panorama/images/icons/properties/health_stealing_bullets_color.svg' },
  melee: { maskUrl: '/panorama/images/icons/properties/melee.svg' },
}

const BULLET_DAMAGE_TYPES = [
  { icon: 'damage_bullet_color', label: 'Bullet' },
  { icon: 'damage_magic_color', label: 'Magic' },
  { icon: 'damage_melee_color', label: 'Melee' },
] as const
const WEAPON_NAME_MAX_LENGTH = 120
const WEAPON_DESCRIPTION_MAX_LENGTH = 3000
const WEAPON_TAG_MAX_LENGTH = 80
const WEAPON_TAG_MAX_COUNT = 20

function getBulletDamageType(icon: string | undefined) {
  return BULLET_DAMAGE_TYPES.find(type => type.icon === icon) ?? BULLET_DAMAGE_TYPES[0]
}

function getNextBulletDamageIcon(icon: string | undefined) {
  const currentType = getBulletDamageType(icon)
  const currentIndex = BULLET_DAMAGE_TYPES.indexOf(currentType)

  return BULLET_DAMAGE_TYPES[(currentIndex + 1) % BULLET_DAMAGE_TYPES.length].icon
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
  const scaling = normalizePanelScaling(stat.scaling ?? 'none', stat.scalingValue ?? '0', stat.customScaling)

  return {
    ...stat,
    ...scaling,
  }
}

function splitRows(items: PanelStat[]) {
  const rows: PanelStat[][] = []

  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2))
  }

  return rows
}

function getDescriptionRows(value: string) {
  if (!value.trim()) {
    return 2
  }

  const estimatedRows = value
    .split('\n')
    .reduce((rows, line) => rows + Math.max(1, Math.ceil(line.length / 58)), 0)

  return Math.min(7, Math.max(2, estimatedRows))
}

function getEditableTagDraft(value: string) {
  const parts = value.split(',')
  const completed = parts.slice(0, -1).map(attribute => attribute.trim()).filter(Boolean)
  const active = (parts.at(-1) ?? '').trimStart()

  return { completed, active }
}

function serializeTagDraft(completed: string[], active: string, keepOpenTag = false) {
  const cleanCompleted = completed.map(attribute => attribute.trim()).filter(Boolean)
  const cleanActive = active.trimStart()

  if (cleanCompleted.length && cleanActive) {
    return `${cleanCompleted.join(', ')}, ${cleanActive}`
  }

  if (cleanCompleted.length && keepOpenTag) {
    return `${cleanCompleted.join(', ')}, `
  }

  if (cleanCompleted.length) {
    return cleanCompleted.join(', ')
  }

  return cleanActive
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

function CompactStatElement({ label, value, unit = '', icon = 'dot', scaling = 'none', scalingValue = '0', customScaling, isEditable = false, showDetails = false, panelType, boundaryRef, openScalingPickerId = null, openScalingAbove = false, onChange, onOpenScalingPickerChange }: CompactStatElementProps) {
  const theme = PANEL_THEMES[panelType]
  const bulletDamageType = getBulletDamageType(icon)
  const panelScaling = normalizePanelScaling(scaling, scalingValue, customScaling)

  function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.({ value: event.target.value })
  }

  const content = (
    <>
      {isEditable && label === 'Bullet Damage' ? (
        <button
          type="button"
          className={styles.damageTypeButton}
          aria-label={`Change Bullet Damage type (${bulletDamageType.label})`}
          title={`Damage type: ${bulletDamageType.label}. Click to change.`}
          onClick={() => onChange?.({ icon: getNextBulletDamageIcon(icon) })}
        >
          <span className={styles.statIcon} style={getIconStyle(icon, theme.iconColor)} aria-hidden="true" />
        </button>
      ) : (
        <span className={styles.statIcon} style={getIconStyle(icon, theme.iconColor)} aria-hidden="true" />
      )}
      <span className={styles.statContent}>
        {isEditable ? (
          <input
            type="text"
            className={cn(styles.statInput, theme.valueClassName)}
            value={value}
            onChange={handleValueChange}
            placeholder="0"
            aria-label={`${label} value`}
          />
        ) : (
          <span className={cn(styles.statValue, theme.valueClassName)}>{formatPanelValue(value)}</span>
        )}
        {unit ? <span className={styles.statUnit}>{unit}</span> : null}
        <span className={cn(styles.statLabel, theme.labelClassName)}>{label}</span>
      </span>
      {isEditable && onOpenScalingPickerChange ? (
        <ScalingPicker
          label={label}
          scaling={panelScaling.scaling}
          scalingValue={panelScaling.scalingValue}
          customScaling={panelScaling.customScaling}
          boundaryRef={boundaryRef}
          menuPosition={openScalingAbove ? 'above' : 'below'}
          openPickerId={openScalingPickerId}
          allowedScalingTypes={PANEL_SCALING_TYPES}
          onChange={updates => onChange?.(updates)}
          onOpenPickerChange={onOpenScalingPickerChange}
        />
      ) : (
        <ScalingValueEditor scaling={panelScaling.scaling} scalingValue={panelScaling.scalingValue} customScaling={panelScaling.customScaling} showValue={showDetails} position="raised" />
      )}
    </>
  )

  if (isEditable) {
    return (
      <div
        className={cn(styles.statCell, styles.editableCell)}
        data-scaling={panelScaling.scaling}
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
      className={styles.statCell}
      data-scaling={panelScaling.scaling}
      aria-label={`${label}: ${formatPanelValue(value)}${unit}`}
    >
      {content}
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
  showDetails = false,
  onStatsChange,
  weaponAttributesText,
  weaponImageUploadControl,
  onWeaponNameChange,
  onWeaponDescChange,
  onWeaponAttributesTextChange,
  onWeaponMinRangeChange,
  onWeaponMaxRangeChange,
  onOpenWeaponAssetPicker,
  onBlockedAction,
}: WeaponPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const theme = PANEL_THEMES[panelType]
  const sourceStats = weaponStats ?? (statsSource ? buildWeaponStatsArray(statsSource) : DEFAULT_WEAPON_STATS)
  const combinedWeaponStats = sourceStats.length ? sourceStats : [...initialStats, ...secondaryStats, ...otherStats]
  const normalizedWeaponStats = combinedWeaponStats.map(stat => normalizeStat(stat))
  const [editedStats, setEditedStats] = useState<PanelStat[]>(() => normalizedWeaponStats)
  const displayStats = isEditable && onStatsChange ? normalizedWeaponStats : isEditable ? editedStats : normalizedWeaponStats
  const pelletCountStat = displayStats.find(stat => stat.label === PELLET_COUNT_LABEL)
  const pelletCountStatIndex = pelletCountStat ? displayStats.indexOf(pelletCountStat) : -1
  const weaponStatRows = splitRows(displayStats.filter(stat => stat.label !== PELLET_COUNT_LABEL))
  const primaryWeaponStatRows = weaponStatRows.slice(0, -1)
  const bottomWeaponStatRows = weaponStatRows.slice(-1)
  const hasFalloffRange = weaponMinRange !== null || weaponMaxRange !== null || isEditable
  const editableAttributesText = weaponAttributesText ?? weaponAttributes.join(', ')
  const editableTagDraft = getEditableTagDraft(editableAttributesText)
  const editableTagPlaceholder = editableTagDraft.completed.length ? '' : 'TANK, BRAWLER, DEFENDER'
  const [openScalingPickerId, setOpenScalingPickerId] = useState<string | null>(null)

  function handleAttributeInputChange(value: string) {
    if (!onWeaponAttributesTextChange) {
      return
    }

    if (editableTagDraft.completed.length >= WEAPON_TAG_MAX_COUNT && value.trim()) {
      onBlockedAction?.(getItemLimitMessage('Weapon tags', WEAPON_TAG_MAX_COUNT))
      return
    }

    if (value.length > WEAPON_TAG_MAX_LENGTH) {
      onBlockedAction?.(getCharacterLimitMessage('Weapon tag', WEAPON_TAG_MAX_LENGTH))
    }

    if (value.includes(',')) {
      const parts = value.split(',')
      const incomingCompleted = parts.slice(0, -1).map(attribute => attribute.trim()).filter(Boolean)
      const remainingSlots = WEAPON_TAG_MAX_COUNT - editableTagDraft.completed.length

      if (incomingCompleted.length > remainingSlots) {
        onBlockedAction?.(getItemLimitMessage('Weapon tags', WEAPON_TAG_MAX_COUNT))
      }

      if (incomingCompleted.some(attribute => attribute.length > WEAPON_TAG_MAX_LENGTH) || (parts.at(-1) ?? '').trimStart().length > WEAPON_TAG_MAX_LENGTH) {
        onBlockedAction?.(getCharacterLimitMessage('Weapon tag', WEAPON_TAG_MAX_LENGTH))
      }

      const nextCompleted = [
        ...editableTagDraft.completed,
        ...incomingCompleted.map(attribute => attribute.slice(0, WEAPON_TAG_MAX_LENGTH)),
      ].slice(0, WEAPON_TAG_MAX_COUNT)
      const nextActive = nextCompleted.length >= WEAPON_TAG_MAX_COUNT ? '' : (parts.at(-1) ?? '').trimStart().slice(0, WEAPON_TAG_MAX_LENGTH)

      onWeaponAttributesTextChange(serializeTagDraft(nextCompleted, nextActive, /,\s*$/.test(value)))
      return
    }

    onWeaponAttributesTextChange(serializeTagDraft(editableTagDraft.completed, value.slice(0, WEAPON_TAG_MAX_LENGTH), value === '' && editableTagDraft.completed.length > 0))
  }

  function handleAttributeInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    notifyIfLimitedTextKeyDown(event, editableTagDraft.active, WEAPON_TAG_MAX_LENGTH, 'Weapon tag', onBlockedAction)

    if (event.key.length === 1 && editableTagDraft.completed.length >= WEAPON_TAG_MAX_COUNT && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      onBlockedAction?.(getItemLimitMessage('Weapon tags', WEAPON_TAG_MAX_COUNT))
      return
    }

    if (event.key !== 'Backspace' || editableTagDraft.active || editableTagDraft.completed.length === 0 || !onWeaponAttributesTextChange) {
      return
    }

    event.preventDefault()

    const nextCompleted = editableTagDraft.completed.slice(0, -1)
    const nextActive = editableTagDraft.completed.at(-1) ?? ''

    onWeaponAttributesTextChange(serializeTagDraft(nextCompleted, nextActive))
  }

  function handleStatChange(index: number, updates: Partial<PanelStat>) {
    const nextStats = displayStats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat))

    if (onStatsChange) {
      onStatsChange(nextStats, nextStats[index])
      return
    }

    setEditedStats(nextStats)
  }

  function setPelletCountEnabled(enabled: boolean) {
    const nextStats = enabled
      ? [...displayStats, buildPelletCountStat()]
      : displayStats.filter(stat => stat.label !== PELLET_COUNT_LABEL)
    const changedStat = pelletCountStat ?? buildPelletCountStat()

    if (onStatsChange) {
      onStatsChange(nextStats, changedStat)
      return
    }

    setEditedStats(nextStats)
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      aria-label={`${weaponName} weapon stats`}
      data-testid="weapon-panel"
      data-secondary-visible={showSecondaryWeapon}
    >
      <span className={styles.background} style={{ backgroundImage: `url('${theme.background}')` }} aria-hidden="true" />

      <div className={styles.header}>
        <span className={styles.gunImage} role="img" aria-label={`${weaponName} weapon`} style={{ backgroundImage: `url('${gunImageSrc}')` }}>
          {isEditable && (onOpenWeaponAssetPicker || weaponImageUploadControl) ? (
            <span className={styles.weaponImageActions} aria-label="Weapon image actions">
              {onOpenWeaponAssetPicker ? (
                <button type="button" className={styles.weaponImageAction} onClick={onOpenWeaponAssetPicker}>
                  Assets
                </button>
              ) : null}
              {weaponImageUploadControl ? <span className={styles.weaponImageUpload}>{weaponImageUploadControl}</span> : null}
            </span>
          ) : null}
        </span>

        <div className={styles.headerContent}>
          <span className={styles.eyebrow}>Weapon Stats</span>
          {isEditable && onWeaponNameChange ? (
            <input
              type="text"
              className={styles.weaponNameInput}
              value={weaponName}
              maxLength={WEAPON_NAME_MAX_LENGTH}
              onKeyDown={event => notifyIfLimitedTextKeyDown(event, weaponName, WEAPON_NAME_MAX_LENGTH, 'Weapon name', onBlockedAction)}
              onPaste={event => notifyIfLimitedTextPaste(event, weaponName, WEAPON_NAME_MAX_LENGTH, 'Weapon name', onBlockedAction)}
              onChange={event => onWeaponNameChange(event.target.value)}
              placeholder="Weapon name"
              aria-label="Weapon name"
            />
          ) : (
            <span className={styles.weaponName}>{weaponName}</span>
          )}
          <div className={styles.attributes} aria-label="Weapon attributes">
            {isEditable && onWeaponAttributesTextChange ? (
              <div className={styles.attributesEditor}>
                {editableTagDraft.completed.map((attribute, index) => (
                  <span key={`${attribute}-${index}`} className={styles.attribute}>
                    {attribute}
                  </span>
                ))}
                <span
                  className={cn(styles.attribute, styles.attributeInputSizer)}
                  data-tag-input-value={editableTagDraft.active || editableTagPlaceholder}
                >
                  <input
                    type="text"
                    className={styles.attributeInput}
                    value={editableTagDraft.active}
                    maxLength={WEAPON_TAG_MAX_LENGTH}
                    onPaste={event => notifyIfLimitedTextPaste(event, editableTagDraft.active, WEAPON_TAG_MAX_LENGTH, 'Weapon tag', onBlockedAction)}
                    onChange={event => handleAttributeInputChange(event.target.value)}
                    onKeyDown={handleAttributeInputKeyDown}
                    placeholder={editableTagPlaceholder}
                    aria-label="Weapon tags"
                  />
                </span>
              </div>
            ) : (
              weaponAttributes.map(attribute => (
                <span key={attribute} className={styles.attribute}>
                  {attribute}
                </span>
              ))
            )}
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
                    {isEditable && onWeaponMinRangeChange ? (
                      <input
                        type="text"
                        className={styles.falloffInput}
                        value={weaponMinRange}
                        onChange={event => onWeaponMinRangeChange(event.target.value)}
                        placeholder="0"
                        aria-label="Minimum falloff range"
                      />
                    ) : (
                      <span>{formatPanelValue(weaponMinRange)}</span>
                    )}
                    <span className={styles.mutedUnit}>m</span>
                  </span>
                </span>
              ) : null}
              <span className={styles.falloffArrow} aria-hidden="true" />
              {weaponMaxRange !== null ? (
                <span className={styles.falloffValue}>
                  <span className={styles.inlineValue}>
                    {isEditable && onWeaponMaxRangeChange ? (
                      <input
                        type="text"
                        className={styles.falloffInput}
                        value={weaponMaxRange}
                        onChange={event => onWeaponMaxRangeChange(event.target.value)}
                        placeholder="0"
                        aria-label="Maximum falloff range"
                      />
                    ) : (
                      <span>{formatPanelValue(weaponMaxRange)}</span>
                    )}
                    <span className={styles.mutedUnit}>m</span>
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        {isEditable && onWeaponDescChange ? (
          <textarea
            className={styles.descriptionInput}
            value={weaponDesc}
            maxLength={WEAPON_DESCRIPTION_MAX_LENGTH}
            onKeyDown={event => notifyIfLimitedTextKeyDown(event, weaponDesc, WEAPON_DESCRIPTION_MAX_LENGTH, 'Weapon description', onBlockedAction)}
            onPaste={event => notifyIfLimitedTextPaste(event, weaponDesc, WEAPON_DESCRIPTION_MAX_LENGTH, 'Weapon description', onBlockedAction)}
            onChange={event => onWeaponDescChange(event.target.value)}
            rows={getDescriptionRows(weaponDesc)}
            aria-label="Weapon description"
            placeholder="Describe this weapon..."
          />
        ) : weaponDesc ? (
          <p className={styles.description}>{weaponDesc}</p>
        ) : null}
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
                    showDetails={showDetails}
                    boundaryRef={panelRef}
                    openScalingPickerId={openScalingPickerId}
                    onOpenScalingPickerChange={setOpenScalingPickerId}
                    onChange={updates => handleStatChange(absoluteIndex, updates)}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {isEditable ? (
          <label className={styles.shotgunToggle}>
            <input
              type="checkbox"
              checked={Boolean(pelletCountStat)}
              onChange={event => setPelletCountEnabled(event.target.checked)}
            />
            <strong>Shotgun Pellets</strong>
          </label>
        ) : null}
        {pelletCountStat ? (
          <div className={styles.pelletBand} aria-label="Shotgun pellet stats">
            <CompactStatElement
              {...pelletCountStat}
              panelType={panelType}
              isEditable={isEditable}
              showDetails={showDetails}
              boundaryRef={panelRef}
              openScalingPickerId={openScalingPickerId}
              openScalingAbove
              onOpenScalingPickerChange={setOpenScalingPickerId}
              onChange={updates => handleStatChange(pelletCountStatIndex, updates)}
            />
          </div>
        ) : null}
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
                    showDetails={showDetails}
                    boundaryRef={panelRef}
                    openScalingPickerId={openScalingPickerId}
                    openScalingAbove
                    onOpenScalingPickerChange={setOpenScalingPickerId}
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
