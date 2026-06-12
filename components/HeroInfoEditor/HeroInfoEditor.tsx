'use client'

import { useMemo, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'

import type { OurFileRouter } from '@/app/api/uploadthing/core'
import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import CharacterExportButton from '@/components/CharacterExport/CharacterExportButton'
import EditorAssetModal from '@/components/EditorAssetModal/EditorAssetModal'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import type { PanelStat } from '@/components/panels/scaling-utils'
import WeaponPanel from '@/components/panels/weapon-panel'
import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'
import type { SidebarTabId } from '@/components/SidebarTabs/SidebarTabs'
import { ABILITY_ICON_GROUPS, HERO_RENDER_GROUPS, PROPERTY_ICON_GROUPS, WEAPON_IMAGE_GROUPS } from '@/lib/editor-assets'
import type { EditorRenderSelection, HeroBackgroundOption } from '@/lib/editor-assets'
import type { AbilityDefinition, AbilityStatsPayload } from '@/lib/ability-editor-types'
import { buildDefaultAbility, buildDefaultAbilityStats, normalizeAbilityStats } from '@/lib/ability-editor-types'
import type { CustomHeroSavePayload, CustomHeroStatus } from '@/lib/custom-hero-types'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import { UploadButton } from '@/lib/uploadthing'
import { buildCharacterExportPayload, getCharacterShareUrl } from '@/lib/character-export'
import cn from '@/lib/utilsd'

import styles from './HeroInfoEditor.module.css'

interface HeroInfoEditorProps {
  hero: HeroDefinition
  draft: HeroInfoDefinition
  backgroundOptions: HeroBackgroundOption[]
  selectedBackground: string
  renderSelection: EditorRenderSelection
  savedHeroId?: string | null
  savedHeroName?: string
  allowCopies?: boolean
  initialStats?: HeroStatsPayload | null
  initialAbilityStats?: AbilityStatsPayload | null
  isSaving?: boolean
  saveStatusMessage?: string | null
  onBackgroundChange: (backgroundPath: string) => void
  onRenderSelectionChange: (renderSelection: EditorRenderSelection) => void
  onDraftChange: (draft: HeroInfoDefinition) => void
  onSaveHero: (payload: CustomHeroSavePayload) => void
}

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

interface CloudUploadButtonProps {
  endpoint: keyof OurFileRouter
  label: string
  className?: string
  onUploaded: (url: string) => void
}

interface UploadedAsset {
  url?: string
  serverData?: {
    url?: string
  } | null
}

interface TagControl {
  label: string
  textKey: 'tag1Text' | 'tag2Text' | 'tag3Text'
  tiltKey: 'tag1Tilt' | 'tag2Tilt' | 'tag3Tilt'
  offsetKey: 'tag1OffsetY' | 'tag2OffsetY' | 'tag3OffsetY'
}

interface AbilityControl {
  label: string
  iconKey: 'ability1Icon' | 'ability2Icon' | 'ability3Icon' | 'ability4Icon'
}

interface TagRotationDrag {
  tag: TagControl
  startX: number
  startTilt: number
}

const TAG_CONTROLS: TagControl[] = [
  { label: 'Tag 1', textKey: 'tag1Text', tiltKey: 'tag1Tilt', offsetKey: 'tag1OffsetY' },
  { label: 'Tag 2', textKey: 'tag2Text', tiltKey: 'tag2Tilt', offsetKey: 'tag2OffsetY' },
  { label: 'Tag 3', textKey: 'tag3Text', tiltKey: 'tag3Tilt', offsetKey: 'tag3OffsetY' },
]

const ABILITY_CONTROLS: AbilityControl[] = [
  { label: 'Ability 1', iconKey: 'ability1Icon' },
  { label: 'Ability 2', iconKey: 'ability2Icon' },
  { label: 'Ability 3', iconKey: 'ability3Icon' },
  { label: 'Ability 4', iconKey: 'ability4Icon' },
]

const WEAPON_MODIFIER_TARGETS: Record<string, string> = {
  'Weapon Damage': 'Bullet Damage',
  'Fire Rate': 'Bullets per sec',
  'Clip Size Increase': 'Ammo',
  'Reload Reduction': 'Reload Time',
  'Bullet Velocity Increase': 'Bullet Velocity',
}

const WEAPON_BASE_LABELS = ['Bullet Damage', 'Bullets per sec', 'Ammo', 'Reload Time', 'Bullet Velocity'] as const
const TAG_TILT_MIN = -45
const TAG_TILT_MAX = 45
const TAG_WHEEL_STEP = 0.5
const TAG_DRAG_PIXELS_PER_DEGREE = 6

function getUploadedAssetUrl(uploadedAssets: UploadedAsset[]) {
  const uploadedAsset = uploadedAssets[0]

  return uploadedAsset?.serverData?.url ?? uploadedAsset?.url ?? null
}

function parseEditableNumber(value: string | number | null | undefined) {
  const parsedValue = Number(String(value ?? '').replace(/[^\d.-]/g, ''))

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function sanitizeNumberInput(value: string | number) {
  return String(value).replace(/[^\d.-]/g, '')
}

function parseTagControlNumber(value: string, fallbackValue: number) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue
}

function clampTagTilt(value: number) {
  return Number(Math.min(TAG_TILT_MAX, Math.max(TAG_TILT_MIN, value)).toFixed(1))
}

function formatCalculatedWeaponStat(label: string, value: number) {
  if (label === 'Bullet Damage' || label === 'Bullets per sec') {
    return value.toFixed(1)
  }

  if (label === 'Reload Time') {
    return value.toFixed(2)
  }

  if (label === 'Bullet Velocity' || label === 'Ammo') {
    return String(Math.floor(value))
  }

  return String(value)
}

function calculateBulletDps(stats: PanelStat[]) {
  const bulletDamage = parseEditableNumber(stats.find(stat => stat.label === 'Bullet Damage')?.value)
  const bulletsPerSecond = parseEditableNumber(stats.find(stat => stat.label === 'Bullets per sec')?.value)

  return Math.floor(bulletDamage * bulletsPerSecond)
}

function buildWeaponBaseValues(stats: PanelStat[]) {
  return WEAPON_BASE_LABELS.reduce<Record<string, number>>((baseValues, label) => {
    baseValues[label] = parseEditableNumber(stats.find(stat => stat.label === label)?.value)

    return baseValues
  }, {})
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const inputId = `editor-${label.toLowerCase().replaceAll(' ', '-')}`

  return (
    <label className={styles.fieldLabel} htmlFor={inputId}>
      {label}
      <span className="flex items-center gap-2">
        <input
          id={inputId}
          type="color"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="h-9 w-11 rounded border border-[#ffefd6]/20 bg-black/40 p-1"
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          className={cn(styles.input, 'min-w-0 flex-1 text-[0.74rem] tracking-[0.08em]')}
          aria-label={`${label} hex value`}
        />
      </span>
    </label>
  )
}

function CloudUploadButton({ endpoint, label, className, onUploaded }: CloudUploadButtonProps) {
  const [uploadError, setUploadError] = useState<string | null>(null)

  return (
    <span className={cn(styles.cloudUploadWrap, className)}>
      <UploadButton
        endpoint={endpoint}
        appearance={{
          container: styles.cloudUploadContainer,
          button: styles.cloudUploadButton,
          allowedContent: styles.cloudUploadAllowed,
        }}
        content={{
          button: ({ isUploading }) => (isUploading ? 'Uploading...' : label),
          allowedContent: () => null,
        }}
        onUploadBegin={() => setUploadError(null)}
        onClientUploadComplete={uploadedAssets => {
          const uploadedUrl = getUploadedAssetUrl(uploadedAssets)

          if (!uploadedUrl) {
            setUploadError('Upload completed without a file URL.')
            return
          }

          onUploaded(uploadedUrl)
        }}
        onUploadError={error => setUploadError(error.message || 'Upload failed.')}
      />
      {uploadError ? <span className={styles.inlineUploadError} role="alert">{uploadError}</span> : null}
    </span>
  )
}

export default function HeroInfoEditor({
  hero,
  draft,
  backgroundOptions,
  selectedBackground,
  renderSelection,
  savedHeroId = null,
  savedHeroName = '',
  allowCopies = false,
  initialStats = null,
  initialAbilityStats = null,
  isSaving = false,
  saveStatusMessage = null,
  onBackgroundChange,
  onRenderSelectionChange,
  onDraftChange,
  onSaveHero,
}: HeroInfoEditorProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId>('overview')
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(null)
  const [isWeaponAssetModalOpen, setIsWeaponAssetModalOpen] = useState(false)
  const [isHeroRenderAssetModalOpen, setIsHeroRenderAssetModalOpen] = useState(false)
  const [tagRotationDrag, setTagRotationDrag] = useState<TagRotationDrag | null>(null)
  const initialStatsDraft = initialStats ?? buildHeroStatsSeed(hero)
  const initialAbilityDraft = initialAbilityStats ?? buildDefaultAbilityStats(hero)
  const [statsDraft, setStatsDraft] = useState<HeroStatsPayload>(() => initialStatsDraft)
  const [abilityStatsDraft, setAbilityStatsDraft] = useState<AbilityStatsPayload>(() => normalizeAbilityStats(initialAbilityDraft, hero))
  const [weaponBaseValues, setWeaponBaseValues] = useState<Record<string, number>>(() => buildWeaponBaseValues(initialStatsDraft.weapon.stats))
  const [weaponTagsInput, setWeaponTagsInput] = useState(() => initialStatsDraft.weapon.weaponAttributes.join(', '))
  const [heroNameInput, setHeroNameInput] = useState(savedHeroName)
  const [allowCopiesInput, setAllowCopiesInput] = useState(allowCopies)
  const [saveError, setSaveError] = useState<string | null>(null)
  const heroNamePreview = draft.nameValue.trim() || hero.displayName
  const exportHeroName = getDraftName() || heroNamePreview
  const exportShareUrl = savedHeroId && typeof window !== 'undefined' ? getCharacterShareUrl(savedHeroId, window.location.origin) : null
  const exportPayload = buildCharacterExportPayload(
    {
      ...hero,
      displayName: exportHeroName,
      render: getRenderPath(),
      heroInfo: draft,
    },
    {
      hero: {
        slug: hero.slug,
        name: exportHeroName,
        portrait: hero.portrait,
        render: getRenderPath(),
      },
      heroInfo: draft,
      weapon: statsDraft.weapon,
      vitality: statsDraft.vitality,
      spirit: statsDraft.spirit,
    },
    {
      name: exportHeroName,
      render: getRenderPath(),
      heroInfo: draft,
      shareUrl: exportShareUrl,
    },
  )

  const tagPreview = useMemo(
    () =>
      TAG_CONTROLS.map(tag => ({
        ...tag,
        text: draft[tag.textKey],
        tilt: draft[tag.tiltKey],
        offsetY: draft[tag.offsetKey],
      })),
    [draft],
  )

  function updateDraft(nextDraft: Partial<HeroInfoDefinition>) {
    onDraftChange({
      ...draft,
      ...nextDraft,
    })
  }

  function updateWeaponDraft(nextWeapon: Partial<HeroStatsPayload['weapon']>) {
    setStatsDraft(currentDraft => ({
      ...currentDraft,
      weapon: {
        ...currentDraft.weapon,
        ...nextWeapon,
      },
    }))
  }

  function handleNameUpload(uploadUrl: string) {
    updateDraft({
      nameType: 'image',
      nameValue: uploadUrl,
    })
  }

  function handleWeaponImageUpload(uploadUrl: string) {
    updateWeaponDraft({
      gunImageSrc: uploadUrl,
    })
  }

  function handleHeroRenderUpload(uploadUrl: string) {
    onRenderSelectionChange({
      mode: 'custom',
      src: uploadUrl,
    })
  }

  function handleWeaponStatsChange(nextStats: PanelStat[], changedStat: PanelStat) {
    const changedValue = sanitizeNumberInput(changedStat.value)
    const modifierTarget = WEAPON_MODIFIER_TARGETS[changedStat.label]
    let calculatedStats = nextStats.map(stat => (stat.label === changedStat.label ? { ...stat, value: changedValue } : stat))

    if (modifierTarget) {
      const baseValue = weaponBaseValues[modifierTarget] ?? parseEditableNumber(calculatedStats.find(stat => stat.label === modifierTarget)?.value)
      const modifierValue = parseEditableNumber(changedValue) / 100
      const calculatedValue = baseValue * (1 + modifierValue)

      calculatedStats = calculatedStats.map(stat => (stat.label === modifierTarget ? { ...stat, value: formatCalculatedWeaponStat(modifierTarget, calculatedValue) } : stat))
    } else if (WEAPON_BASE_LABELS.some(label => label === changedStat.label)) {
      const parsedValue = parseEditableNumber(changedValue)

      setWeaponBaseValues(currentValues => ({
        ...currentValues,
        [changedStat.label]: parsedValue,
      }))
    }

    updateWeaponDraft({
      stats: calculatedStats,
      bulletDPS: calculateBulletDps(calculatedStats),
    })
  }

  function handleVitalityStatsChange(nextStats: PanelStat[], changedStat: PanelStat) {
    const calculatedStats = nextStats.map(stat => (stat.label === changedStat.label ? { ...stat, value: sanitizeNumberInput(changedStat.value) } : stat))

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      vitality: {
        stats: calculatedStats,
      },
    }))
  }

  function handleSpiritTopStatsChange(nextStats: PanelStat[], changedStat: PanelStat) {
    const calculatedStats = nextStats.map(stat => (stat.label === changedStat.label ? { ...stat, value: sanitizeNumberInput(changedStat.value) } : stat))

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: {
        ...currentDraft.spirit,
        topStats: calculatedStats,
      },
    }))
  }

  function handleSpiritPowerStatChange(nextStat: PanelStat) {
    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: {
        ...currentDraft.spirit,
        spiritPowerStat: {
          ...nextStat,
          value: sanitizeNumberInput(nextStat.value),
        },
      },
    }))
  }

  function handleWeaponTagChange(value: string) {
    setWeaponTagsInput(value)
    updateWeaponDraft({
      weaponAttributes: value
        .split(',')
        .map(attribute => attribute.trim())
        .filter(Boolean),
    })
  }

  function getRenderPath() {
    if ((renderSelection.mode === 'hero' || renderSelection.mode === 'custom') && renderSelection.src) {
      return renderSelection.src
    }

    return selectedBackground
  }

  function getDraftName() {
    const explicitName = heroNameInput.trim()

    if (explicitName) {
      return explicitName
    }

    if (savedHeroName.trim()) {
      return savedHeroName.trim()
    }

    return draft.nameType === 'text' ? draft.nameValue.trim() : ''
  }

  function handleGlobalSave(status: CustomHeroStatus) {
    const name = getDraftName()

    if (!name) {
      setSaveError('Enter a hero name before saving this draft.')
      return
    }

    setSaveError(null)
    onSaveHero({
      id: savedHeroId,
      name,
      status,
      hero: {
        portrait: hero.portrait,
        render: getRenderPath(),
        background: selectedBackground,
      },
      allowCopies: allowCopiesInput,
      heroInfo: draft,
      weapon: statsDraft.weapon,
      vitality: statsDraft.vitality,
      spirit: statsDraft.spirit,
      abilityStats: abilityStatsDraft,
    })
  }

  function commitAbilityDraft(nextAbility: AbilityDefinition) {
    const abilityControl = ABILITY_CONTROLS[nextAbility.slot - 1]

    setAbilityStatsDraft(currentDraft => ({
      abilities: currentDraft.abilities.map((ability, index) => (index === nextAbility.slot - 1 ? nextAbility : ability)),
    }))

    if (abilityControl) {
      updateDraft({
        [abilityControl.iconKey]: nextAbility.icon,
      })
    }
  }

  function handleAbilitySave(nextAbility: AbilityDefinition) {
    commitAbilityDraft(nextAbility)
    setActiveAbilityIndex(null)
  }

  function handleFocusedAbilitySelect(slot: number, currentAbility: AbilityDefinition) {
    commitAbilityDraft(currentAbility)
    setActiveAbilityIndex(slot - 1)
  }

  function handleAbilityIconChange(slot: number, iconPath: string) {
    const abilityControl = ABILITY_CONTROLS[slot - 1]

    if (abilityControl) {
      updateDraft({
        [abilityControl.iconKey]: iconPath,
      })
    }

    setAbilityStatsDraft(currentDraft => ({
      abilities: currentDraft.abilities.map((ability, index) => (index === slot - 1 ? { ...ability, icon: iconPath } : ability)),
    }))
  }

  function updateTagTilt(tag: TagControl, tilt: number) {
    updateDraft({
      [tag.tiltKey]: clampTagTilt(tilt),
    })
  }

  function handleTagWheel(event: WheelEvent<HTMLSpanElement>, tag: TagControl) {
    event.preventDefault()

    const wheelDirection = event.deltaY > 0 ? 1 : -1
    updateTagTilt(tag, draft[tag.tiltKey] + wheelDirection * TAG_WHEEL_STEP)
  }

  function handleTagPointerDown(event: PointerEvent<HTMLSpanElement>, tag: TagControl) {
    if (event.button !== 0) {
      return
    }

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setTagRotationDrag({
      tag,
      startX: event.clientX,
      startTilt: draft[tag.tiltKey],
    })
  }

  function handleTagPointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (!tagRotationDrag) {
      return
    }

    const tiltDelta = (event.clientX - tagRotationDrag.startX) / TAG_DRAG_PIXELS_PER_DEGREE
    updateTagTilt(tagRotationDrag.tag, tagRotationDrag.startTilt + tiltDelta)
  }

  function handleTagPointerEnd(event: PointerEvent<HTMLSpanElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setTagRotationDrag(null)
  }

  if (activeAbilityIndex !== null) {
    const activeAbilityDraft = abilityStatsDraft.abilities[activeAbilityIndex] ?? buildDefaultAbility(activeAbilityIndex + 1, hero)

    return (
      <AbilityEditor
        key={activeAbilityDraft.slot}
        ability={activeAbilityDraft}
        propertyIconGroups={PROPERTY_ICON_GROUPS}
        hero={hero}
        heroInfo={draft}
        abilityIconGroups={ABILITY_ICON_GROUPS}
        onHeroInfoChange={onDraftChange}
        onAbilityIconChange={handleAbilityIconChange}
        onAbilitySelect={handleFocusedAbilitySelect}
        onSave={handleAbilitySave}
        onCancel={() => setActiveAbilityIndex(null)}
      />
    )
  }

  return (
    <section
      className={styles.editor}
      data-testid="hero-info-editor"
      aria-label="Character editor"
    >
      <SidebarTabs activeTabId={activeTabId} onSelect={setActiveTabId} overviewLabel="Hero render" />

      <div className={styles.previewStage}>
            <div className={styles.nameRow}>
              {draft.nameType === 'image' ? (
                <span
                  className={styles.nameImage}
                  data-testid="editor-name-image"
                  aria-label="Uploaded hero name preview"
                  role="img"
                  style={{
                    backgroundColor: draft.nameColor,
                    WebkitMaskImage: `url('${heroNamePreview}')`,
                    maskImage: `url('${heroNamePreview}')`,
                  }}
                />
              ) : (
                <span className={styles.nameText} data-testid="editor-name-text" style={{ color: draft.nameColor }}>
                  {heroNamePreview}
                </span>
              )}
            </div>

            <div className={cn(styles.tagsRow, 'flex-nowrap')} aria-label="Editable hero tags" data-testid="editor-tags-row">
              {tagPreview.map((tag, index) => (
                <span
                  key={tag.label}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tag.label} preview. Scroll or drag horizontally to rotate.`}
                  className={cn(styles.tagPreview, 'w-fit shrink-0')}
                  data-testid={`editor-tag-${index + 1}`}
                  onWheel={event => handleTagWheel(event, tag)}
                  onPointerDown={event => handleTagPointerDown(event, tag)}
                  onPointerMove={handleTagPointerMove}
                  onPointerUp={handleTagPointerEnd}
                  onPointerCancel={handleTagPointerEnd}
                  style={{
                    transform: `rotate(${tag.tilt}deg) translateY(${tag.offsetY}px)`,
                    backgroundColor: draft.tagColor,
                    color: draft.tagTextColor,
                  }}
                >
                  <span className={cn(styles.tagText, 'whitespace-nowrap')}>{tag.text || tag.label}</span>
                </span>
              ))}
            </div>

            <div className={styles.abilitiesRow} aria-label="Editable ability icons">
              {ABILITY_CONTROLS.map((ability, index) => (
                <button
                  key={ability.iconKey}
                  type="button"
                  className={styles.abilityButton}
                  data-testid={`editor-ability-${index + 1}`}
                  aria-label={`Edit ${ability.label}`}
                  style={{ backgroundColor: draft.abilityCircleColor }}
                  onClick={() => setActiveAbilityIndex(index)}
                >
                  <span
                    className={styles.abilityIcon}
                    aria-hidden="true"
                    style={{
                      backgroundColor: draft.abilityIconColor,
                      WebkitMaskImage: `url('${draft[ability.iconKey]}')`,
                      maskImage: `url('${draft[ability.iconKey]}')`,
                    }}
                  />
                </button>
              ))}
            </div>
      </div>

      {activeTabId !== 'overview' ? (
        <aside className={styles.statsAside}>
          {activeTabId === 'weapon' ? (
            <div className={styles.weaponStack}>
              <div className={styles.miniEditor} data-testid="weapon-mini-editor">
                <span className={styles.miniEditorTitle}>Weapon Info</span>
                <div className={styles.fieldGroup}>
                  <label className={styles.compactLabel} htmlFor="editor-weapon-name">
                    Name
                    <input
                      id="editor-weapon-name"
                      type="text"
                      value={statsDraft.weapon.weaponName}
                      onChange={event => updateWeaponDraft({ weaponName: event.target.value })}
                      className={cn(styles.input, styles.compactInput)}
                    />
                  </label>
                  <label className={styles.compactLabel} htmlFor="editor-weapon-tags">
                    Tags
                    <input
                      id="editor-weapon-tags"
                      type="text"
                      value={weaponTagsInput}
                      onChange={event => handleWeaponTagChange(event.target.value)}
                      className={cn(styles.input, styles.compactInput)}
                    />
                  </label>
                </div>
                <label className={styles.compactLabel} htmlFor="editor-weapon-description">
                  Description
                  <textarea
                    id="editor-weapon-description"
                    value={statsDraft.weapon.weaponDesc}
                    onChange={event => updateWeaponDraft({ weaponDesc: event.target.value })}
                    rows={2}
                    wrap="soft"
                    className={cn(styles.textarea, styles.compactTextarea)}
                    placeholder="Describe this weapon..."
                  />
                </label>
                <div className={styles.twoColumnGrid}>
                  <label className={styles.compactLabel} htmlFor="editor-weapon-min-range">
                    Min
                    <input
                      id="editor-weapon-min-range"
                      type="text"
                      value={statsDraft.weapon.weaponMinRange}
                      onChange={event => updateWeaponDraft({ weaponMinRange: parseEditableNumber(event.target.value) })}
                      className={cn(styles.input, styles.compactInput)}
                    />
                  </label>
                  <label className={styles.compactLabel} htmlFor="editor-weapon-max-range">
                    Max
                    <input
                      id="editor-weapon-max-range"
                      type="text"
                      value={statsDraft.weapon.weaponMaxRange}
                      onChange={event => updateWeaponDraft({ weaponMaxRange: parseEditableNumber(event.target.value) })}
                      className={cn(styles.input, styles.compactInput)}
                    />
                  </label>
                </div>
                <div className={styles.weaponActionGrid}>
                  <button
                    type="button"
                    className={styles.assetButton}
                    onClick={() => setIsWeaponAssetModalOpen(true)}
                  >
                    Asset
                  </button>
                  <CloudUploadButton endpoint="weaponImage" label="Upload" onUploaded={handleWeaponImageUpload} />
                </div>
              </div>
              <WeaponPanel
                isEditable
                weaponName={statsDraft.weapon.weaponName}
                weaponDesc={statsDraft.weapon.weaponDesc}
                gunImageSrc={statsDraft.weapon.gunImageSrc}
                weaponAttributes={statsDraft.weapon.weaponAttributes}
                weaponStats={statsDraft.weapon.stats}
                bulletDPS={statsDraft.weapon.bulletDPS}
                weaponMinRange={statsDraft.weapon.weaponMinRange}
                weaponMaxRange={statsDraft.weapon.weaponMaxRange}
                onStatsChange={handleWeaponStatsChange}
              />
            </div>
          ) : null}

          {activeTabId === 'vitality' ? <HeroStatsVitalityPanel isEditable stats={statsDraft.vitality.stats} onStatsChange={handleVitalityStatsChange} /> : null}

          {activeTabId === 'spirit' ? (
          <HeroStatsSpiritPanel isEditable stats={statsDraft.spirit.topStats} spiritPowerStat={statsDraft.spirit.spiritPowerStat} onStatsChange={handleSpiritTopStatsChange} onSpiritPowerStatChange={handleSpiritPowerStatChange} />
          ) : null}
        </aside>
      ) : null}

      <div className={styles.controlRail}>
        <div className={styles.railHeader}>
          <div>
            <h2 className={styles.railTitle}>Create</h2>
            <p className={styles.railSubtitle}>{hero.displayName} draft</p>
          </div>
          <span className={styles.liveBadge}>Live</span>
        </div>

        <div className={styles.railContent}>
          {activeTabId === 'overview' ? (
            <div className={styles.sectionGroup}>
              <span className={styles.sectionTitle}>Hero Render</span>
              <div className={styles.renderModeGrid}>
                <button
                  type="button"
                  className={cn(
                    styles.segmentedButton,
                    renderSelection.mode === 'background' ? styles.segmentedButtonActive : styles.segmentedButtonInactive,
                  )}
                  onClick={() => onRenderSelectionChange({ mode: 'background', src: null })}
                >
                  None
                </button>
                <button
                  type="button"
                  className={cn(
                    styles.segmentedButton,
                    renderSelection.mode === 'hero' ? styles.segmentedButtonActive : styles.segmentedButtonInactive,
                  )}
                  onClick={() => setIsHeroRenderAssetModalOpen(true)}
                >
                  Asset
                </button>
                <CloudUploadButton
                  endpoint="heroRender"
                  label="Upload"
                  className={cn(
                    renderSelection.mode === 'custom' ? styles.segmentedButtonActive : styles.segmentedButtonInactive,
                  )}
                  onUploaded={handleHeroRenderUpload}
                />
              </div>
            </div>
          ) : null}

          <label className={styles.fieldLabel} htmlFor="editor-background">
            Background
            <select
              id="editor-background"
              value={selectedBackground}
              onChange={event => onBackgroundChange(event.target.value)}
              className={styles.select}
              data-testid="editor-background-select"
            >
              {backgroundOptions.map(option => (
                <option key={option.path} value={option.path}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.fieldGroup}>
            <span className={styles.sectionTitle}>Hero Name</span>
            <div className={styles.segmentedGrid} role="group" aria-label="Hero name mode">
              {(['text', 'image'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    styles.segmentedButton,
                    draft.nameType === mode ? styles.segmentedButtonActive : styles.segmentedButtonInactive,
                  )}
                  aria-pressed={draft.nameType === mode}
                  onClick={() => updateDraft({ nameType: mode })}
                >
                  {mode}
                </button>
              ))}
            </div>

            {draft.nameType === 'text' ? (
              <label className={styles.fieldLabel} htmlFor="editor-name-input">
                Name Text
                <input
                  id="editor-name-input"
                  type="text"
                  value={draft.nameValue}
                  onChange={event => updateDraft({ nameValue: event.target.value })}
                  className={styles.input}
                />
              </label>
            ) : (
              <CloudUploadButton
                endpoint="heroNameAsset"
                label="Upload name image"
                className={styles.uploadNameButton}
                onUploaded={handleNameUpload}
              />
            )}
          </div>

          <label className={styles.fieldLabel} htmlFor="editor-backstory">
            Backstory
            <textarea
              id="editor-backstory"
              value={draft.backstory ?? ''}
              onChange={event => updateDraft({ backstory: event.target.value })}
              rows={6}
              wrap="soft"
              className={cn(styles.textarea, 'overflow-y-auto overflow-x-hidden break-words')}
              placeholder="Write this character's story..."
            />
          </label>

          <div className={styles.sectionGroup}>
            <span className={styles.sectionTitle}>Tags</span>
            {TAG_CONTROLS.map(tag => (
              <div key={tag.textKey} className={styles.tagControl}>
                <label className={styles.fieldLabel} htmlFor={`editor-${tag.textKey}`}>
                  {tag.label}
                  <input
                    id={`editor-${tag.textKey}`}
                    type="text"
                    value={draft[tag.textKey]}
                    onChange={event => updateDraft({ [tag.textKey]: event.target.value })}
                    className={styles.input}
                  />
                </label>
                <div className={styles.twoColumnGrid}>
                  <label className={cn(styles.compactLabel, styles.tinyLabel)} htmlFor={`editor-${tag.tiltKey}`}>
                    Tilt
                    <input
                      id={`editor-${tag.tiltKey}`}
                      type="number"
                      min={TAG_TILT_MIN}
                      max={TAG_TILT_MAX}
                      step="0.5"
                      value={draft[tag.tiltKey]}
                      aria-label={`${tag.label} tilt`}
                      onChange={event => updateTagTilt(tag, parseTagControlNumber(event.target.value, draft[tag.tiltKey]))}
                      className={cn(styles.input, styles.compactInput)}
                    />
                  </label>
                  <label className={cn(styles.compactLabel, styles.tinyLabel)} htmlFor={`editor-${tag.offsetKey}`}>
                    Vertical
                    <input
                      id={`editor-${tag.offsetKey}`}
                      type="number"
                      min="-28"
                      max="28"
                      step="1"
                      value={draft[tag.offsetKey]}
                      aria-label={`${tag.label} vertical position`}
                      onChange={event => updateDraft({ [tag.offsetKey]: parseTagControlNumber(event.target.value, draft[tag.offsetKey]) })}
                      className={cn(styles.input, styles.compactInput)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.sectionGroup}>
            <ColorField label="Hero Name" value={draft.nameColor} onChange={value => updateDraft({ nameColor: value })} />
            <ColorField label="Tag Text" value={draft.tagTextColor} onChange={value => updateDraft({ tagTextColor: value })} />
            <ColorField label="Tag Rectangles" value={draft.tagColor} onChange={value => updateDraft({ tagColor: value })} />
            <ColorField label="Ability Icons" value={draft.abilityIconColor} onChange={value => updateDraft({ abilityIconColor: value })} />
            <ColorField label="Ability Circles" value={draft.abilityCircleColor} onChange={value => updateDraft({ abilityCircleColor: value })} />
          </div>
        </div>

        <div className={styles.globalActions}>
          <label className={styles.heroNamePrompt} htmlFor="editor-save-hero-name">
            Hero Name
            <input
              id="editor-save-hero-name"
              type="text"
              value={heroNameInput}
              onChange={event => {
                setHeroNameInput(event.target.value)
                setSaveError(null)
              }}
              placeholder="Name this save"
              className={styles.input}
            />
          </label>
          <label className={styles.copyToggle} htmlFor="editor-allow-copies">
            <input
              id="editor-allow-copies"
              type="checkbox"
              checked={allowCopiesInput}
              onChange={event => setAllowCopiesInput(event.target.checked)}
            />
            <span aria-hidden="true" />
            <strong>Allow Copies</strong>
          </label>
          <button
            type="button"
            className={styles.saveActionButton}
            disabled={isSaving}
            onClick={() => handleGlobalSave('private')}
          >
            Save Private
          </button>
          <button
            type="button"
            className={styles.publishActionButton}
            disabled={isSaving}
            onClick={() => handleGlobalSave('published')}
          >
            Publish
          </button>
          <CharacterExportButton payload={exportPayload} className={styles.exportActionButton} />
          {saveError ? <p className={styles.saveError} role="alert">{saveError}</p> : null}
          {saveStatusMessage ? <p className={styles.actionStatus} role="status">{saveStatusMessage}</p> : null}
        </div>
      </div>

      {isHeroRenderAssetModalOpen ? (
        <EditorAssetModal
          title="Hero Render"
          description="Choose an existing hero render. Existing renders replace the selected background."
          uploadLabel="Upload custom render"
          uploadEndpoint="heroRender"
          groups={HERO_RENDER_GROUPS}
          previewMode="image"
          testId="hero-render-modal"
          onClose={() => setIsHeroRenderAssetModalOpen(false)}
          onSelect={assetPath => {
            onRenderSelectionChange({ mode: 'hero', src: assetPath })
            setIsHeroRenderAssetModalOpen(false)
          }}
          onUpload={uploadUrl => {
            onRenderSelectionChange({ mode: 'custom', src: uploadUrl })
            setIsHeroRenderAssetModalOpen(false)
          }}
        />
      ) : null}

      {isWeaponAssetModalOpen ? (
        <EditorAssetModal
          title="Weapon Image"
          description="Choose an existing hero weapon or upload your own."
          uploadLabel="Upload custom weapon"
          uploadEndpoint="weaponImage"
          groups={WEAPON_IMAGE_GROUPS}
          previewMode="image"
          testId="weapon-image-modal"
          onClose={() => setIsWeaponAssetModalOpen(false)}
          onSelect={assetPath => {
            updateWeaponDraft({ gunImageSrc: assetPath })
            setIsWeaponAssetModalOpen(false)
          }}
          onUpload={uploadUrl => {
            updateWeaponDraft({ gunImageSrc: uploadUrl })
            setIsWeaponAssetModalOpen(false)
          }}
        />
      ) : null}
    </section>
  )
}
