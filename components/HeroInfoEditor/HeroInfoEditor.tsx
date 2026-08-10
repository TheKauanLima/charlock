'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, WheelEvent } from 'react'
import { ArrowLeft, MessageSquareText, Sparkles, UserRound } from 'lucide-react'

import type { OurFileRouter } from '@/app/api/uploadthing/core'
import AbilityEditor from '@/components/AbilityEditor/AbilityEditor'
import CharacterExportButton from '@/components/CharacterExport/CharacterExportButton'
import EditorAssetModal from '@/components/EditorAssetModal/EditorAssetModal'
import HeroAbilityIconRow from '@/components/HeroAbilityIconRow/HeroAbilityIconRow'
import InteractionCreator from '@/components/InteractionCreator/InteractionCreator'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import HeroStatsBoonPanel from '@/components/panels/hero-stats-boon-panel'
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
import type { CustomHeroSavePayload, CustomHeroStatus, HeroInteraction } from '@/lib/custom-hero-types'
import { getCustomHeroSaveIssueMessages } from '@/lib/custom-hero-validation'
import { ANONYMOUS_RECOVERY_OWNER_ID, buildEditorRecoverySnapshot, readEditorRecovery, writeEditorRecovery, type EditorRecoveryReason } from '@/lib/editor-recovery'
import { DEFAULT_HERO_NAME_FONT_FAMILY, DEFAULT_HERO_NAME_FONT_SIZE, DEFAULT_HERO_NAME_FONT_WEIGHT, type HeroDefinition, type HeroInfoDefinition } from '@/lib/hero-data'
import { buildEmptyHeroStats, buildHeroStatsSeed, type HeroStatsPayload, type WeaponPanelVariant, type WeaponStatsPayload } from '@/lib/hero-stats-shared'
import { getItemLimitMessage, notifyIfLimitedTextKeyDown, notifyIfLimitedTextPaste } from '@/lib/input-limit-feedback'
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
  recoveryOwnerId?: string
  allowCopies?: boolean
  initialStats?: HeroStatsPayload | null
  initialAbilityStats?: AbilityStatsPayload | null
  initialInteractions?: HeroInteraction[]
  isSaving?: boolean
  isDraftSaving?: boolean
  saveStatusMessage?: string | null
  saveFailure?: string | null
  onRetrySave?: () => void
  onBackgroundChange: (backgroundPath: string) => void
  onRenderSelectionChange: (renderSelection: EditorRenderSelection) => void
  onDraftChange: (draft: HeroInfoDefinition) => void
  onSaveHero: (payload: CustomHeroSavePayload, options?: { mode?: 'manual' | 'draft' | 'exit' }) => Promise<boolean>
  onInteractionPanelOpenChange?: (isOpen: boolean) => void
  onExitEditor?: () => void
}

type DraftAutosaveUnit = 'minutes'

interface DraftAutosavePreference {
  amount: number
  unit: DraftAutosaveUnit
}

const DRAFT_AUTOSAVE_STORAGE_KEY = 'charlock_draft_autosave_interval'
const DEFAULT_DRAFT_AUTOSAVE_PREFERENCE: DraftAutosavePreference = { amount: 1, unit: 'minutes' }
const DRAFT_AUTOSAVE_AMOUNT_MIN = 1
const DRAFT_AUTOSAVE_AMOUNT_MAX = 60

function clampDraftAutosaveAmount(value: string | number) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_DRAFT_AUTOSAVE_PREFERENCE.amount
  }

  return Math.min(DRAFT_AUTOSAVE_AMOUNT_MAX, Math.max(DRAFT_AUTOSAVE_AMOUNT_MIN, Math.round(numericValue)))
}

function isDraftAutosaveUnit(value: unknown): value is DraftAutosaveUnit {
  return value === 'minutes'
}

function normalizeDraftAutosavePreference(value: Partial<DraftAutosavePreference> | null | undefined): DraftAutosavePreference {
  if (value?.unit !== 'minutes') {
    return DEFAULT_DRAFT_AUTOSAVE_PREFERENCE
  }

  return {
    amount: clampDraftAutosaveAmount(value.amount ?? DEFAULT_DRAFT_AUTOSAVE_PREFERENCE.amount),
    unit: 'minutes',
  }
}

function readDraftAutosavePreference(): DraftAutosavePreference {
  if (typeof window === 'undefined') {
    return DEFAULT_DRAFT_AUTOSAVE_PREFERENCE
  }

  try {
    const storedValue = window.localStorage.getItem(DRAFT_AUTOSAVE_STORAGE_KEY)
    const parsedValue = storedValue ? JSON.parse(storedValue) as Partial<DraftAutosavePreference> : null

    return normalizeDraftAutosavePreference(parsedValue)
  } catch {
    return DEFAULT_DRAFT_AUTOSAVE_PREFERENCE
  }
}

function getDraftAutosaveIntervalMs(preference: DraftAutosavePreference) {
  return Math.max(60_000, preference.amount * 60_000)
}

