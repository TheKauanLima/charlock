'use client'

import { Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'

import type { AbilityIconGroup, EditorAssetGroup } from '@/lib/editor-assets'
import {
  SQUARE_ICON_SIZE_OPTIONS,
  getSquareIconOption,
  getSquareIconStyle,
  getSquareIconToken,
  isSquareIcon,
} from '@/lib/square-icon'
import type { SquareIconSize } from '@/lib/square-icon'
import cn from '@/lib/utilsd'

import styles from '@/components/AbilityEditor/AbilityEditor.module.css'

const COOLDOWN_ICON_COLOR = '#7e61a1'
const ICON_COLOR_SWATCHES = [
  { id: 'default', label: 'Default', value: '' },
  { id: 'green', label: 'Green', value: '#2e9860' },
  { id: 'freshGreen', label: 'Fresh Green', value: '#84c955' },
  { id: 'olive', label: 'Olive', value: '#919814' },
  { id: 'amber', label: 'Amber', value: '#e5a535' },
  { id: 'spirit', label: 'Spirit', value: COOLDOWN_ICON_COLOR },
  { id: 'cream', label: 'Cream', value: '#f5eadb' },
] as const

function isIntrinsicColorPropertyIcon(pathOrName: string) {
  if (isSquareIcon(pathOrName)) {
    return false
  }

  const fileName = pathOrName.split('/').at(-1)?.toLowerCase() ?? pathOrName.toLowerCase()

  return fileName.includes('color') || fileName.endsWith('.png')
}

function getPropertyIconVisualStyle(path: string, iconColor = ''): CSSProperties {
  if (isSquareIcon(path)) {
    return getSquareIconStyle(path, iconColor || '#ffffff', 'stat')
  }

  if (isIntrinsicColorPropertyIcon(path)) {
    return {
      backgroundImage: `url('${path}')`,
    }
  }

  return {
    ...(iconColor ? { backgroundColor: iconColor } : {}),
    WebkitMaskImage: `url('${path}')`,
    maskImage: `url('${path}')`,
  }
}

function getWhiteAbilityIconVisualStyle(path: string, iconColor = '#ffffff'): CSSProperties {
  if (isSquareIcon(path)) {
    return getSquareIconStyle(path, iconColor)
  }

  return {
    backgroundColor: iconColor,
    WebkitMaskImage: `url('${path}')`,
    maskImage: `url('${path}')`,
  }
}

function formatAbilityIconAssetLabel(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  const rawName = fileName
    .replace(/\.(png|svg)$/i, '')
    .replace(/_(psd|png)$/i, '')

  return rawName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getAbilityIconGroupsAsAssets(groups: AbilityIconGroup[]): EditorAssetGroup[] {
  return groups.map(group => ({
    id: `ability-icons-${group.heroSlug}`,
    label: group.heroName,
    assets: group.icons.map((icon, index) => ({
      label: group.useFileLabels ? formatAbilityIconAssetLabel(icon) : `${group.heroName} ${index + 1}`,
      path: icon,
    })),
  }))
}

interface IconSearchModalProps {
  groups: EditorAssetGroup[]
  statGroups?: EditorAssetGroup[]
  search: string
  selectedIconColor: string
  title?: string
  testId?: string
  searchPlaceholder?: string
  previewMode?: 'property' | 'image' | 'ability'
  showColorPicker?: boolean
  closeLabel?: string
  initialAbilityIconTab?: string
  onIconColorChange: (color: string) => void
  onSearch: (search: string) => void
  onSelect: (path: string) => void
  onClose: () => void
}

export default function IconSearchModal({ groups, statGroups = [], search, selectedIconColor, title = 'Property icon selector', testId = 'property-icon-modal', searchPlaceholder = 'Search property icons', previewMode = 'property', showColorPicker = true, closeLabel = 'Close property icon selector', initialAbilityIconTab = 'heroes', onIconColorChange, onSearch, onSelect, onClose }: IconSearchModalProps) {
  const isAbilityPicker = previewMode === 'ability'
  const [abilityIconTab, setAbilityIconTab] = useState(initialAbilityIconTab)
  const [squareIconSize, setSquareIconSize] = useState<SquareIconSize>('medium')
  const squareIconOption = getSquareIconOption(squareIconSize)
  const upgradeAbilityGroups = isAbilityPicker ? groups.filter(group => group.id.startsWith('ability-icons-upgrade')) : []
  const heroAbilityGroups = isAbilityPicker ? groups.filter(group => !group.id.startsWith('ability-icons-upgrade')) : groups
  const activeAbilityGroups = abilityIconTab === 'heroes'
    ? heroAbilityGroups
    : upgradeAbilityGroups.filter(group => group.id === abilityIconTab)
  const showsAbilityIcons = isAbilityPicker && abilityIconTab !== 'stats'
  const activeIconGroups = isAbilityPicker
    ? abilityIconTab === 'stats' ? statGroups : activeAbilityGroups
    : groups
  const tabPanelLabelId = abilityIconTab === 'stats'
    ? 'ability-icon-tab-stats'
    : abilityIconTab === 'heroes'
      ? 'ability-icon-tab-heroes'
      : `ability-icon-tab-${abilityIconTab}`

  function handleBackdropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const renderIconButton = (asset: EditorAssetGroup['assets'][number], assetPreviewMode: 'property' | 'image' | 'ability' = previewMode) => (
    <button key={asset.path} type="button" aria-label={`Use ${asset.label}`} onClick={() => onSelect(asset.path)}>
      <span
        className={cn(
          styles.iconPreview,
          assetPreviewMode === 'ability' && styles.iconPreviewAbility,
          assetPreviewMode === 'image' && styles.iconPreviewImage,
          assetPreviewMode === 'property' && isIntrinsicColorPropertyIcon(asset.path) && styles.iconPreviewOriginalColor,
        )}
        aria-hidden="true"
        style={
          assetPreviewMode === 'image'
            ? { backgroundImage: `url('${asset.path}')` }
            : assetPreviewMode === 'ability'
              ? getWhiteAbilityIconVisualStyle(asset.path, selectedIconColor || '#ffffff')
              : getPropertyIconVisualStyle(asset.path, selectedIconColor || '#ffffff')
        }
      />
      {assetPreviewMode === 'ability' ? null : asset.label}
    </button>
  )

  const modal = (
    <div className={styles.iconBackdrop} role="dialog" aria-modal="true" aria-label={title} data-testid={testId} onPointerDown={handleBackdropPointerDown}>
      <div className={cn(styles.iconModal, isAbilityPicker && styles.iconModalAbility)}>
        <div className={styles.iconHeader}>
          <label>
            <Search aria-hidden="true" />
            <input value={search} onChange={event => onSearch(event.target.value)} placeholder={searchPlaceholder} />
          </label>
          <button type="button" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" /></button>
        </div>
        {showColorPicker ? (
          <section className={styles.iconColorPicker} aria-label="Icon color">
            {ICON_COLOR_SWATCHES.map(swatch => (
              <button
                key={swatch.id}
                type="button"
                className={cn(styles.iconColorSwatch, selectedIconColor === swatch.value && styles.iconColorSwatchActive)}
                style={swatch.value ? { backgroundColor: swatch.value } : undefined}
                aria-label={`${swatch.label} icon color`}
                aria-pressed={selectedIconColor === swatch.value}
                onClick={() => onIconColorChange(swatch.value)}
              >
                {swatch.value ? null : 'Default'}
              </button>
            ))}
          </section>
        ) : null}
        <section className={styles.squareIconPicker} aria-label="Square icon">
          <button type="button" className={styles.squareIconSelect} aria-label="Use Square Icon" onClick={() => onSelect(getSquareIconToken(squareIconSize))}>
            <span
              className={styles.squareIconPreview}
              aria-hidden="true"
              style={{
                width: squareIconOption.previewSize,
                height: squareIconOption.previewSize,
                backgroundColor: selectedIconColor || '#ffffff',
              }}
            />
            <span>
              <strong>Square Icon</strong>
              <em>{squareIconOption.label}</em>
            </span>
          </button>
          <div className={styles.iconSizePicker} aria-label="Square icon size">
            {SQUARE_ICON_SIZE_OPTIONS.map(sizeOption => (
              <button
                key={sizeOption.id}
                type="button"
                className={cn(styles.iconSizeSwatch, squareIconSize === sizeOption.id && styles.iconSizeSwatchActive)}
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
        {isAbilityPicker ? (
          <div className={styles.iconTabs} role="tablist" aria-label="Ability icon categories">
            <button
              type="button"
              id="ability-icon-tab-heroes"
              role="tab"
              aria-controls="ability-icon-tabpanel"
              aria-selected={abilityIconTab === 'heroes'}
              className={cn(abilityIconTab === 'heroes' && styles.iconTabActive)}
              onClick={() => setAbilityIconTab('heroes')}
            >
              Hero abilities
            </button>
            {upgradeAbilityGroups.map(group => (
              <button
                key={group.id}
                type="button"
                id={`ability-icon-tab-${group.id}`}
                role="tab"
                aria-controls="ability-icon-tabpanel"
                aria-selected={abilityIconTab === group.id}
                className={cn(abilityIconTab === group.id && styles.iconTabActive)}
                onClick={() => setAbilityIconTab(group.id)}
              >
                {group.label}
              </button>
            ))}
            <button
              type="button"
              id="ability-icon-tab-stats"
              role="tab"
              aria-controls="ability-icon-tabpanel"
              aria-selected={abilityIconTab === 'stats'}
              className={cn(abilityIconTab === 'stats' && styles.iconTabActive)}
              onClick={() => setAbilityIconTab('stats')}
            >
              Stat icons
            </button>
          </div>
        ) : null}
        <div
          className={cn(styles.iconGrid, showsAbilityIcons && styles.iconGridAbility)}
          id={isAbilityPicker ? 'ability-icon-tabpanel' : undefined}
          role={isAbilityPicker ? 'tabpanel' : undefined}
          aria-labelledby={isAbilityPicker ? tabPanelLabelId : undefined}
        >
          {showsAbilityIcons
            ? activeIconGroups.map(group => (
                <div key={group.id} className={styles.iconAbilityGroup} role="group" aria-label={group.label}>
                  <p className={styles.iconAbilityGroupTitle}>{group.label}</p>
                  {group.assets.map(asset => renderIconButton(asset, 'ability'))}
                </div>
              ))
            : activeIconGroups.flatMap(group => group.assets).map(asset => renderIconButton(asset, previewMode === 'ability' ? 'property' : previewMode))}
        </div>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? null : createPortal(modal, document.body)
}
