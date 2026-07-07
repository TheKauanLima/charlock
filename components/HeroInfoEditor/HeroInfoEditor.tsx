'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, WheelEvent } from 'react'

import type { OurFileRouter } from '@/app/api/uploadthing/core'
import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import CharacterExportButton from '@/components/CharacterExport/CharacterExportButton'
import EditorAssetModal from '@/components/EditorAssetModal/EditorAssetModal'
import HeroAbilityIconRow from '@/components/HeroAbilityIconRow/HeroAbilityIconRow'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import type { PanelStat } from '@/components/panels/scaling-utils'
import WeaponPanel from '@/components/panels/weapon-panel'
import { PELLET_COUNT_LABEL } from '@/components/panels/weapon-stats-mapper'
import PanelVariantTabs, { BASE_PANEL_ID } from '@/components/PanelVariantTabs/PanelVariantTabs'
import SidebarTabs from '@/components/SidebarTabs/SidebarTabs'
import type { SidebarTabId } from '@/components/SidebarTabs/SidebarTabs'
import { SaveFailureBanner, SystemToast } from '@/components/system-feedback/SystemFeedback'
import { ABILITY_ICON_GROUPS, HERO_BACKGROUND_GROUPS, HERO_RENDER_GROUPS, PROPERTY_ICON_GROUPS, WEAPON_IMAGE_GROUPS } from '@/lib/editor-assets'
import type { EditorRenderSelection, HeroBackgroundOption } from '@/lib/editor-assets'
import type { AbilityDefinition, AbilityStatsPayload } from '@/lib/ability-editor-types'
import {
  buildDefaultAbility,
  buildDefaultAbilityStats,
  buildDefaultSecondaryAbilities,
  getPrimaryAbilityIndexForSecondary,
  getSecondaryAbilitySlots,
  normalizeSecondaryAbilitySlots,
  normalizeAbilityStats,
} from '@/lib/ability-editor-types'
import type { CustomHeroSavePayload, CustomHeroStatus } from '@/lib/custom-hero-types'
import { buildEditorRecoverySnapshot, readEditorRecovery, writeEditorRecovery } from '@/lib/editor-recovery'
import { DEFAULT_HERO_NAME_FONT_FAMILY, DEFAULT_HERO_NAME_FONT_SIZE, DEFAULT_HERO_NAME_FONT_WEIGHT, HEROES, type HeroDefinition, type HeroInfoDefinition } from '@/lib/hero-data'
import { buildEmptyHeroStats, buildHeroStatsSeed, type HeroStatsPayload, type WeaponStatsPayload } from '@/lib/hero-stats-shared'
import { UploadButton } from '@/lib/uploadthing'
import { UPLOAD_POLICIES, validateUploadFiles } from '@/lib/upload-validation'
import { buildCharacterExportPayload } from '@/lib/character-export'
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
  savedHeroStatus?: CustomHeroStatus
  allowCopies?: boolean
  initialStats?: HeroStatsPayload | null
  initialAbilityStats?: AbilityStatsPayload | null
  isSaving?: boolean
  saveStatusMessage?: string | null
  saveFailure?: string | null
  onRetrySave?: () => void
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

type AbilitySetId = 'primary' | 'secondary'

interface ActiveAbilityTarget {
  set: AbilitySetId
  index: number
}

type SecondAbilitySetModal = 'selectSlots' | 'confirmRemove'
type TagDragMode = 'rotate' | 'moveY'