function getDraftAutosaveIntervalLabel(preference: DraftAutosavePreference) {
  const singularUnit = 'minute'
  const unitLabel = preference.amount === 1 ? singularUnit : `${singularUnit}s`

  return `${preference.amount} ${unitLabel}`
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
type ControlRailTabId = 'text' | 'colors' | 'images' | 'interactions' | 'options'

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

const CONTROL_RAIL_TABS: Array<{ id: ControlRailTabId; label: string; shortLabel: string }> = [
  { id: 'text', label: 'Text and font settings', shortLabel: 'Aa' },
  { id: 'colors', label: 'Color settings', shortLabel: '◐' },
  { id: 'images', label: 'Image settings', shortLabel: '▧' },
  { id: 'options', label: 'Editor options', shortLabel: '⚙' },
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
const DEFAULT_RENDER_POSITION = { x: 0, y: 0 }
const HERO_NAME_TEXT_MAX_LENGTH = 500
const HERO_TAG_TEXT_MAX_LENGTH = 80
const DRAFT_NAME_MAX_LENGTH = 120
const SECONDARY_ABILITY_SLOT_MAX_COUNT = 4

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

function buildWeaponTagsInputByPanel(weapon: WeaponStatsPayload) {
  return Object.fromEntries([
    [BASE_PANEL_ID, weapon.weaponAttributes.join(', ')],
    ...(weapon.panels ?? []).map(panel => [panel.id, (panel.weaponAttributes ?? weapon.weaponAttributes).join(', ')]),
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
  recoveryOwnerId = ANONYMOUS_RECOVERY_OWNER_ID,
  allowCopies = false,
  initialStats = null,
  initialAbilityStats = null,
  initialInteractions = [],
  isSaving = false,
  isDraftSaving = false,
  saveStatusMessage = null,
  saveFailure = null,
  onRetrySave,
  onBackgroundChange,
  onRenderSelectionChange,
  onDraftChange,
  onSaveHero,
  onInteractionPanelOpenChange,
  onExitEditor,
}: HeroInfoEditorProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId | null>('overview')
  const [activeControlRailTab, setActiveControlRailTab] = useState<ControlRailTabId>('text')
  const [isControlRailCollapsed, setIsControlRailCollapsed] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [activeAbilityTarget, setActiveAbilityTarget] = useState<ActiveAbilityTarget | null>(null)
  const focusedAbilityDraftRef = useRef<AbilityDefinition | null>(null)
  const [abilityEditorRevision, setAbilityEditorRevision] = useState(0)
  const [isWeaponAssetModalOpen, setIsWeaponAssetModalOpen] = useState(false)
  const [isBackgroundAssetModalOpen, setIsBackgroundAssetModalOpen] = useState(false)
  const [isHeroRenderAssetModalOpen, setIsHeroRenderAssetModalOpen] = useState(false)
  const [secondAbilitySetModal, setSecondAbilitySetModal] = useState<SecondAbilitySetModal | null>(null)
  const [tagDragState, setTagDragState] = useState<TagDragState | null>(null)
  const initialStatsDraft = initialStats ?? (hasPersistedHeroId(hero) ? buildEmptyHeroStats(hero) : buildHeroStatsSeed(hero))
  const initialAbilityDraft = initialAbilityStats ?? buildDefaultAbilityStats(hero)
  const normalizedInitialAbilityDraft = normalizeAbilityStats(initialAbilityDraft, hero)
  const initialInteractionsRef = useRef(initialInteractions)
  const [statsDraft, setStatsDraft] = useState<HeroStatsPayload>(() => initialStatsDraft)
  const [abilityStatsDraft, setAbilityStatsDraft] = useState<AbilityStatsPayload>(() => normalizedInitialAbilityDraft)
  const [interactionsDraft, setInteractionsDraft] = useState<HeroInteraction[]>(() => initialInteractions.map(interaction => ({
    ...interaction,
    lines: interaction.lines.map(line => ({ ...line })),
  })))
  const [secondarySlotSelection, setSecondarySlotSelection] = useState<number[]>(() => normalizedInitialAbilityDraft.secondaryAbilitySlots ?? [])
  const [activeBoonPanelId, setActiveBoonPanelId] = useState(BASE_PANEL_ID)
  const [activeWeaponPanelId, setActiveWeaponPanelId] = useState(BASE_PANEL_ID)
  const [activeVitalityPanelId, setActiveVitalityPanelId] = useState(BASE_PANEL_ID)
  const [activeSpiritPanelId, setActiveSpiritPanelId] = useState(BASE_PANEL_ID)
  const [weaponBaseValuesByPanel, setWeaponBaseValuesByPanel] = useState<Record<string, Record<string, number>>>(() => buildWeaponPanelBaseValues(initialStatsDraft.weapon))
  const [weaponTagsInputByPanel, setWeaponTagsInputByPanel] = useState<Record<string, string>>(() => buildWeaponTagsInputByPanel(initialStatsDraft.weapon))
  const [heroNameInput, setHeroNameInput] = useState(savedHeroName)
  const [heroPortraitInput, setHeroPortraitInput] = useState(hero.portrait)
  const [allowCopiesInput, setAllowCopiesInput] = useState(allowCopies)
  const [draftAutosavePreference, setDraftAutosavePreference] = useState<DraftAutosavePreference>(readDraftAutosavePreference)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [blockedActionToast, setBlockedActionToast] = useState<{ id: number; message: string } | null>(null)
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false)
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const recoveryReadyRef = useRef(false)
  const recoveryReasonRef = useRef<EditorRecoveryReason>('editing')
  const recoveryFailureMessageRef = useRef<string | undefined>(undefined)
  const lastCloudSavedRecoverySignatureRef = useRef<string | null>(null)
  const recoveryCheckpointRef = useRef<(reason?: EditorRecoveryReason, failureMessage?: string, force?: boolean) => void>(() => undefined)
  const draftAutosaveIntervalMs = useMemo(() => getDraftAutosaveIntervalMs(draftAutosavePreference), [draftAutosavePreference])
  const draftAutosaveIntervalLabel = useMemo(() => getDraftAutosaveIntervalLabel(draftAutosavePreference), [draftAutosavePreference])

  useEffect(() => {
    recoveryReadyRef.current = false
    const snapshot = readEditorRecovery(recoveryOwnerId)
    const timeoutId = window.setTimeout(() => {
      const matchesCurrentEditor = snapshot
        ? snapshot.savedHeroId
          ? snapshot.savedHeroId === savedHeroId
          : !savedHeroId && snapshot.heroSlug === hero.slug
        : false

      if (snapshot && matchesCurrentEditor) {
        onDraftChange(snapshot.heroInfo)
        onBackgroundChange(snapshot.background)
        onRenderSelectionChange(snapshot.renderSelection)
        setStatsDraft(snapshot.stats)
        setAbilityStatsDraft(snapshot.abilityStats)
        setInteractionsDraft(snapshot.interactions ?? initialInteractionsRef.current)
        setSecondarySlotSelection(snapshot.abilityStats.secondaryAbilitySlots ?? [])
        setWeaponBaseValuesByPanel(buildWeaponPanelBaseValues(snapshot.stats.weapon))
        setWeaponTagsInputByPanel(buildWeaponTagsInputByPanel(snapshot.stats.weapon))
        setHeroNameInput(snapshot.heroName)
        setHeroPortraitInput(snapshot.portrait)
        setAllowCopiesInput(snapshot.allowCopies)
        recoveryReasonRef.current = snapshot.recoveryReason
        recoveryFailureMessageRef.current = snapshot.failureMessage
        const recoveredAt = new Date(snapshot.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        const recoveryMessage = snapshot.recoveryReason === 'editing'
          ? `Recovered unsaved changes from this device (${recoveredAt}).`
          : `Recovered a draft whose cloud save did not complete (${recoveredAt}). Review it, then use Save Draft Now.`

        setRecoveryStatus(recoveryMessage)
        setRecoveryNotice(recoveryMessage)
      }

      recoveryReadyRef.current = true
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [hero.slug, onBackgroundChange, onDraftChange, onRenderSelectionChange, recoveryOwnerId, savedHeroId])

  useEffect(() => {
    if (!recoveryReadyRef.current) return undefined

    const timeoutId = window.setTimeout(() => {
      recoveryCheckpointRef.current()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [abilityStatsDraft, allowCopiesInput, draft, hero.slug, heroNameInput, heroPortraitInput, interactionsDraft, recoveryOwnerId, renderSelection, savedHeroId, selectedBackground, statsDraft])

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_AUTOSAVE_STORAGE_KEY, JSON.stringify(draftAutosavePreference))
    } catch {
      // Keep the active in-memory setting even if local storage is unavailable.
    }
  }, [draftAutosavePreference])

  const heroNamePreview = draft.nameValue.trim() || hero.displayName
  const heroNameTextStyle = getHeroNameTextStyle(draft)
  const nameSizeControlValue = getNameSizeControlValue(draft.nameFontSize)
  const selectedBackgroundOption = backgroundOptions.find(option => option.path === selectedBackground) ?? backgroundOptions[0]
  const exportHeroName = getDraftName() || heroNamePreview
  const boonHeroName = getDraftName() || hero.displayName
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
        portrait: heroPortraitInput,
        render: getRenderPath(),
      },
      heroInfo: draft,
      boon: statsDraft.boon,
      weapon: statsDraft.weapon,
      vitality: statsDraft.vitality,
      spirit: statsDraft.spirit,
    },
    {
      name: exportHeroName,
      render: getRenderPath(),
      heroInfo: draft,
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
  const activeBoonPanel = statsDraft.boon.panels?.find(panel => panel.id === activeBoonPanelId)
  const activeWeaponPanel = statsDraft.weapon.panels?.find(panel => panel.id === activeWeaponPanelId)
  const activeVitalityPanel = statsDraft.vitality.panels?.find(panel => panel.id === activeVitalityPanelId)
  const activeSpiritPanel = statsDraft.spirit.panels?.find(panel => panel.id === activeSpiritPanelId)
  const activeBoonStats = activeBoonPanel?.stats ?? statsDraft.boon.stats
  const activeWeaponStats = activeWeaponPanel?.stats ?? statsDraft.weapon.stats
  const activeWeaponDesc = activeWeaponPanel?.weaponDesc ?? statsDraft.weapon.weaponDesc
  const activeWeaponImage = activeWeaponPanel?.gunImageSrc ?? statsDraft.weapon.gunImageSrc
  const activeWeaponAttributes = activeWeaponPanel?.weaponAttributes ?? statsDraft.weapon.weaponAttributes
  const activeWeaponTagsInput = weaponTagsInputByPanel[activeWeaponPanelId] ?? activeWeaponAttributes.join(', ')
  const activeWeaponBulletDps = activeWeaponPanel?.bulletDPS ?? statsDraft.weapon.bulletDPS
  const activeWeaponMinRange = activeWeaponPanel?.weaponMinRange ?? statsDraft.weapon.weaponMinRange
  const activeWeaponMaxRange = activeWeaponPanel?.weaponMaxRange ?? statsDraft.weapon.weaponMaxRange
  const activeVitalityStats = activeVitalityPanel?.stats ?? statsDraft.vitality.stats
  const activeSpiritTopStats = activeSpiritPanel?.topStats ?? statsDraft.spirit.topStats
  const activeSpiritPowerStat = activeSpiritPanel?.spiritPowerStat ?? statsDraft.spirit.spiritPowerStat

  useEffect(() => {
    if (!activeTabId) return undefined

    function handlePanelClickAway(event: globalThis.PointerEvent) {
      if (event.target instanceof Element && event.target.closest('[data-testid="hero-sidebar-tabs"], [data-hero-stat-panel="true"], [data-interaction-creator="true"], [role="dialog"]')) return
      setActiveTabId(null)
    }

    document.addEventListener('pointerdown', handlePanelClickAway)
    return () => document.removeEventListener('pointerdown', handlePanelClickAway)
  }, [activeTabId])

  function handleTabSelect(tabId: SidebarTabId) {
    closeFocusedAbilityEditorWithSave()
    setActiveControlRailTab(currentTab => currentTab === 'interactions' ? 'text' : currentTab)
    setActiveTabId(current => current === tabId ? null : tabId)
  }

  function updateDraft(nextDraft: Partial<HeroInfoDefinition>) {
    onDraftChange({
      ...draft,
      ...nextDraft,
    })
  }

  function showBlockedAction(message: string) {
    setBlockedActionToast(currentToast => ({
      id: (currentToast?.id ?? 0) + 1,
      message,
    }))
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
    updateActiveWeaponPanel({
      gunImageSrc: uploadUrl,
    })
  }

  function handleHeroRenderUpload(uploadUrl: string) {
    onRenderSelectionChange({
      mode: 'custom',
      src: uploadUrl,
      position: DEFAULT_RENDER_POSITION,
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
    const weaponAttributes = value
      .split(',')
      .map(attribute => attribute.trim())
      .filter(Boolean)

    setWeaponTagsInputByPanel(currentTags => ({
      ...currentTags,
      [activeWeaponPanelId]: value,
    }))
    updateActiveWeaponPanel({
      weaponAttributes,
    })
  }

  function getRenderPath() {
    if ((renderSelection.mode === 'hero' || renderSelection.mode === 'custom') && renderSelection.src) {
      return renderSelection.src
    }

    return selectedBackground
  }

  function getRenderPosition() {
    return renderSelection.mode === 'background' ? DEFAULT_RENDER_POSITION : renderSelection.position ?? DEFAULT_RENDER_POSITION
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

  const shouldAutoSaveDraft = savedHeroStatus !== 'published'
  const lastSavedDraftSignatureRef = useRef<string | null>(null)
  const draftSaveInFlightRef = useRef(false)

  function getAbilityStatsForSave() {
    const focusedAbilityDraft = focusedAbilityDraftRef.current
    const focusedDraft = focusedAbilityDraft && activeAbilityTarget
      ? {
        ...abilityStatsDraft,
        abilities: activeAbilityTarget.set === 'primary'
          ? abilityStatsDraft.abilities.map((ability, index) => (index === activeAbilityTarget.index ? focusedAbilityDraft : ability))
          : abilityStatsDraft.abilities,
        secondaryAbilities: activeAbilityTarget.set === 'secondary'
          ? (abilityStatsDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, getDraftSecondaryAbilitySlots(abilityStatsDraft))).map((ability, index) => (index === activeAbilityTarget.index ? focusedAbilityDraft : ability))
          : abilityStatsDraft.secondaryAbilities,
      }
      : abilityStatsDraft
    const slots = getDraftSecondaryAbilitySlots(focusedDraft)

    return slots.length > 0
      ? {
        ...focusedDraft,
        secondaryAbilities: focusedDraft.secondaryAbilities ?? buildDefaultSecondaryAbilities(hero, slots),
        secondaryAbilitySlots: slots,
        secondaryAbilityAnchorIndex: undefined,
      }
      : {
        ...focusedDraft,
        secondaryAbilities: undefined,
        secondaryAbilitySlots: undefined,
        secondaryAbilityAnchorIndex: undefined,
      }
  }

  function buildSavePayload(status: CustomHeroStatus): CustomHeroSavePayload {
    return {
      id: savedHeroId,
      name: getDraftName(),
      status,
      hero: {
        portrait: heroPortraitInput,
        render: getRenderPath(),
        background: selectedBackground,
        renderPosition: getRenderPosition(),
      },
      allowCopies: allowCopiesInput,
      heroInfo: draft,
      boon: statsDraft.boon,
      weapon: statsDraft.weapon,
      vitality: statsDraft.vitality,
      spirit: statsDraft.spirit,
      abilityStats: getAbilityStatsForSave(),
      interactions: interactionsDraft,
    }
  }

  function getDraftSaveSignature(payload: CustomHeroSavePayload) {
    return JSON.stringify(payload)
  }

  function getRecoveryContentSignature(payload: CustomHeroSavePayload) {
    return JSON.stringify({ ...payload, id: undefined })
  }

  function persistRecoveryCheckpoint(
    reason = recoveryReasonRef.current,
    failureMessage = recoveryFailureMessageRef.current,
    force = false,
  ) {
    if (!recoveryReadyRef.current) {
      return
    }

    recoveryReasonRef.current = reason
    recoveryFailureMessageRef.current = failureMessage
    const payload = buildSavePayload('private')

    if (!force && lastCloudSavedRecoverySignatureRef.current === getRecoveryContentSignature(payload)) {
      return
    }

    try {
      writeEditorRecovery(buildEditorRecoverySnapshot({
        ownerId: recoveryOwnerId,
        recoveryReason: reason,
        failureMessage,
        heroSlug: hero.slug,
        savedHeroId,
        heroInfo: payload.heroInfo,
        background: payload.hero.background,
        renderSelection,
        heroName: payload.name,
        portrait: payload.hero.portrait,
        allowCopies: payload.allowCopies,
        stats: {
          ...statsDraft,
          heroInfo: payload.heroInfo,
          boon: payload.boon,
          weapon: payload.weapon,
          vitality: payload.vitality,
          spirit: payload.spirit,
        },
        abilityStats: payload.abilityStats,
        interactions: payload.interactions,
      }))
    } catch {
      // The active in-memory draft remains usable if browser storage is unavailable.
    }
  }

  function getSaveIssueMessage(payload: CustomHeroSavePayload, label: 'Draft' | 'Hero') {
    const issues = getCustomHeroSaveIssueMessages(payload)

    return issues.length ? `${label} not saved. ${issues.join(' ')}` : null
  }

  async function handleGlobalSave(status: CustomHeroStatus) {
    if (isSaving || isDraftSaving || draftSaveInFlightRef.current) {
      return
    }

    const payload = buildSavePayload(status)
    recoveryFailureMessageRef.current = undefined
    persistRecoveryCheckpoint('editing', undefined, true)
    const issueMessage = getSaveIssueMessage(payload, status === 'private' ? 'Draft' : 'Hero')

    if (issueMessage) {
      setSaveError(issueMessage)
      showBlockedAction(issueMessage)
      return
    }

    setSaveError(null)
    persistRecoveryCheckpoint('save-pending', undefined, true)
    draftSaveInFlightRef.current = true

    try {
      const didSave = await onSaveHero(payload, { mode: 'manual' })

      if (didSave && status === 'private') {
        lastSavedDraftSignatureRef.current = getDraftSaveSignature(payload)
        lastCloudSavedRecoverySignatureRef.current = getRecoveryContentSignature(payload)
        recoveryReasonRef.current = 'editing'
        recoveryFailureMessageRef.current = undefined
        setRecoveryNotice(null)
      }
    } finally {
      draftSaveInFlightRef.current = false
    }
  }

  async function savePrivateDraft(mode: 'draft' | 'exit', force = false) {
    if (!shouldAutoSaveDraft || draftSaveInFlightRef.current) {
      return true
    }

    const payload = buildSavePayload('private')
    const signature = getDraftSaveSignature(payload)

    if (!force && lastSavedDraftSignatureRef.current === signature) {
      return true
    }

    persistRecoveryCheckpoint(recoveryReasonRef.current, recoveryFailureMessageRef.current, true)

    const issueMessage = getSaveIssueMessage(payload, 'Draft')

    if (issueMessage) {
      setSaveError(issueMessage)
      if (mode === 'exit') {
        showBlockedAction(issueMessage)
      }
      return false
    }

    draftSaveInFlightRef.current = true

    try {
      setSaveError(null)
      recoveryFailureMessageRef.current = undefined
      persistRecoveryCheckpoint('save-pending', undefined, true)
      const didSave = await onSaveHero(payload, { mode })

      if (didSave) {
        lastSavedDraftSignatureRef.current = signature
        lastCloudSavedRecoverySignatureRef.current = getRecoveryContentSignature(payload)
        recoveryReasonRef.current = 'editing'
        recoveryFailureMessageRef.current = undefined
        setRecoveryNotice(null)
      }

      return didSave
    } finally {
      draftSaveInFlightRef.current = false
    }
  }

  const savePrivateDraftRef = useRef(savePrivateDraft)

  useEffect(() => {
    if (lastSavedDraftSignatureRef.current === null) {
      lastSavedDraftSignatureRef.current = getDraftSaveSignature(buildSavePayload('private'))
    }
  })

  useEffect(() => {
    savePrivateDraftRef.current = savePrivateDraft
  })

  useEffect(() => {
    recoveryCheckpointRef.current = persistRecoveryCheckpoint
  })

  useEffect(() => {
    function persistBeforePageExit() {
      recoveryCheckpointRef.current()
    }

    function persistWhenHidden() {
      if (document.visibilityState === 'hidden') {
        persistBeforePageExit()
      }
    }

    window.addEventListener('pagehide', persistBeforePageExit)
    document.addEventListener('visibilitychange', persistWhenHidden)

    return () => {
      window.removeEventListener('pagehide', persistBeforePageExit)
      document.removeEventListener('visibilitychange', persistWhenHidden)
    }
  }, [])

  useEffect(() => {
    if (!saveFailure || !recoveryReadyRef.current) {
      return
    }

    const failureNotice = 'The cloud save did not complete. This draft is preserved on this device and can be recovered after a refresh or sign-in.'

    setRecoveryNotice(failureNotice)
    recoveryCheckpointRef.current('save-failed', saveFailure, true)
  }, [saveFailure])

  useEffect(() => {
    if (!shouldAutoSaveDraft) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void savePrivateDraftRef.current('draft')
    }, draftAutosaveIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [draftAutosaveIntervalMs, shouldAutoSaveDraft])

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
    focusedAbilityDraftRef.current = null
    setActiveAbilityTarget(null)
  }

  function handleBoonStatsChange(stats: PanelStat[]) {
    setStatsDraft(currentDraft => ({
      ...currentDraft,
      boon: activeBoonPanel
        ? {
          ...currentDraft.boon,
          panels: (currentDraft.boon.panels ?? []).map(panel => panel.id === activeBoonPanel.id ? { ...panel, stats } : panel),
        }
        : { ...currentDraft.boon, stats },
    }))
  }

  function updateActiveWeaponPanel(nextPanel: Partial<Omit<WeaponPanelVariant, 'id' | 'name'>>) {
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
          weaponDesc: activeWeaponDesc,
          gunImageSrc: activeWeaponImage,
          weaponAttributes: [...activeWeaponAttributes],
          bulletDPS: activeWeaponBulletDps,
          weaponMinRange: activeWeaponMinRange,
          weaponMaxRange: activeWeaponMaxRange,
          stats,
        }],
      },
    }))
    setWeaponBaseValuesByPanel(current => ({ ...current, [id]: buildWeaponBaseValues(stats) }))
    setWeaponTagsInputByPanel(current => ({ ...current, [id]: activeWeaponTagsInput }))
    setActiveWeaponPanelId(id)
  }

  function addBoonPanel(name: string) {
    const id = `boon-panel-${Date.now()}`

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      boon: {
        ...currentDraft.boon,
        panels: [...(currentDraft.boon.panels ?? []), { id, name, stats: structuredClone(activeBoonStats) }],
      },
    }))
    setActiveBoonPanelId(id)
  }

  function renameBoonPanel(id: string, name: string) {
    setStatsDraft(currentDraft => ({
      ...currentDraft,
      boon: id === BASE_PANEL_ID
        ? { ...currentDraft.boon, name }
        : {
          ...currentDraft.boon,
          panels: (currentDraft.boon.panels ?? []).map(panel => panel.id === id ? { ...panel, name } : panel),
        },
    }))
  }

  function removeBoonPanel(id: string) {
    if (id === BASE_PANEL_ID) return

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      boon: {
        ...currentDraft.boon,
        panels: (currentDraft.boon.panels ?? []).filter(panel => panel.id !== id),
      },
    }))
    setActiveBoonPanelId(BASE_PANEL_ID)
  }

  function removeWeaponPanel(id: string) {
    if (id === BASE_PANEL_ID) return

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      weapon: {
        ...currentDraft.weapon,
        panels: (currentDraft.weapon.panels ?? []).filter(panel => panel.id !== id),
      },
    }))
    setWeaponBaseValuesByPanel(current => Object.fromEntries(Object.entries(current).filter(([panelId]) => panelId !== id)))
    setWeaponTagsInputByPanel(current => Object.fromEntries(Object.entries(current).filter(([panelId]) => panelId !== id)))
    setActiveWeaponPanelId(BASE_PANEL_ID)
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

  function removeVitalityPanel(id: string) {
    if (id === BASE_PANEL_ID) return

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      vitality: {
        ...currentDraft.vitality,
        panels: (currentDraft.vitality.panels ?? []).filter(panel => panel.id !== id),
      },
    }))
    setActiveVitalityPanelId(BASE_PANEL_ID)
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

  function removeSpiritPanel(id: string) {
    if (id === BASE_PANEL_ID) return

    setStatsDraft(currentDraft => ({
      ...currentDraft,
      spirit: {
        ...currentDraft.spirit,
        panels: (currentDraft.spirit.panels ?? []).filter(panel => panel.id !== id),
      },
    }))
    setActiveSpiritPanelId(BASE_PANEL_ID)
  }

  function handleAbilityModeToggle(currentAbility: AbilityDefinition) {
    commitAbilityDraft(currentAbility)
    setIsPreviewMode(currentMode => !currentMode)
  }

  function handleFocusedAbilitySelect(target: ActiveAbilityTarget, currentAbility: AbilityDefinition) {
    commitAbilityDraft(currentAbility)
    focusedAbilityDraftRef.current = null
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
    if (!secondarySlotSelection.includes(slot) && secondarySlotSelection.length >= SECONDARY_ABILITY_SLOT_MAX_COUNT) {
      showBlockedAction(getItemLimitMessage('Secondary abilities', SECONDARY_ABILITY_SLOT_MAX_COUNT))
      return
    }

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

  const activeAbilityDraft = activeAbilityTarget
    ? activeAbilityTarget.set === 'primary'
      ? abilityStatsDraft.abilities[activeAbilityTarget.index] ?? buildDefaultAbility(activeAbilityTarget.index + 1, hero)
      : secondaryAbilities[activeAbilityTarget.index] ?? buildDefaultSecondaryAbilities(hero, secondaryAbilitySlots)[activeAbilityTarget.index]
    : null
  const isFocusedAbilityEditorOpen = Boolean(activeAbilityTarget && activeAbilityDraft)
  const isInteractionCreatorOpen = activeControlRailTab === 'interactions' && !isFocusedAbilityEditorOpen

  useEffect(() => {
    onInteractionPanelOpenChange?.(Boolean(activeTabId || isFocusedAbilityEditorOpen || isInteractionCreatorOpen))
  }, [activeTabId, isFocusedAbilityEditorOpen, isInteractionCreatorOpen, onInteractionPanelOpenChange])

  function saveFocusedAbilityEditorDraft() {
    if (!isFocusedAbilityEditorOpen || !activeAbilityTarget) {
      return
    }

    const nextAbility = focusedAbilityDraftRef.current ?? activeAbilityDraft

    if (nextAbility) {
      commitAbilityDraft(nextAbility, activeAbilityTarget)
    }

    focusedAbilityDraftRef.current = null
  }

  function closeFocusedAbilityEditorWithSave() {
    saveFocusedAbilityEditorDraft()
    setActiveAbilityTarget(null)
  }

  function handleOpenBackgroundAssetModal() {
    closeFocusedAbilityEditorWithSave()
    setIsBackgroundAssetModalOpen(true)
  }

  function handleControlRailTabSelect(tabId: ControlRailTabId) {
    closeFocusedAbilityEditorWithSave()
    if (tabId === 'interactions') {
      setActiveTabId(null)
    }
    setActiveControlRailTab(tabId)
    setIsControlRailCollapsed(false)
  }

  function handleOpenAbilityEditorFromRail() {
    saveFocusedAbilityEditorDraft()
    setActiveControlRailTab('text')
    setActiveAbilityTarget({ set: 'primary', index: 0 })
    setIsControlRailCollapsed(false)
  }

  function handleAbilityTargetOpen(target: ActiveAbilityTarget) {
    setActiveControlRailTab('text')
    setActiveAbilityTarget(target)
  }

  function handleEditorExitRequest() {
    closeFocusedAbilityEditorWithSave()
    setIsExitConfirmOpen(true)
  }

  function handleDraftAutosaveAmountChange(value: string) {
    const numericValue = Number(value)

    if (Number.isFinite(numericValue) && numericValue > DRAFT_AUTOSAVE_AMOUNT_MAX) {
      showBlockedAction(`Draft autosave interval can be at most ${DRAFT_AUTOSAVE_AMOUNT_MAX} minutes.`)
    } else if (Number.isFinite(numericValue) && numericValue < DRAFT_AUTOSAVE_AMOUNT_MIN) {
      showBlockedAction('Draft autosave interval must be at least 1 minute.')
    }

    setDraftAutosavePreference(currentPreference => ({
      ...currentPreference,
      amount: clampDraftAutosaveAmount(value),
    }))
  }

  function handleDraftAutosaveUnitChange(value: string) {
    setDraftAutosavePreference(currentPreference => ({
      ...currentPreference,
      unit: isDraftAutosaveUnit(value) ? value : 'minutes',
    }))
  }

  async function handleExitConfirm() {
    const didSave = await savePrivateDraft('exit', true)

    if (!didSave) {
      return
    }

    setIsExitConfirmOpen(false)
    onExitEditor?.()
  }

  return (
    <section
      className={styles.editor}
      data-testid="hero-info-editor"
      aria-label="Character editor"
    >
      <SidebarTabs activeTabId={activeTabId} onSelect={handleTabSelect} overviewLabel="Hero render" />

      {isInteractionCreatorOpen ? (
        <InteractionCreator
          customHeroId={savedHeroId ?? `draft:${hero.slug}`}
          customHeroName={getDraftName() || heroNamePreview}
          customHeroPortrait={heroPortraitInput || hero.portrait}
          accentColor={draft.nameColor}
          interactions={interactionsDraft}
          editorPaneCollapsed={isControlRailCollapsed}
          onChange={setInteractionsDraft}
        />
      ) : null}

      {!isInteractionCreatorOpen ? (
        <div
        className={cn(
          styles.previewStage,
          isControlRailCollapsed && styles.previewStageRailCollapsed,
          isFocusedAbilityEditorOpen && styles.previewStageAbilityEditorActive,
        )}
        data-testid="editor-preview-stage"
        aria-hidden={isFocusedAbilityEditorOpen ? true : undefined}
      >
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
                  maxLength={HERO_NAME_TEXT_MAX_LENGTH}
                  onKeyDown={event => notifyIfLimitedTextKeyDown(event, draft.nameValue, HERO_NAME_TEXT_MAX_LENGTH, 'Hero name text', showBlockedAction)}
                  onPaste={event => notifyIfLimitedTextPaste(event, draft.nameValue, HERO_NAME_TEXT_MAX_LENGTH, 'Hero name text', showBlockedAction)}
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
                    transform: `translateY(${tag.offsetY}px) rotate(${tag.tilt}deg)`,
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
                    maxLength={HERO_TAG_TEXT_MAX_LENGTH}
                    onKeyDown={event => notifyIfLimitedTextKeyDown(event, tag.text, HERO_TAG_TEXT_MAX_LENGTH, `${tag.label} text`, showBlockedAction)}
                    onPaste={event => notifyIfLimitedTextPaste(event, tag.text, HERO_TAG_TEXT_MAX_LENGTH, `${tag.label} text`, showBlockedAction)}
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
              onAbilityClick={handleAbilityTargetOpen}
              onAbilitySwap={!isPreviewMode ? swapPrimaryAndSecondaryAbility : undefined}
              className={styles.abilitiesRow}
              primaryTestIdPrefix="editor-ability"
              secondaryTestIdPrefix="editor-secondary-ability"
              primaryLabel={slot => `${isPreviewMode ? 'Preview' : 'Edit'} Ability ${slot}`}
              secondaryLabel={slot => `${isPreviewMode ? 'Preview' : 'Edit'} Secondary Ability ${slot}`}
              editable={!isPreviewMode}
            />
        </div>
      ) : null}

      {activeTabId ? (
        <aside className={styles.statsAside} data-hero-stat-panel="true">
          {activeTabId === 'overview' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs
                baseName="Boon"
                baseTabName={statsDraft.boon.name ?? 'Boon Rewards'}
                variants={statsDraft.boon.panels}
                activeId={activeBoonPanel?.id ?? BASE_PANEL_ID}
                canAdd={!isPreviewMode}
                canRename={!isPreviewMode}
                canRemove={!isPreviewMode}
                onSelect={setActiveBoonPanelId}
                onAdd={addBoonPanel}
                onRename={renameBoonPanel}
                onRemove={removeBoonPanel}
              />
              <HeroStatsBoonPanel
                key={`${isPreviewMode ? 'boon-preview' : 'boon-edit'}-${activeBoonPanel?.id ?? BASE_PANEL_ID}`}
                heroName={boonHeroName}
                panelName={activeBoonPanel?.name ?? statsDraft.boon.name ?? 'Boon Rewards'}
                stats={activeBoonStats}
                isEditable={!isPreviewMode}
                onStatsChange={handleBoonStatsChange}
                onBlockedAction={showBlockedAction}
              />
            </div>
          ) : null}
          {activeTabId === 'weapon' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs
                baseName="Weapon"
                baseTabName={statsDraft.weapon.weaponName}
                variants={statsDraft.weapon.panels}
                activeId={activeWeaponPanel?.id ?? BASE_PANEL_ID}
                canAdd={!isPreviewMode}
                canRemove={!isPreviewMode}
                onSelect={setActiveWeaponPanelId}
                onAdd={addWeaponPanel}
                onRemove={removeWeaponPanel}
              />
              <WeaponPanel
                key={`${isPreviewMode ? 'weapon-preview' : 'weapon-edit'}-${activeWeaponPanel?.id ?? BASE_PANEL_ID}`}
                isEditable={!isPreviewMode}
                showDetails={isPreviewMode}
                weaponName={activeWeaponPanel?.name ?? statsDraft.weapon.weaponName}
                weaponDesc={activeWeaponDesc}
                gunImageSrc={activeWeaponImage}
                weaponAttributes={activeWeaponAttributes}
                weaponStats={activeWeaponStats}
                bulletDPS={activeWeaponBulletDps}
                weaponMinRange={activeWeaponMinRange}
                weaponMaxRange={activeWeaponMaxRange}
                onStatsChange={handleWeaponStatsChange}
                weaponAttributesText={activeWeaponTagsInput}
                onWeaponNameChange={updateActiveWeaponName}
                onWeaponDescChange={value => updateActiveWeaponPanel({ weaponDesc: value })}
                onWeaponAttributesTextChange={handleWeaponTagChange}
                onWeaponMinRangeChange={value => updateActiveWeaponPanel({ weaponMinRange: parseEditableNumber(value) })}
                onWeaponMaxRangeChange={value => updateActiveWeaponPanel({ weaponMaxRange: parseEditableNumber(value) })}
                onOpenWeaponAssetPicker={() => setIsWeaponAssetModalOpen(true)}
                weaponImageUploadControl={<CloudUploadButton endpoint="weaponImage" label="Upload" onUploaded={handleWeaponImageUpload} />}
                onBlockedAction={showBlockedAction}
              />
            </div>
          ) : null}

          {activeTabId === 'vitality' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs baseName="Vitality" baseTabName={statsDraft.vitality.name ?? 'Vitality'} variants={statsDraft.vitality.panels} activeId={activeVitalityPanel?.id ?? BASE_PANEL_ID} canAdd={!isPreviewMode} canRename={!isPreviewMode} canRemove={!isPreviewMode} onSelect={setActiveVitalityPanelId} onAdd={addVitalityPanel} onRename={renameVitalityPanel} onRemove={removeVitalityPanel} />
              <HeroStatsVitalityPanel key={`${isPreviewMode ? 'vitality-preview' : 'vitality-edit'}-${activeVitalityPanel?.id ?? BASE_PANEL_ID}`} isEditable={!isPreviewMode} showDetails={isPreviewMode} stats={activeVitalityStats} onStatsChange={handleVitalityStatsChange} />
            </div>
          ) : null}

          {activeTabId === 'spirit' ? (
            <div className={styles.weaponStack}>
              <PanelVariantTabs baseName="Spirit" baseTabName={statsDraft.spirit.name ?? 'Spirit'} variants={statsDraft.spirit.panels} activeId={activeSpiritPanel?.id ?? BASE_PANEL_ID} canAdd={!isPreviewMode} canRename={!isPreviewMode} canRemove={!isPreviewMode} onSelect={setActiveSpiritPanelId} onAdd={addSpiritPanel} onRename={renameSpiritPanel} onRemove={removeSpiritPanel} />
              <HeroStatsSpiritPanel key={`${isPreviewMode ? 'spirit-preview' : 'spirit-edit'}-${activeSpiritPanel?.id ?? BASE_PANEL_ID}`} isEditable={!isPreviewMode} showDetails={isPreviewMode} stats={activeSpiritTopStats} spiritPowerStat={activeSpiritPowerStat} onStatsChange={handleSpiritTopStatsChange} onSpiritPowerStatChange={handleSpiritPowerStatChange} />
            </div>
          ) : null}
        </aside>
      ) : null}

      <div className={cn(styles.controlRail, isControlRailCollapsed && styles.controlRailCollapsed)} data-testid="editor-control-rail" data-collapsed={isControlRailCollapsed ? 'true' : undefined}>
        <nav className={styles.controlTabRail} aria-label="Hero editor navigation">
          <button
            type="button"
            className={styles.editorBackButton}
            aria-label="Go Back"
            onClick={handleEditorExitRequest}
          >
            <ArrowLeft aria-hidden="true" />
            <span>Go Back</span>
          </button>
          <div className={styles.controlTabList} role="tablist" aria-label="Editor settings sections" data-testid="editor-control-tabs">
            {CONTROL_RAIL_TABS.filter(tab => tab.id !== 'options').map(tab => (
              <button
                key={tab.id}
                type="button"
                id={`editor-${tab.id}-tab`}
                role="tab"
                aria-label={tab.label}
                aria-selected={activeControlRailTab === tab.id}
                aria-controls={`editor-${tab.id}-panel`}
                className={cn(styles.controlTabButton, activeControlRailTab === tab.id && styles.controlTabButtonActive)}
                onClick={() => handleControlRailTabSelect(tab.id)}
              >
                <span aria-hidden="true">{tab.shortLabel}</span>
                <strong>{tab.label.split(' ')[0]}</strong>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.controlTabButton}
            aria-label="Open ability editor"
            onClick={handleOpenAbilityEditorFromRail}
          >
            <Sparkles aria-hidden="true" />
            <strong>Ability</strong>
          </button>
          <div className={styles.controlTabList} role="tablist" aria-label="Interaction creator section">
            <button
              type="button"
              id="editor-interactions-tab"
              role="tab"
              aria-label="Interactions"
              aria-selected={isInteractionCreatorOpen}
              aria-controls="editor-interactions-panel"
              className={cn(styles.controlTabButton, isInteractionCreatorOpen && styles.controlTabButtonActive)}
              onClick={() => handleControlRailTabSelect('interactions')}
            >
              <MessageSquareText aria-hidden="true" />
              <strong>Interact</strong>
            </button>
          </div>
          <div className={styles.controlTabList} role="tablist" aria-label="Editor options section">
            {CONTROL_RAIL_TABS.filter(tab => tab.id === 'options').map(tab => (
              <button
                key={tab.id}
                type="button"
                id={`editor-${tab.id}-tab`}
                role="tab"
                aria-label={tab.label}
                aria-selected={activeControlRailTab === tab.id}
                aria-controls={`editor-${tab.id}-panel`}
                className={cn(styles.controlTabButton, activeControlRailTab === tab.id && styles.controlTabButtonActive)}
                onClick={() => handleControlRailTabSelect(tab.id)}
              >
                <span aria-hidden="true">{tab.shortLabel}</span>
                <strong>Editor</strong>
              </button>
            ))}
          </div>
          <Link href="/profile" className={styles.editorProfileButton} aria-label="Open profile" onClick={closeFocusedAbilityEditorWithSave}>
            <UserRound aria-hidden="true" />
            <strong>Profile</strong>
          </Link>
        </nav>

        <div className={styles.controlPane}>
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
            <section
              id="editor-text-panel"
              role="tabpanel"
              aria-labelledby="editor-text-tab"
              className={styles.controlPaneSection}
              hidden={activeControlRailTab !== 'text'}
            >
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

              <div className={styles.editorHint}>
                <strong>Tags</strong>
                <span>Edit tag text directly on the character preview. Drag tag corners to rotate and edges to move vertically.</span>
              </div>
            </section>

            <section
              id="editor-colors-panel"
              role="tabpanel"
              aria-labelledby="editor-colors-tab"
              className={styles.controlPaneSection}
              hidden={activeControlRailTab !== 'colors'}
            >
              <ColorField label="Hero Name" value={draft.nameColor} onChange={value => updateDraft({ nameColor: value })} />
              <ColorField label="Tag Text" value={draft.tagTextColor} onChange={value => updateDraft({ tagTextColor: value })} />
              <ColorField label="Tag Rectangles" value={draft.tagColor} onChange={value => updateDraft({ tagColor: value })} />
              <ColorField label="Ability Icons" value={draft.abilityIconColor} onChange={value => updateDraft({ abilityIconColor: value })} />
              <ColorField label="Ability Circles" value={draft.abilityCircleColor} onChange={value => updateDraft({ abilityCircleColor: value })} />
            </section>

            <section
              id="editor-images-panel"
              role="tabpanel"
              aria-labelledby="editor-images-tab"
              className={styles.controlPaneSection}
              hidden={activeControlRailTab !== 'images'}
            >
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

              <div className={styles.fieldLabel}>
                <span>Background</span>
                <button
                  type="button"
                  className={styles.backgroundPickerButton}
                  onClick={handleOpenBackgroundAssetModal}
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
            </section>

            <section
              id="editor-interactions-panel"
              role="tabpanel"
              aria-labelledby="editor-interactions-tab"
              className={styles.controlPaneSection}
              hidden={!isInteractionCreatorOpen}
            >
              <div className={styles.interactionPaneIntro}>
                <MessageSquareText aria-hidden="true" />
                <div>
                  <span className={styles.sectionTitle}>Interaction Creator</span>
                  <p>Create conversations between {getDraftName() || heroNamePreview} and roster heroes in the workspace beside this pane.</p>
                </div>
              </div>
              <div className={styles.editorHint}>
                <strong>Draft persistence</strong>
                <span>Conversation titles, targets, and alternating voicelines are included in local recovery and hero saves.</span>
              </div>
            </section>

            <section
              id="editor-options-panel"
              role="tabpanel"
              aria-labelledby="editor-options-tab"
              className={styles.controlPaneSection}
              hidden={activeControlRailTab !== 'options'}
            >
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
              <div className={styles.editorHint}>
                <strong>Stat panels</strong>
                <span>Use the right-side stat tabs to edit Boon, Weapon, Vitality, and Spirit values.</span>
              </div>
            </section>
          </div>

          <div className={styles.globalActions}>
          <label className={styles.heroNamePrompt} htmlFor="editor-save-hero-name">
            Hero Name
            <input
              id="editor-save-hero-name"
              type="text"
              value={heroNameInput}
              maxLength={DRAFT_NAME_MAX_LENGTH}
              onKeyDown={event => notifyIfLimitedTextKeyDown(event, heroNameInput, DRAFT_NAME_MAX_LENGTH, 'Hero name', showBlockedAction)}
              onPaste={event => notifyIfLimitedTextPaste(event, heroNameInput, DRAFT_NAME_MAX_LENGTH, 'Hero name', showBlockedAction)}
              onChange={event => {
                setHeroNameInput(event.target.value)
                setSaveError(null)
              }}
              placeholder="Name this draft"
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
                onClick={() => void handleGlobalSave('published')}
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
              {recoveryNotice ? (
                <div className={styles.recoveryNotice} role="status" aria-live="polite">
                  <strong>Local recovery protected</strong>
                  <span>{recoveryNotice}</span>
                </div>
              ) : null}
              <div className={styles.draftAutosavePanel}>
                <div className={styles.draftAutosaveStatus} role="status" aria-live="polite">
                  <strong>Draft autosaves privately</strong>
                  <span>{isDraftSaving ? 'Autosaving to your profile...' : savedHeroId ? `Saved. Future changes save every ${draftAutosaveIntervalLabel}.` : `Changes save every ${draftAutosaveIntervalLabel}.`}</span>
                </div>
                <div className={styles.draftAutosaveControls} aria-label="Draft autosave interval">
                  <label htmlFor="draft-autosave-amount">
                    Every
                    <input
                      id="draft-autosave-amount"
                      type="number"
                      min={DRAFT_AUTOSAVE_AMOUNT_MIN}
                      max={DRAFT_AUTOSAVE_AMOUNT_MAX}
                      step={1}
                      value={draftAutosavePreference.amount}
                      onChange={event => handleDraftAutosaveAmountChange(event.target.value)}
                      aria-label="Draft autosave interval value"
                    />
                  </label>
                  <select
                    value={draftAutosavePreference.unit}
                    onChange={event => handleDraftAutosaveUnitChange(event.target.value)}
                    aria-label="Draft autosave interval unit"
                  >
                    <option value="minutes">minutes</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                className={styles.saveActionButton}
                disabled={isSaving || isDraftSaving}
                onClick={() => void handleGlobalSave('private')}
              >
                {isSaving ? 'Saving...' : 'Save Draft Now'}
              </button>
              <button
                type="button"
                className={styles.publishActionButton}
                disabled={isSaving || isDraftSaving}
                onClick={() => void handleGlobalSave('published')}
              >
                Publish
              </button>
            </>
          )}
          <CharacterExportButton payload={exportPayload} className={styles.exportActionButton} />
          {saveError ? <p className={styles.saveError} role="alert">{saveError}</p> : null}
          {saveFailure && onRetrySave ? <SaveFailureBanner reason={saveFailure} onRetry={onRetrySave} /> : null}
          {blockedActionToast ? <SystemToast key={blockedActionToast.id} message={blockedActionToast.message} variant="error" position="top" /> : null}
          {saveStatusMessage ? <SystemToast message={saveStatusMessage} /> : null}
          {recoveryStatus && !saveStatusMessage ? <SystemToast message={recoveryStatus} /> : null}
          </div>
        </div>
        <button
          type="button"
          className={styles.controlRailToggle}
          aria-label={isControlRailCollapsed ? 'Expand editor settings panel' : 'Retract editor settings panel'}
          aria-expanded={!isControlRailCollapsed}
          onClick={() => setIsControlRailCollapsed(current => !current)}
        >
          <span aria-hidden="true">{isControlRailCollapsed ? '›' : '‹'}</span>
          <strong>{isControlRailCollapsed ? 'Open' : 'Hide'}</strong>
        </button>
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
                  void handleGlobalSave('private')
                }}
              >
                Confirm Unpublish
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isExitConfirmOpen ? (
        <div className={styles.exitConfirmBackdrop} role="presentation">
          <section className={styles.exitConfirmDialog} role="dialog" aria-modal="true" aria-labelledby="hero-editor-exit-title">
            <p className={styles.exitConfirmEyebrow}>Leave hero editor?</p>
            <h2 id="hero-editor-exit-title">Go back to the main pages?</h2>
            <p>
              Your draft will be saved privately to your profile before leaving. Resolve any listed restrictions first.
            </p>
            <div className={styles.exitConfirmActions}>
              <button type="button" className={styles.exitStayButton} onClick={() => setIsExitConfirmOpen(false)}>
                Stay here
              </button>
              <button type="button" className={styles.exitConfirmButton} disabled={isDraftSaving} onClick={() => void handleExitConfirm()}>
                {isDraftSaving ? 'Saving...' : 'Yes, Go Back'}
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
            onRenderSelectionChange({ mode: 'hero', src: assetPath, position: DEFAULT_RENDER_POSITION })
            setIsHeroRenderAssetModalOpen(false)
          }}
          onUpload={uploadUrl => {
            onRenderSelectionChange({ mode: 'custom', src: uploadUrl, position: DEFAULT_RENDER_POSITION })
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
            updateActiveWeaponPanel({ gunImageSrc: assetPath })
            setIsWeaponAssetModalOpen(false)
          }}
          onUpload={uploadUrl => {
            updateActiveWeaponPanel({ gunImageSrc: uploadUrl })
            setIsWeaponAssetModalOpen(false)
          }}
        />
      ) : null}

      {isFocusedAbilityEditorOpen && activeAbilityTarget && activeAbilityDraft ? (
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
          onDraftChange={abilityDraft => {
            focusedAbilityDraftRef.current = abilityDraft
          }}
          onSave={handleAbilitySave}
          onCancel={() => setActiveAbilityTarget(null)}
          onBlockedAction={showBlockedAction}
        />
      ) : null}
    </section>
  )
}