interface TagDragState {
  tag: TagControl
  mode: TagDragMode
  startX: number
  startY: number
  startTilt: number
  startOffsetY: number
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
const TAG_OFFSET_MIN = -28
const TAG_OFFSET_MAX = 28

function hasPersistedHeroId(hero: HeroDefinition) {
  const id = (hero as HeroDefinition & { id?: unknown }).id

  return typeof id === 'string' && id.length > 0
}
const NAME_SIZE_MIN = 1
const NAME_SIZE_MAX = 30
const NAME_SIZE_DEFAULT = 6
const NAME_SIZE_BASE_REM = 1.5
const NAME_SIZE_STEP_REM = 0.3
const NAME_FONT_VALUE_VALVE_PULP = '"Valve Pulp", VALVEPulp, "Noto Sans", sans-serif'
const NAME_FONT_OPTIONS = [
  { label: 'Valve Pulp', value: NAME_FONT_VALUE_VALVE_PULP },
  { label: 'Valve Occult', value: '"Valve Occult", Georgia, "Times New Roman", serif' },
  { label: 'Retail Demo', value: '"Retail Demo", "Noto Sans", Arial, sans-serif' },
  { label: 'Radiance', value: 'Radiance, Arial, sans-serif' },
  { label: 'Reaver', value: 'Reaver, Georgia, serif' },
  { label: 'Forevs Demo', value: '"Forevs Demo", "Valve Pulp", sans-serif' },
  { label: 'Geist Sans', value: 'var(--font-geist-sans), Arial, sans-serif' },
  { label: 'Geist Mono', value: 'var(--font-geist-mono), "Roboto Mono", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
]
const NAME_FONT_WEIGHTS = [
  { label: 'Light', value: '400' },
  { label: 'Semi', value: '600' },
  { label: 'Bold', value: '800' },
]

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

function restoreRequiredAbilityIcons(heroInfo: HeroInfoDefinition): HeroInfoDefinition {
  const fallback = HEROES[0].heroInfo

  return {
    ...heroInfo,
    ability1Icon: heroInfo.ability1Icon || fallback.ability1Icon,
    ability2Icon: heroInfo.ability2Icon || fallback.ability2Icon,
    ability3Icon: heroInfo.ability3Icon || fallback.ability3Icon,
    ability4Icon: heroInfo.ability4Icon || fallback.ability4Icon,
  }
}

function clampTagTilt(value: number) {
  return Number(Math.min(TAG_TILT_MAX, Math.max(TAG_TILT_MIN, value)).toFixed(1))
}

function clampTagOffset(value: number) {
  return Math.min(TAG_OFFSET_MAX, Math.max(TAG_OFFSET_MIN, Math.round(value)))
}

function getHeroNameTextStyle(heroInfo: HeroInfoDefinition): CSSProperties {
  return {
    color: heroInfo.nameColor,
    fontSize: heroInfo.nameFontSize || DEFAULT_HERO_NAME_FONT_SIZE,
    fontFamily: heroInfo.nameFontFamily || DEFAULT_HERO_NAME_FONT_FAMILY,
    fontWeight: heroInfo.nameFontWeight || DEFAULT_HERO_NAME_FONT_WEIGHT,
  }
}

function clampNameSizeLevel(value: number) {
  return Math.min(NAME_SIZE_MAX, Math.max(NAME_SIZE_MIN, Math.round(value)))
}

function getNameSizeRemByLevel(level: number) {
  return Number((NAME_SIZE_BASE_REM + (level - 1) * NAME_SIZE_STEP_REM).toFixed(1))
}

function getNameSizeControlValue(fontSize?: string) {
  const normalizedFontSize = (fontSize || DEFAULT_HERO_NAME_FONT_SIZE).trim()

  if (!normalizedFontSize || normalizedFontSize === DEFAULT_HERO_NAME_FONT_SIZE) {
    return NAME_SIZE_DEFAULT
  }

  const remMatches = Array.from(normalizedFontSize.matchAll(/([\d.]+)\s*rem/g))
  const remValue = remMatches.length ? Number(remMatches.at(-1)?.[1]) : NaN
  const pxMatch = normalizedFontSize.match(/([\d.]+)\s*px/)
  const pxValue = pxMatch ? Number(pxMatch[1]) / 16 : NaN
  const sizeValue = Number.isFinite(remValue) ? remValue : pxValue

  if (!Number.isFinite(sizeValue)) {
    return NAME_SIZE_DEFAULT
  }

  return clampNameSizeLevel(((sizeValue - NAME_SIZE_BASE_REM) / NAME_SIZE_STEP_REM) + 1)
}

function getNameSizeCss(level: number) {
  const nextLevel = Number.isFinite(level) ? clampNameSizeLevel(level) : NAME_SIZE_DEFAULT

  if (nextLevel === NAME_SIZE_DEFAULT) {
    return DEFAULT_HERO_NAME_FONT_SIZE
  }

  return `${getNameSizeRemByLevel(nextLevel)}rem`
}

function getNameFontSelectValue(fontFamily?: string) {
  const normalizedFontFamily = fontFamily || DEFAULT_HERO_NAME_FONT_FAMILY

  if (normalizedFontFamily === DEFAULT_HERO_NAME_FONT_FAMILY || normalizedFontFamily.includes('VALVEPulp') || normalizedFontFamily.includes('Valve Pulp')) {
    return NAME_FONT_VALUE_VALVE_PULP
  }

  return NAME_FONT_OPTIONS.some(option => option.value === normalizedFontFamily)
    ? normalizedFontFamily
    : NAME_FONT_VALUE_VALVE_PULP
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
  const pelletCountStat = stats.find(stat => stat.label === PELLET_COUNT_LABEL)
  const pelletCount = pelletCountStat ? Math.max(1, Math.floor(parseEditableNumber(pelletCountStat.value))) : 1

  return Math.floor(bulletDamage * bulletsPerSecond * pelletCount)
}

function buildWeaponBaseValues(stats: PanelStat[]) {
  return WEAPON_BASE_LABELS.reduce<Record<string, number>>((baseValues, label) => {
    baseValues[label] = parseEditableNumber(stats.find(stat => stat.label === label)?.value)

    return baseValues
  }, {})
}

function buildWeaponPanelBaseValues(weapon: WeaponStatsPayload) {
  return Object.fromEntries([
    [BASE_PANEL_ID, buildWeaponBaseValues(weapon.stats)],
    ...(weapon.panels ?? []).map(panel => [panel.id, buildWeaponBaseValues(panel.stats)]),
  ])
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
          placeholder="#ffffff"
          className={cn(styles.input, 'min-w-0 flex-1 text-[0.74rem] tracking-[0.08em]')}
          aria-label={`${label} hex value`}
        />
      </span>
    </label>
  )
}

function CloudUploadButton({ endpoint, label, className, onUploaded }: CloudUploadButtonProps) {
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadPolicy = UPLOAD_POLICIES[endpoint]

  return (
    <span className={cn(styles.cloudUploadWrap, className)} data-upload-error={Boolean(uploadError) || undefined}>
      <UploadButton
        endpoint={endpoint}
        appearance={{
          container: styles.cloudUploadContainer,
          button: cn(styles.cloudUploadButton, uploadError && styles.cloudUploadButtonError),
          allowedContent: styles.cloudUploadAllowed,
        }}
        content={{
          button: ({ isUploading }) => (isUploading ? 'Uploading...' : uploadError ? 'Select Different Asset' : label),
          allowedContent: () => null,
        }}
        onUploadBegin={() => setUploadError(null)}
        onBeforeUploadBegin={files => {
          const validation = validateUploadFiles(files, uploadPolicy)

          if (!validation.valid) {
            setUploadError(validation.message)
            return []
          }

          setUploadError(null)
          return files
        }}
        onClientUploadComplete={uploadedAssets => {
          const uploadedUrl = getUploadedAssetUrl(uploadedAssets)

          if (!uploadedUrl) {
            setUploadError('Upload completed without a file URL.')
            return
          }

          setUploadError(null)
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
  savedHeroStatus = 'private',
  allowCopies = false,
  initialStats = null,
  initialAbilityStats = null,
  isSaving = false,
  saveStatusMessage = null,
  saveFailure = null,
  onRetrySave,
  onBackgroundChange,
  onRenderSelectionChange,
  onDraftChange,
  onSaveHero,
}: HeroInfoEditorProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId>('overview')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [activeAbilityTarget, setActiveAbilityTarget] = useState<ActiveAbilityTarget | null>(null)
  const [abilityEditorRevision, setAbilityEditorRevision] = useState(0)
  const [isWeaponAssetModalOpen, setIsWeaponAssetModalOpen] = useState(false)
  const [isBackgroundAssetModalOpen, setIsBackgroundAssetModalOpen] = useState(false)
  const [isHeroRenderAssetModalOpen, setIsHeroRenderAssetModalOpen] = useState(false)
  const [secondAbilitySetModal, setSecondAbilitySetModal] = useState<SecondAbilitySetModal | null>(null)
  const [tagDragState, setTagDragState] = useState<TagDragState | null>(null)
  const initialStatsDraft = initialStats ?? (hasPersistedHeroId(hero) ? buildEmptyHeroStats(hero) : buildHeroStatsSeed(hero))
  const initialAbilityDraft = initialAbilityStats ?? buildDefaultAbilityStats(hero)
  const normalizedInitialAbilityDraft = normalizeAbilityStats(initialAbilityDraft, hero)
  const [statsDraft, setStatsDraft] = useState<HeroStatsPayload>(() => initialStatsDraft)
  const [abilityStatsDraft, setAbilityStatsDraft] = useState<AbilityStatsPayload>(() => normalizedInitialAbilityDraft)
  const [secondarySlotSelection, setSecondarySlotSelection] = useState<number[]>(() => normalizedInitialAbilityDraft.secondaryAbilitySlots ?? [])
  const [activeWeaponPanelId, setActiveWeaponPanelId] = useState(BASE_PANEL_ID)
  const [activeVitalityPanelId, setActiveVitalityPanelId] = useState(BASE_PANEL_ID)
  const [activeSpiritPanelId, setActiveSpiritPanelId] = useState(BASE_PANEL_ID)
  const [weaponBaseValuesByPanel, setWeaponBaseValuesByPanel] = useState<Record<string, Record<string, number>>>(() => buildWeaponPanelBaseValues(initialStatsDraft.weapon))
  const [weaponTagsInput, setWeaponTagsInput] = useState(() => initialStatsDraft.weapon.weaponAttributes.join(', '))
  const [heroNameInput, setHeroNameInput] = useState(savedHeroName)
  const [heroPortraitInput, setHeroPortraitInput] = useState(hero.portrait)
  const [allowCopiesInput, setAllowCopiesInput] = useState(allowCopies)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false)
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null)
  const recoveryReadyRef = useRef(false)

  useEffect(() => {
    const snapshot = readEditorRecovery()
    const timeoutId = window.setTimeout(() => {
      if (snapshot) {
        onDraftChange(snapshot.heroInfo)
        onBackgroundChange(snapshot.background)
        onRenderSelectionChange(snapshot.renderSelection)
        setStatsDraft(snapshot.stats)
        setAbilityStatsDraft(snapshot.abilityStats)
        setSecondarySlotSelection(snapshot.abilityStats.secondaryAbilitySlots ?? [])
        setWeaponBaseValuesByPanel(buildWeaponPanelBaseValues(snapshot.stats.weapon))
        setWeaponTagsInput(snapshot.stats.weapon.weaponAttributes.join(', '))
        setHeroNameInput(snapshot.heroName)
        setHeroPortraitInput(snapshot.portrait)
        setAllowCopiesInput(snapshot.allowCopies)
        setRecoveryStatus(`Recovered local draft from ${new Date(snapshot.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`)
      }

      recoveryReadyRef.current = true
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [onBackgroundChange, onDraftChange, onRenderSelectionChange])

  useEffect(() => {
    if (!recoveryReadyRef.current) return undefined

    const timeoutId = window.setTimeout(() => {
      writeEditorRecovery(buildEditorRecoverySnapshot({
        heroSlug: hero.slug,
        savedHeroId,
        heroInfo: restoreRequiredAbilityIcons(draft),
        background: selectedBackground,
        renderSelection,
        heroName: heroNameInput,
        portrait: heroPortraitInput,
        allowCopies: allowCopiesInput,
        stats: statsDraft,
        abilityStats: abilityStatsDraft,
      }))
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [abilityStatsDraft, allowCopiesInput, draft, hero.slug, heroNameInput, heroPortraitInput, renderSelection, savedHeroId, selectedBackground, statsDraft])
  const heroNamePreview = draft.nameValue.trim() || hero.displayName
  const heroNameTextStyle = getHeroNameTextStyle(draft)
  const nameSizeControlValue = getNameSizeControlValue(draft.nameFontSize)
  const selectedBackgroundOption = backgroundOptions.find(option => option.path === selectedBackground) ?? backgroundOptions[0]
  const exportHeroName = getDraftName() || heroNamePreview
  const exportPayload = buildCharacterExportPayload(
    {
      ...hero,
      displayName: exportHeroName,
      render: getRenderPath(),
      heroInfo: restoreRequiredAbilityIcons(draft),
    },
    {
      hero: {
        slug: hero.slug,
        name: exportHeroName,
        portrait: heroPortraitInput,
        render: getRenderPath(),
      },
      heroInfo: restoreRequiredAbilityIcons(draft),
      weapon: statsDraft.weapon,
      vitality: statsDraft.vitality,
      spirit: statsDraft.spirit,
    },
    {
      name: exportHeroName,
      render: getRenderPath(),
      heroInfo: restoreRequiredAbilityIcons(draft),
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
  const activeWeaponPanel = statsDraft.weapon.panels?.find(panel => panel.id === activeWeaponPanelId)
  const activeVitalityPanel = statsDraft.vitality.panels?.find(panel => panel.id === activeVitalityPanelId)
  const activeSpiritPanel = statsDraft.spirit.panels?.find(panel => panel.id === activeSpiritPanelId)
  const activeWeaponStats = activeWeaponPanel?.stats ?? statsDraft.weapon.stats
  const activeWeaponBulletDps = activeWeaponPanel?.bulletDPS ?? statsDraft.weapon.bulletDPS
  const activeWeaponMinRange = activeWeaponPanel?.weaponMinRange ?? statsDraft.weapon.weaponMinRange
  const activeWeaponMaxRange = activeWeaponPanel?.weaponMaxRange ?? statsDraft.weapon.weaponMaxRange
  const activeVitalityStats = activeVitalityPanel?.stats ?? statsDraft.vitality.stats
  const activeSpiritTopStats = activeSpiritPanel?.topStats ?? statsDraft.spirit.topStats
  const activeSpiritPowerStat = activeSpiritPanel?.spiritPowerStat ?? statsDraft.spirit.spiritPowerStat

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
      const baseValue = weaponBaseValuesByPanel[activeWeaponPanelId]?.[modifierTarget] ?? parseEditableNumber(calculatedStats.find(stat => stat.label === modifierTarget)?.value)
      const modifierValue = parseEditableNumber(changedValue) / 100
      const calculatedValue = baseValue * (1 + modifierValue)

      calculatedStats = calculatedStats.map(stat => (stat.label === modifierTarget ? { ...stat, value: formatCalculatedWeaponStat(modifierTarget, calculatedValue) } : stat))
    } else if (WEAPON_BASE_LABELS.some(label => label === changedStat.label)) {
      const parsedValue = parseEditableNumber(changedValue)

      setWeaponBaseValuesByPanel(currentValues => ({
        ...currentValues,
        [activeWeaponPanelId]: {
          ...currentValues[activeWeaponPanelId],
          [changedStat.label]: parsedValue,
        },
      }))
    }

    updateActiveWeaponPanel({
      stats: calculatedStats,
      bulletDPS: calculateBulletDps(calculatedStats),
    })
  }

  function handleVitalityStatsChange(nextStats: PanelStat[], changedStat: PanelStat) {
    const calculatedStats = nextStats.map(stat => (stat.label === changedStat.label ? { ...stat, value: sanitizeNumberInput(changedStat.value) } : stat))

    if (!activeVitalityPanel) {
      setStatsDraft(currentDraft => ({ ...currentDraft, vitality: { ...currentDraft.vitality, stats: calculatedStats } }))
      return
    }

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      vitality: {
        ...currentDraft.vitality,
        panels: (currentDraft.vitality.panels ?? []).map(panel => panel.id === activeVitalityPanel.id ? { ...panel, stats: calculatedStats } : panel),
      },
    }))
  }

  function handleSpiritTopStatsChange(nextStats: PanelStat[], changedStat: PanelStat) {
    const calculatedStats = nextStats.map(stat => (stat.label === changedStat.label ? { ...stat, value: sanitizeNumberInput(changedStat.value) } : stat))

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: activeSpiritPanel
        ? {
          ...currentDraft.spirit,
          panels: (currentDraft.spirit.panels ?? []).map(panel => panel.id === activeSpiritPanel.id ? { ...panel, topStats: calculatedStats } : panel),
        }
        : { ...currentDraft.spirit, topStats: calculatedStats },
    }))
  }

  function handleSpiritPowerStatChange(nextStat: PanelStat) {
    const normalizedStat = { ...nextStat, value: sanitizeNumberInput(nextStat.value) }

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: activeSpiritPanel
        ? {
          ...currentDraft.spirit,
          panels: (currentDraft.spirit.panels ?? []).map(panel => panel.id === activeSpiritPanel.id ? { ...panel, spiritPowerStat: normalizedStat } : panel),
        }
        : { ...currentDraft.spirit, spiritPowerStat: normalizedStat },
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

    const draftTextName = draft.nameType === 'text' ? draft.nameValue.trim() : ''

    if (draftTextName) {
      return draftTextName
    }

    return savedHeroName.trim()
  }

  function getDraftSecondaryAbilitySlots(draftToRead: AbilityStatsPayload) {
    return draftToRead.secondaryAbilities
      ? getSecondaryAbilitySlots(draftToRead.secondaryAbilitySlots, draftToRead.secondaryAbilityAnchorIndex, [])
      : []
  }

  function buildSecondaryAbilitiesForSlots(currentDraft: AbilityStatsPayload, nextSlots: number[]) {
    const currentSlots = getDraftSecondaryAbilitySlots(currentDraft)
    const currentSecondaryAbilities = currentDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, currentSlots)

    return nextSlots.map(primaryIndex => {
      const currentSecondaryIndex = currentSlots.indexOf(primaryIndex)

      return currentSecondaryIndex >= 0
        ? currentSecondaryAbilities[currentSecondaryIndex] ?? buildDefaultAbility(primaryIndex + 1, hero)
        : buildDefaultAbility(primaryIndex + 1, hero)
    })
  }

  const secondaryAbilitySlots = getDraftSecondaryAbilitySlots(abilityStatsDraft)
  const isSecondAbilitySetEnabled = secondaryAbilitySlots.length > 0
  const secondaryAbilities = isSecondAbilitySetEnabled
    ? abilityStatsDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, secondaryAbilitySlots)
    : []

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
        portrait: heroPortraitInput,
        render: getRenderPath(),
        background: selectedBackground,
      },
      allowCopies: allowCopiesInput,
      heroInfo: restoreRequiredAbilityIcons(draft),
      weapon: statsDraft.weapon,
      vitality: statsDraft.vitality,
      spirit: statsDraft.spirit,
      abilityStats: isSecondAbilitySetEnabled
        ? {
          ...abilityStatsDraft,
          secondaryAbilities: abilityStatsDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, secondaryAbilitySlots),
          secondaryAbilitySlots,
          secondaryAbilityAnchorIndex: undefined,
        }
        : {
          ...abilityStatsDraft,
          secondaryAbilities: undefined,
          secondaryAbilitySlots: undefined,
          secondaryAbilityAnchorIndex: undefined,
        },
    })
  }

  function commitAbilityDraft(nextAbility: AbilityDefinition, target: ActiveAbilityTarget | null = activeAbilityTarget) {
    if (!target) {
      return
    }

    const abilityControl = ABILITY_CONTROLS[nextAbility.slot - 1]

    setAbilityStatsDraft(currentDraft => ({
      ...currentDraft,
      abilities: target.set === 'primary'
        ? currentDraft.abilities.map((ability, index) => (index === target.index ? nextAbility : ability))
        : currentDraft.abilities,
      secondaryAbilities: target.set === 'secondary'
        ? (currentDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, getDraftSecondaryAbilitySlots(currentDraft))).map((ability, index) => (index === target.index ? nextAbility : ability))
        : currentDraft.secondaryAbilities,
    }))

    if (target.set === 'primary' && abilityControl) {
      updateDraft({
        [abilityControl.iconKey]: nextAbility.icon,
      })
    }
  }

  function handleAbilitySave(nextAbility: AbilityDefinition) {
    commitAbilityDraft(nextAbility)
    setActiveAbilityTarget(null)
  }

  function updateActiveWeaponPanel(nextPanel: Partial<Pick<WeaponStatsPayload, 'stats' | 'bulletDPS' | 'weaponMinRange' | 'weaponMaxRange'>>) {
    if (!activeWeaponPanel) {
      updateWeaponDraft(nextPanel)
      return
    }

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      weapon: {
        ...currentDraft.weapon,
        panels: (currentDraft.weapon.panels ?? []).map(panel => panel.id === activeWeaponPanel.id ? { ...panel, ...nextPanel } : panel),
      },
    }))
  }

  function updateActiveWeaponName(name: string) {
    if (!activeWeaponPanel) {
      updateWeaponDraft({ weaponName: name })
      return
    }

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      weapon: {
        ...currentDraft.weapon,
        panels: (currentDraft.weapon.panels ?? []).map(panel => panel.id === activeWeaponPanel.id ? { ...panel, name } : panel),
      },
    }))
  }

  function addWeaponPanel(name: string) {
    const id = `weapon-panel-${Date.now()}`
    const stats = structuredClone(activeWeaponStats)

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      weapon: {
        ...currentDraft.weapon,
        panels: [...(currentDraft.weapon.panels ?? []), {
          id,
          name,
          bulletDPS: activeWeaponBulletDps,
          weaponMinRange: activeWeaponMinRange,
          weaponMaxRange: activeWeaponMaxRange,
          stats,
        }],
      },
    }))
    setWeaponBaseValuesByPanel(current => ({ ...current, [id]: buildWeaponBaseValues(stats) }))
    setActiveWeaponPanelId(id)
  }

  function addVitalityPanel(name: string) {
    const id = `vitality-panel-${Date.now()}`

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      vitality: {
        ...currentDraft.vitality,
        panels: [...(currentDraft.vitality.panels ?? []), { id, name, stats: structuredClone(activeVitalityStats) }],
      },
    }))
    setActiveVitalityPanelId(id)
  }

  function renameVitalityPanel(id: string, name: string) {
    setStatsDraft(currentDraft => ({
      ...currentDraft,
      vitality: id === BASE_PANEL_ID
        ? { ...currentDraft.vitality, name }
        : {
          ...currentDraft.vitality,
          panels: (currentDraft.vitality.panels ?? []).map(panel => panel.id === id ? { ...panel, name } : panel),
        },
    }))
  }

  function addSpiritPanel(name: string) {
    const id = `spirit-panel-${Date.now()}`

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: {
        ...currentDraft.spirit,
        panels: [...(currentDraft.spirit.panels ?? []), {
          id,
          name,
          topStats: structuredClone(activeSpiritTopStats),
          spiritPowerStat: structuredClone(activeSpiritPowerStat),
        }],
      },
    }))
    setActiveSpiritPanelId(id)
  }

  function renameSpiritPanel(id: string, name: string) {
    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: id === BASE_PANEL_ID
        ? { ...currentDraft.spirit, name }
        : {
          ...currentDraft.spirit,
          panels: (currentDraft.spirit.panels ?? []).map(panel => panel.id === id ? { ...panel, name } : panel),
        },
    }))
  }

  function handleAbilityModeToggle(currentAbility: AbilityDefinition) {
    commitAbilityDraft(currentAbility)
    setIsPreviewMode(currentMode => !currentMode)
  }

  function handleFocusedAbilitySelect(target: ActiveAbilityTarget, currentAbility: AbilityDefinition) {
    commitAbilityDraft(currentAbility)
    setActiveAbilityTarget(target)
  }

  function handleAbilityIconChange(target: ActiveAbilityTarget, iconPath: string) {
    const abilityControl = ABILITY_CONTROLS[target.index]

    if (target.set === 'primary' && abilityControl) {
      updateDraft({
        [abilityControl.iconKey]: iconPath,
      })
    }

    setAbilityStatsDraft(currentDraft => ({
      ...currentDraft,
      abilities: target.set === 'primary'
        ? currentDraft.abilities.map((ability, index) => (index === target.index ? { ...ability, icon: iconPath } : ability))
        : currentDraft.abilities,
      secondaryAbilities: target.set === 'secondary'
        ? (currentDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, getDraftSecondaryAbilitySlots(currentDraft))).map((ability, index) => (index === target.index ? { ...ability, icon: iconPath } : ability))
        : currentDraft.secondaryAbilities,
    }))
  }

  function swapPrimaryAndSecondaryAbility(primaryIndex: number, currentAbility?: AbilityDefinition) {
    const secondaryIndex = secondaryAbilitySlots.indexOf(primaryIndex)
    const secondaryAbility = activeAbilityTarget?.set === 'secondary' && activeAbilityTarget.index === secondaryIndex && currentAbility
      ? currentAbility
      : secondaryAbilities[secondaryIndex]
    const abilityControl = ABILITY_CONTROLS[primaryIndex]

    if (secondaryIndex < 0 || !secondaryAbility || !abilityControl) {
      return
    }

    if (currentAbility && activeAbilityTarget) {
      commitAbilityDraft(currentAbility, activeAbilityTarget)
    }

    setAbilityStatsDraft(currentDraft => {
      const currentSlots = getDraftSecondaryAbilitySlots(currentDraft)
      const currentSecondaryIndex = currentSlots.indexOf(primaryIndex)
      const currentPrimary = currentDraft.abilities[primaryIndex]
      const currentSecondaryAbilities = currentDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, currentSlots)
      const currentSecondary = currentSecondaryAbilities[currentSecondaryIndex]

      if (!currentPrimary || currentSecondaryIndex < 0 || !currentSecondary) {
        return currentDraft
      }

      return {
        ...currentDraft,
        abilities: currentDraft.abilities.map((ability, index) => index === primaryIndex
          ? { ...currentSecondary, slot: currentPrimary.slot }
          : ability),
        secondaryAbilities: currentSecondaryAbilities.map((ability, index) => index === currentSecondaryIndex
          ? { ...currentPrimary, slot: currentSecondary.slot }
          : ability),
      }
    })

    updateDraft({
      [abilityControl.iconKey]: secondaryAbility.icon,
    })

    if ((activeAbilityTarget?.set === 'primary' && activeAbilityTarget.index === primaryIndex)
      || (activeAbilityTarget?.set === 'secondary' && activeAbilityTarget.index === secondaryIndex)) {
      setAbilityEditorRevision(current => current + 1)
    }
  }

  function getPreferredSecondarySlot() {
    if (activeAbilityTarget?.set === 'primary') {
      return activeAbilityTarget.index
    }

    if (activeAbilityTarget?.set === 'secondary') {
      return secondaryAbilitySlots[activeAbilityTarget.index] ?? null
    }

    return null
  }

  function openSecondAbilitySlotModal(preferredSlot: number | null = getPreferredSecondarySlot()) {
    const nextSelection = secondaryAbilitySlots.length
      ? secondaryAbilitySlots
      : preferredSlot !== null
        ? [preferredSlot]
        : []

    setSecondarySlotSelection(nextSelection)
    setSecondAbilitySetModal('selectSlots')
  }

  function handleSecondAbilitySetToggleRequest(enabled: boolean) {
    if (enabled) {
      openSecondAbilitySlotModal()
      return
    }

    setSecondAbilitySetModal('confirmRemove')
  }

  function toggleSecondarySlotSelection(slot: number) {
    setSecondarySlotSelection(currentSelection => normalizeSecondaryAbilitySlots(
      currentSelection.includes(slot)
        ? currentSelection.filter(currentSlot => currentSlot !== slot)
        : [...currentSelection, slot],
    ))
  }

  function applySecondaryAbilitySlots() {
    const nextSlots = normalizeSecondaryAbilitySlots(secondarySlotSelection)

    if (!nextSlots.length) {
      setSecondAbilitySetModal(isSecondAbilitySetEnabled ? 'confirmRemove' : null)
      return
    }

    const currentSecondaryPrimaryIndex = activeAbilityTarget?.set === 'secondary'
      ? secondaryAbilitySlots[activeAbilityTarget.index] ?? null
      : null

    setAbilityStatsDraft(currentDraft => ({
      ...currentDraft,
      secondaryAbilities: buildSecondaryAbilitiesForSlots(currentDraft, nextSlots),
      secondaryAbilitySlots: nextSlots,
      secondaryAbilityAnchorIndex: undefined,
    }))
    setSecondAbilitySetModal(null)

    if (currentSecondaryPrimaryIndex === null) {
      return
    }

    const nextSecondaryIndex = nextSlots.indexOf(currentSecondaryPrimaryIndex)

    setActiveAbilityTarget(nextSecondaryIndex >= 0
      ? { set: 'secondary', index: nextSecondaryIndex }
      : { set: 'primary', index: currentSecondaryPrimaryIndex })
  }

  function removeSecondAbilitySet() {
    const nextPrimaryTarget = activeAbilityTarget?.set === 'secondary'
      ? getPrimaryAbilityIndexForSecondary(activeAbilityTarget.index, secondaryAbilitySlots)
      : null

    setAbilityStatsDraft(currentDraft => ({
      ...currentDraft,
      secondaryAbilities: undefined,
      secondaryAbilitySlots: undefined,
      secondaryAbilityAnchorIndex: undefined,
    }))

    setSecondAbilitySetModal(null)
    setSecondarySlotSelection([])

    if (nextPrimaryTarget !== null) {
      setActiveAbilityTarget({ set: 'primary', index: nextPrimaryTarget })
    }
  }

  function handleFocusedSecondAbilitySetToggle(_enabled: boolean, currentAbility: AbilityDefinition) {
    commitAbilityDraft(currentAbility, activeAbilityTarget)
    openSecondAbilitySlotModal(currentAbility.slot - 1)
  }

  function updateTagTilt(tag: TagControl, tilt: number) {
    updateDraft({
      [tag.tiltKey]: clampTagTilt(tilt),
    })
  }

  function updateTagOffset(tag: TagControl, offsetY: number) {
    updateDraft({
      [tag.offsetKey]: clampTagOffset(offsetY),
    })
  }

  function handleTagWheel(event: WheelEvent<HTMLSpanElement>, tag: TagControl) {
    event.preventDefault()

    const wheelDirection = event.deltaY > 0 ? 1 : -1
    updateTagTilt(tag, draft[tag.tiltKey] + wheelDirection * TAG_WHEEL_STEP)
  }

  function handleTagHandlePointerDown(event: PointerEvent<HTMLElement>, tag: TagControl, mode: TagDragMode) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setTagDragState({
      tag,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startTilt: draft[tag.tiltKey],
      startOffsetY: draft[tag.offsetKey],
    })
  }

  function handleTagHandlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!tagDragState) {
      return
    }

    event.preventDefault()

    if (tagDragState.mode === 'rotate') {
      const tiltDelta = (event.clientX - tagDragState.startX) / TAG_DRAG_PIXELS_PER_DEGREE
      updateTagTilt(tagDragState.tag, tagDragState.startTilt + tiltDelta)
      return
    }

    updateTagOffset(tagDragState.tag, tagDragState.startOffsetY + event.clientY - tagDragState.startY)
  }

  function handleTagHandlePointerEnd(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setTagDragState(null)
  }

  function renderSecondAbilitySetModal() {
    if (!secondAbilitySetModal) {
      return null
    }

    return (
      <div className={styles.secondSetModalBackdrop} role="presentation">
        <section
          className={styles.secondSetModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="second-set-modal-title"
          data-testid="second-ability-set-modal"
        >
          {secondAbilitySetModal === 'selectSlots' ? (
            <>
              <div className={styles.secondSetModalHeader}>
                <h2 id="second-set-modal-title">SELECT SECONDARY ABILITIES</h2>
                <button type="button" className={styles.secondSetModalClose} aria-label="Close second ability set modal" onClick={() => setSecondAbilitySetModal(null)}>
                  X
                </button>
              </div>
              <p className={styles.secondSetModalCopy}>
                Choose exactly which abilities receive a second ability icon.
              </p>
              <div className={styles.secondaryAbilityChoices} aria-label="Secondary ability choices">
                <HeroAbilityIconRow
                  heroInfo={draft}
                  selectedPrimaryIndexes={secondarySlotSelection}
                  onAbilityClick={target => {
                    if (target.set === 'primary') {
                      toggleSecondarySlotSelection(target.index)
                    }
                  }}
                  primaryTestIdPrefix="second-set-choice"
                  primaryLabel={slot => `Toggle secondary Ability ${slot}`}
                  editable
                />
              </div>
              <div className={styles.secondSetConfirmActions}>
                <button type="button" className={styles.secondSetCancelButton} onClick={() => setSecondAbilitySetModal(null)}>
                  Cancel
                </button>
                <button type="button" className={styles.secondSetDeleteButton} onClick={applySecondaryAbilitySlots}>
                  Apply Selection
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.secondSetModalHeader}>
                <h2 id="second-set-modal-title">REMOVE SECOND SET?</h2>
                <button type="button" className={styles.secondSetModalClose} aria-label="Close second ability set modal" onClick={() => setSecondAbilitySetModal(null)}>
                  X
                </button>
              </div>
              <p className={styles.secondSetModalCopy}>
                Removing the second set will delete all secondary ability data as soon as the set disappears.
              </p>
              <div className={styles.secondSetConfirmActions}>
                <button type="button" className={styles.secondSetCancelButton} onClick={() => setSecondAbilitySetModal(null)}>
                  Keep Second Set
                </button>
                <button type="button" className={styles.secondSetDeleteButton} onClick={removeSecondAbilitySet}>
                  Delete Second Set
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  if (activeAbilityTarget !== null) {
    const activeAbilityDraft = activeAbilityTarget.set === 'primary'
      ? abilityStatsDraft.abilities[activeAbilityTarget.index] ?? buildDefaultAbility(activeAbilityTarget.index + 1, hero)
      : secondaryAbilities[activeAbilityTarget.index] ?? buildDefaultSecondaryAbilities(hero, secondaryAbilitySlots)[activeAbilityTarget.index]

    return (
      <>
        <AbilityEditor
          key={`${activeAbilityTarget.set}-${activeAbilityDraft.slot}-${abilityEditorRevision}`}
          ability={activeAbilityDraft}
          mode={isPreviewMode ? 'preview' : 'edit'}
          previewLayout="editor"
          propertyIconGroups={PROPERTY_ICON_GROUPS}
          hero={hero}
          heroInfo={draft}
          activeAbilityTarget={activeAbilityTarget}
          secondaryAbilities={secondaryAbilities}
          secondaryAbilitySlots={secondaryAbilitySlots}
          isSecondAbilitySetEnabled={isSecondAbilitySetEnabled}
          abilityIconGroups={ABILITY_ICON_GROUPS}
          showDetails={isPreviewMode}
          onHeroInfoChange={onDraftChange}
          onAbilityIconChange={handleAbilityIconChange}
          onAbilitySelect={handleFocusedAbilitySelect}
          onAbilitySwap={swapPrimaryAndSecondaryAbility}
          onSecondAbilitySetToggle={handleFocusedSecondAbilitySetToggle}
          onModeToggle={handleAbilityModeToggle}
          onSave={handleAbilitySave}
          onCancel={() => setActiveAbilityTarget(null)}
        />
        {renderSecondAbilitySetModal()}
      </>
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
                <input
                  type="text"
                  className={styles.nameTextInput}
                  data-testid="editor-name-text"
                  aria-label="Hero name text"
                  value={draft.nameValue}
                  placeholder={heroNamePreview}
                  onChange={event => updateDraft({ nameValue: event.target.value })}
                  style={heroNameTextStyle}
                />
              )}
            </div>

            <div className={cn(styles.tagsRow, 'flex-nowrap')} aria-label="Editable hero tags" data-testid="editor-tags-row">
              {tagPreview.map((tag, index) => (
                <span
                  key={tag.label}
                  aria-label={`${tag.label} preview`}
                  className={cn(styles.tagPreview, 'w-fit shrink-0')}
                  data-testid={`editor-tag-${index + 1}`}
                  data-tag-text={tag.text.trim() || tag.label}
                  onWheel={event => handleTagWheel(event, tag)}
                  style={{
                    transform: `rotate(${tag.tilt}deg) translateY(${tag.offsetY}px)`,
                    backgroundColor: draft.tagColor,
                    color: draft.tagTextColor,
                  }}
                >
                  <input
                    type="text"
                    aria-label={`${tag.label} text`}
                    className={cn(styles.tagTextInput, 'whitespace-nowrap')}
                    value={tag.text}
                    placeholder={tag.label}
                    onChange={event => updateDraft({ [tag.textKey]: event.target.value })}
                    onClick={event => event.stopPropagation()}
                    onPointerDown={event => event.stopPropagation()}
                    onWheel={event => event.stopPropagation()}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} rotate top left handle`}
                    className={cn(styles.tagDragHandle, styles.tagCornerHandle, styles.tagCornerTopLeft)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'rotate')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} rotate top right handle`}
                    className={cn(styles.tagDragHandle, styles.tagCornerHandle, styles.tagCornerTopRight)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'rotate')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} rotate bottom left handle`}
                    className={cn(styles.tagDragHandle, styles.tagCornerHandle, styles.tagCornerBottomLeft)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'rotate')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} rotate bottom right handle`}
                    className={cn(styles.tagDragHandle, styles.tagCornerHandle, styles.tagCornerBottomRight)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'rotate')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} vertical top edge handle`}
                    className={cn(styles.tagDragHandle, styles.tagEdgeHandle, styles.tagEdgeTop)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'moveY')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} vertical bottom edge handle`}
                    className={cn(styles.tagDragHandle, styles.tagEdgeHandle, styles.tagEdgeBottom)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'moveY')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} vertical left edge handle`}
                    className={cn(styles.tagDragHandle, styles.tagSideEdgeHandle, styles.tagEdgeLeft)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'moveY')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                  <button
                    type="button"
                    aria-label={`${tag.label} vertical right edge handle`}
                    className={cn(styles.tagDragHandle, styles.tagSideEdgeHandle, styles.tagEdgeRight)}
                    onPointerDown={event => handleTagHandlePointerDown(event, tag, 'moveY')}
                    onPointerMove={handleTagHandlePointerMove}
                    onPointerUp={handleTagHandlePointerEnd}
                    onPointerCancel={handleTagHandlePointerEnd}
                  />
                </span>
              ))}
            </div>

            <HeroAbilityIconRow
              heroInfo={draft}
              secondaryAbilities={secondaryAbilities}
              secondaryAbilitySlots={secondaryAbilitySlots}
              onAbilityClick={setActiveAbilityTarget}
              onAbilitySwap={!isPreviewMode ? swapPrimaryAndSecondaryAbility : undefined}
              className={styles.abilitiesRow}
              primaryTestIdPrefix="editor-ability"
              secondaryTestIdPrefix="editor-secondary-ability"
              primaryLabel={slot => `${isPreviewMode ? 'Preview' : 'Edit'} Ability ${slot}`}
              secondaryLabel={slot => `${isPreviewMode ? 'Preview' : 'Edit'} Secondary Ability ${slot}`}
              editable={!isPreviewMode}
            />
      </div>

      {activeTabId !== 'overview' ? (
        <aside className={styles.statsAside}>
          {activeTabId === 'weapon' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs
                baseName="Weapon"
                baseTabName={statsDraft.weapon.weaponName}
                variants={statsDraft.weapon.panels}
                activeId={activeWeaponPanel?.id ?? BASE_PANEL_ID}
                canAdd={!isPreviewMode}
                onSelect={setActiveWeaponPanelId}
                onAdd={addWeaponPanel}
              />
              <WeaponPanel
                key={`${isPreviewMode ? 'weapon-preview' : 'weapon-edit'}-${activeWeaponPanel?.id ?? BASE_PANEL_ID}`}
                isEditable={!isPreviewMode}
                showDetails={isPreviewMode}
                weaponName={activeWeaponPanel?.name ?? statsDraft.weapon.weaponName}
                weaponDesc={statsDraft.weapon.weaponDesc}
                gunImageSrc={statsDraft.weapon.gunImageSrc}
                weaponAttributes={statsDraft.weapon.weaponAttributes}
                weaponStats={activeWeaponStats}
                bulletDPS={activeWeaponBulletDps}
                weaponMinRange={activeWeaponMinRange}
                weaponMaxRange={activeWeaponMaxRange}
                onStatsChange={handleWeaponStatsChange}
                weaponAttributesText={weaponTagsInput}
                onWeaponNameChange={updateActiveWeaponName}
                onWeaponDescChange={value => updateWeaponDraft({ weaponDesc: value })}
                onWeaponAttributesTextChange={handleWeaponTagChange}
                onWeaponMinRangeChange={value => updateActiveWeaponPanel({ weaponMinRange: parseEditableNumber(value) })}
                onWeaponMaxRangeChange={value => updateActiveWeaponPanel({ weaponMaxRange: parseEditableNumber(value) })}
                onOpenWeaponAssetPicker={() => setIsWeaponAssetModalOpen(true)}
                weaponImageUploadControl={<CloudUploadButton endpoint="weaponImage" label="Upload" onUploaded={handleWeaponImageUpload} />}
              />
            </div>
          ) : null}

          {activeTabId === 'vitality' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs baseName="Vitality" baseTabName={statsDraft.vitality.name ?? 'Vitality'} variants={statsDraft.vitality.panels} activeId={activeVitalityPanel?.id ?? BASE_PANEL_ID} canAdd={!isPreviewMode} canRename={!isPreviewMode} onSelect={setActiveVitalityPanelId} onAdd={addVitalityPanel} onRename={renameVitalityPanel} />
              <HeroStatsVitalityPanel key={`${isPreviewMode ? 'vitality-preview' : 'vitality-edit'}-${activeVitalityPanel?.id ?? BASE_PANEL_ID}`} isEditable={!isPreviewMode} showDetails={isPreviewMode} stats={activeVitalityStats} onStatsChange={handleVitalityStatsChange} />
            </div>
          ) : null}

          {activeTabId === 'spirit' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs baseName="Spirit" baseTabName={statsDraft.spirit.name ?? 'Spirit'} variants={statsDraft.spirit.panels} activeId={activeSpiritPanel?.id ?? BASE_PANEL_ID} canAdd={!isPreviewMode} canRename={!isPreviewMode} onSelect={setActiveSpiritPanelId} onAdd={addSpiritPanel} onRename={renameSpiritPanel} />
              <HeroStatsSpiritPanel key={`${isPreviewMode ? 'spirit-preview' : 'spirit-edit'}-${activeSpiritPanel?.id ?? BASE_PANEL_ID}`} isEditable={!isPreviewMode} showDetails={isPreviewMode} stats={activeSpiritTopStats} spiritPowerStat={activeSpiritPowerStat} onStatsChange={handleSpiritTopStatsChange} onSpiritPowerStatChange={handleSpiritPowerStatChange} />
            </div>
          ) : null}
        </aside>
      ) : null}

      <div className={styles.controlRail}>
        <div className={styles.railHeader}>
          <div>
            <h2 className={styles.railTitle}>Create</h2>
            <p className={styles.railSubtitle}>{hero.displayName} draft</p>
          </div>
          <button
            type="button"
            className={cn(styles.previewModeButton, isPreviewMode && styles.previewModeButtonActive)}
            aria-pressed={isPreviewMode}
            onClick={() => setIsPreviewMode(currentMode => !currentMode)}
          >
            {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          </button>
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

          <div className={styles.fieldLabel}>
            <span>Background</span>
            <button
              type="button"
              className={styles.backgroundPickerButton}
              onClick={() => setIsBackgroundAssetModalOpen(true)}
              aria-label={`Choose background. Current: ${selectedBackgroundOption?.label ?? 'Unknown'}`}
              data-testid="editor-background-picker"
            >
              <span
                className={styles.backgroundPickerPreview}
                aria-hidden="true"
                style={{ backgroundImage: `url('${selectedBackground}')` }}
              />
              <span className={styles.backgroundPickerText}>
                {selectedBackgroundOption?.label ?? 'Choose Background'}
              </span>
            </button>
          </div>

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
              <>
                <label className={styles.fieldLabel} htmlFor="editor-name-font">
                  Font
                  <select
                    id="editor-name-font"
                    value={getNameFontSelectValue(draft.nameFontFamily)}
                    onChange={event => updateDraft({ nameFontFamily: event.target.value })}
                    className={styles.select}
                  >
                    {NAME_FONT_OPTIONS.map(option => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldLabel} htmlFor="editor-name-font-size">
                  Font Size
                  <span className={styles.sizeControl}>
                    <input
                      id="editor-name-font-size"
                      type="range"
                      min={NAME_SIZE_MIN}
                      max={NAME_SIZE_MAX}
                      step="1"
                      value={nameSizeControlValue}
                      onChange={event => updateDraft({ nameFontSize: getNameSizeCss(Number(event.target.value)) })}
                      className={styles.sizeRange}
                      aria-label="Font Size"
                    />
                    <input
                      type="number"
                      min={NAME_SIZE_MIN}
                      max={NAME_SIZE_MAX}
                      step="1"
                      value={nameSizeControlValue}
                      onChange={event => updateDraft({ nameFontSize: getNameSizeCss(Number(event.target.value)) })}
                      className={cn(styles.input, styles.sizeNumber)}
                      aria-label="Font size value"
                    />
                  </span>
                  <span className={styles.sizeHint}>
                    Size {nameSizeControlValue} of {NAME_SIZE_MAX}
                  </span>
                </label>
                <label className={styles.fieldLabel} htmlFor="editor-name-font-weight">
                  Weight
                  <select
                    id="editor-name-font-weight"
                    value={draft.nameFontWeight || DEFAULT_HERO_NAME_FONT_WEIGHT}
                    onChange={event => updateDraft({ nameFontWeight: event.target.value })}
                    className={styles.select}
                  >
                    {NAME_FONT_WEIGHTS.map(weight => (
                      <option key={weight.value} value={weight.value}>
                        {weight.label}
                      </option>
                    ))}
                  </select>

                </label>
              </>
            ) : (
              <CloudUploadButton
                endpoint="heroNameAsset"
                label="Upload name image"
                className={styles.uploadNameButton}
                onUploaded={handleNameUpload}
              />
            )}
          </div>

          <div className={styles.sectionGroup}>
            <ColorField label="Hero Name" value={draft.nameColor} onChange={value => updateDraft({ nameColor: value })} />
            <ColorField label="Tag Text" value={draft.tagTextColor} onChange={value => updateDraft({ tagTextColor: value })} />
            <ColorField label="Tag Rectangles" value={draft.tagColor} onChange={value => updateDraft({ tagColor: value })} />
            <ColorField label="Ability Icons" value={draft.abilityIconColor} onChange={value => updateDraft({ abilityIconColor: value })} />
            <ColorField label="Ability Circles" value={draft.abilityCircleColor} onChange={value => updateDraft({ abilityCircleColor: value })} />
            <label className={styles.copyToggle} htmlFor="editor-second-ability-set">
              <input
                id="editor-second-ability-set"
                type="checkbox"
                checked={isSecondAbilitySetEnabled}
                onChange={event => handleSecondAbilitySetToggleRequest(event.target.checked)}
              />
              <span aria-hidden="true" />
              <strong>Second Ability Set</strong>
            </label>
          </div>
        </div>

        <div className={styles.globalActions}>
          <div className={styles.portraitUploadPanel}>
            <span className={styles.portraitUploadTitle}>Portrait</span>
            <div className={styles.portraitUploadContent}>
              <div className={styles.portraitPreviewCard} aria-label={`${exportHeroName} portrait preview`} role="img" data-testid="editor-portrait-preview">
                <span className={styles.portraitPreviewBacker} />
                <span className={styles.portraitPreviewImage} data-testid="editor-portrait-preview-image" aria-hidden="true" style={{ backgroundImage: `url('${heroPortraitInput}')` }} />
                <span className={styles.portraitPreviewBorder} />
                <span className={styles.portraitPreviewTint} />
              </div>
              <div className={styles.portraitUploadControls}>
                <CloudUploadButton endpoint="heroPortrait" label="Upload portrait" onUploaded={setHeroPortraitInput} />
                {heroPortraitInput !== hero.portrait ? (
                  <button type="button" className={styles.resetPortraitButton} onClick={() => setHeroPortraitInput(hero.portrait)}>
                    Default Portrait
                  </button>
                ) : null}
              </div>
            </div>
          </div>
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
          {savedHeroStatus === 'published' ? (
            <>
              <button
                type="button"
                className={styles.publishActionButton}
                disabled={isSaving}
                onClick={() => handleGlobalSave('published')}
              >
                Save Published Changes
              </button>
              <button
                type="button"
                className={styles.unpublishActionButton}
                disabled={isSaving}
                onClick={() => setIsUnpublishConfirmOpen(true)}
              >
                Unpublish Hero
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
          <CharacterExportButton payload={exportPayload} className={styles.exportActionButton} />
          {saveError ? <p className={styles.saveError} role="alert">{saveError}</p> : null}
          {saveFailure && onRetrySave ? <SaveFailureBanner reason={saveFailure} onRetry={onRetrySave} /> : null}
          {saveStatusMessage ? <SystemToast message={saveStatusMessage} /> : null}
          {recoveryStatus && !saveStatusMessage ? <SystemToast message={recoveryStatus} /> : null}
        </div>
      </div>

      {isUnpublishConfirmOpen ? (
        <div className={styles.secondSetModalBackdrop} role="presentation">
          <section
            className={styles.secondSetModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unpublish-hero-modal-title"
          >
            <div className={styles.secondSetModalHeader}>
              <h2 id="unpublish-hero-modal-title">Unpublish Hero?</h2>
              <button type="button" className={styles.secondSetModalClose} aria-label="Close unpublish confirmation" onClick={() => setIsUnpublishConfirmOpen(false)}>
                X
              </button>
            </div>
            <p className={styles.secondSetModalCopy}>
              This hero will be removed from Browse and returned to your private saves. You can publish it again later.
            </p>
            <div className={styles.secondSetConfirmActions}>
              <button type="button" className={styles.secondSetCancelButton} onClick={() => setIsUnpublishConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.secondSetDeleteButton}
                disabled={isSaving}
                onClick={() => {
                  setIsUnpublishConfirmOpen(false)
                  handleGlobalSave('private')
                }}
              >
                Confirm Unpublish
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {secondAbilitySetModal ? (
        <div className={styles.secondSetModalBackdrop} role="presentation">
          <section
            className={styles.secondSetModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="second-set-modal-title"
            data-testid="second-ability-set-modal"
          >
            {secondAbilitySetModal === 'selectSlots' ? (
              <>
                <div className={styles.secondSetModalHeader}>
                  <h2 id="second-set-modal-title">SELECT SECONDARY ABILITIES</h2>
                  <button type="button" className={styles.secondSetModalClose} aria-label="Close second ability set modal" onClick={() => setSecondAbilitySetModal(null)}>
                    ×
                  </button>
                </div>
                <p className={styles.secondSetModalCopy}>
                  Choose exactly which abilities receive a second ability icon.
                </p>
                <div className={styles.secondaryAbilityChoices} aria-label="Secondary ability choices">
                  <HeroAbilityIconRow
                    heroInfo={draft}
                    selectedPrimaryIndexes={secondarySlotSelection}
                    onAbilityClick={target => {
                      if (target.set === 'primary') {
                        toggleSecondarySlotSelection(target.index)
                      }
                    }}
                    primaryTestIdPrefix="second-set-choice"
                    primaryLabel={slot => `Toggle secondary Ability ${slot}`}
                    editable
                  />
                </div>
                <div className={styles.secondSetConfirmActions}>
                  <button type="button" className={styles.secondSetCancelButton} onClick={() => setSecondAbilitySetModal(null)}>
                    Cancel
                  </button>
                  <button type="button" className={styles.secondSetDeleteButton} onClick={applySecondaryAbilitySlots}>
                    Apply Selection
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.secondSetModalHeader}>
                  <h2 id="second-set-modal-title">REMOVE SECOND SET?</h2>
                  <button type="button" className={styles.secondSetModalClose} aria-label="Close second ability set modal" onClick={() => setSecondAbilitySetModal(null)}>
                    ×
                  </button>
                </div>
                <p className={styles.secondSetModalCopy}>
                  Removing the second set will delete all secondary ability data as soon as the set disappears.
                </p>
                <div className={styles.secondSetConfirmActions}>
                  <button type="button" className={styles.secondSetCancelButton} onClick={() => setSecondAbilitySetModal(null)}>
                    Keep Second Set
                  </button>
                  <button type="button" className={styles.secondSetDeleteButton} onClick={removeSecondAbilitySet}>
                    Delete Second Set
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isBackgroundAssetModalOpen ? (
        <EditorAssetModal
          title="Background"
          description="Choose a hero background for the editor stage."
          groups={HERO_BACKGROUND_GROUPS}
          previewMode="image"
          testId="background-modal"
          onClose={() => setIsBackgroundAssetModalOpen(false)}
          onSelect={assetPath => {
            onBackgroundChange(assetPath)
            setIsBackgroundAssetModalOpen(false)
          }}
        />
      ) : null}

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
