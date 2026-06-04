'use client'

import { Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, PointerEvent, WheelEvent } from 'react'

import EditorAssetModal from '@/components/editor-asset-modal'
import HeroStatsSpiritPanel from '@/components/panels/hero-stats-spirit-panel'
import HeroStatsVitalityPanel from '@/components/panels/hero-stats-vitality-panel'
import type { PanelStat } from '@/components/panels/scaling-utils'
import WeaponPanel from '@/components/panels/weapon-panel'
import SidebarTabs from '@/components/sidebar-tabs'
import type { SidebarTabId } from '@/components/sidebar-tabs'
import { ABILITY_ICON_GROUPS, HERO_RENDER_GROUPS, WEAPON_IMAGE_GROUPS } from '@/lib/editor-assets'
import type { EditorAssetGroup, EditorRenderSelection, HeroBackgroundOption } from '@/lib/editor-assets'
import type { HeroDefinition, HeroInfoDefinition } from '@/lib/hero-data'
import { buildHeroStatsSeed, type HeroStatsPayload } from '@/lib/hero-stats-shared'
import cn from '@/lib/utilsd'

interface HeroInfoEditorProps {
  hero: HeroDefinition
  draft: HeroInfoDefinition
  backgroundOptions: HeroBackgroundOption[]
  selectedBackground: string
  renderSelection: EditorRenderSelection
  onBackgroundChange: (backgroundPath: string) => void
  onRenderSelectionChange: (renderSelection: EditorRenderSelection) => void
  onDraftChange: (draft: HeroInfoDefinition) => void
}

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
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

function createUploadPreview(file: File) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file)
  }

  return file.name
}

function buildAbilityAssetGroups(): EditorAssetGroup[] {
  return ABILITY_ICON_GROUPS.map(group => ({
    id: group.heroSlug,
    label: group.heroName,
    assets: group.icons.map((icon, index) => ({
      label: `${group.heroName} ability ${index + 1}`,
      path: icon,
    })),
  }))
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
    <label className="grid gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75" htmlFor={inputId}>
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
          className="min-w-0 flex-1 rounded border border-[#ffefd6]/15 bg-black/45 px-2.5 py-2 text-[0.74rem] tracking-[0.08em] text-[#ffefd6] outline-none transition focus:border-[#2fc890] focus:shadow-[0_0_0_2px_rgba(47,200,144,0.25)]"
          aria-label={`${label} hex value`}
        />
      </span>
    </label>
  )
}

export default function HeroInfoEditor({ hero, draft, backgroundOptions, selectedBackground, renderSelection, onBackgroundChange, onRenderSelectionChange, onDraftChange }: HeroInfoEditorProps) {
  const [activeTabId, setActiveTabId] = useState<SidebarTabId>('overview')
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(null)
  const [isWeaponAssetModalOpen, setIsWeaponAssetModalOpen] = useState(false)
  const [isHeroRenderAssetModalOpen, setIsHeroRenderAssetModalOpen] = useState(false)
  const [tagRotationDrag, setTagRotationDrag] = useState<TagRotationDrag | null>(null)
  const [statsDraft, setStatsDraft] = useState<HeroStatsPayload>(() => buildHeroStatsSeed(hero))
  const [weaponBaseValues, setWeaponBaseValues] = useState<Record<string, number>>(() => buildWeaponBaseValues(buildHeroStatsSeed(hero).weapon.stats))
  const [weaponTagsInput, setWeaponTagsInput] = useState(() => buildHeroStatsSeed(hero).weapon.weaponAttributes.join(', '))
  const activeAbility = activeAbilityIndex === null ? null : ABILITY_CONTROLS[activeAbilityIndex]
  const heroNamePreview = draft.nameValue.trim() || hero.displayName
  const abilityAssetGroups = useMemo(() => buildAbilityAssetGroups(), [])

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

  useEffect(() => {
    if (activeAbilityIndex === null) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveAbilityIndex(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeAbilityIndex])

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

  function handleNameUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    updateDraft({
      nameType: 'image',
      nameValue: createUploadPreview(file),
    })
  }

  function handleWeaponImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    updateWeaponDraft({
      gunImageSrc: createUploadPreview(file),
    })
  }

  function handleHeroRenderUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    onRenderSelectionChange({
      mode: 'custom',
      src: createUploadPreview(file),
    })
  }

  function selectAbilityIcon(iconPath: string) {
    if (!activeAbility) {
      return
    }

    updateDraft({
      [activeAbility.iconKey]: iconPath,
    })
    setActiveAbilityIndex(null)
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

  return (
    <section
      className="pointer-events-none absolute inset-0 z-30"
      data-testid="hero-info-editor"
      aria-label="Character editor"
    >
      <SidebarTabs activeTabId={activeTabId} onSelect={setActiveTabId} overviewLabel="Hero render" />

      <div className="pointer-events-auto absolute left-[clamp(100px,32vw,300px)] bottom-[clamp(280px,12vh,180px)] flex min-h-[230px] w-[min(52vw,780px)] flex-col justify-end p-4 max-lg:left-[clamp(360px,38vw,420px)] max-lg:w-[min(44vw,560px)] max-sm:left-3 max-sm:w-[min(92vw,520px)]">
            <div className="flex justify-center">
              {draft.nameType === 'image' ? (
                <span
                  className="block aspect-[1701/564] w-full max-w-[360px] bg-[var(--hero-info-name-color)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
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
                <span className="max-w-full text-center text-[clamp(1.5rem,3vw,3.3rem)] font-extrabold uppercase tracking-[0.08em] break-words" data-testid="editor-name-text" style={{ color: draft.nameColor }}>
                  {heroNamePreview}
                </span>
              )}
            </div>

            <div className="mt-5 mb-5 flex w-full flex-nowrap items-center justify-center gap-3 overflow-visible px-1" aria-label="Editable hero tags" data-testid="editor-tags-row">
              {tagPreview.map((tag, index) => (
                <span
                  key={tag.label}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tag.label} preview. Scroll or drag horizontally to rotate.`}
                  className="inline-flex min-h-8 w-fit shrink-0 cursor-grab touch-none select-none items-center justify-center px-3 py-1 shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition hover:brightness-110 active:cursor-grabbing"
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
                  <span className="text-center font-['Valve_Pulp',sans-serif] text-[clamp(1.05rem,1.45vw,1.3rem)] leading-[0.92] font-black tracking-[0.06em] whitespace-nowrap">{tag.text || tag.label}</span>
                </span>
              ))}
            </div>

            <div className="flex justify-center gap-2.5" aria-label="Editable ability icons">
              {ABILITY_CONTROLS.map((ability, index) => (
                <button
                  key={ability.iconKey}
                  type="button"
                  className="inline-flex aspect-square size-[clamp(54px,5vw,75px)] shrink-0 items-center justify-center rounded-full border border-[#ffefd6]/10 bg-transparent shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]"
                  data-testid={`editor-ability-${index + 1}`}
                  aria-label={`Choose ${ability.label} icon`}
                  style={{ backgroundColor: draft.abilityCircleColor }}
                  onClick={() => setActiveAbilityIndex(index)}
                >
                  <span
                    className="size-[68%] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
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
        <aside className="pointer-events-auto absolute right-[clamp(72px,5vw,120px)] bottom-[clamp(36px,4vw,60px)] z-30 w-[min(43vw,560px)] max-lg:w-[min(52vw,500px)] max-sm:right-3 max-sm:bottom-3 max-sm:w-[min(88vw,380px)]">
          {activeTabId === 'weapon' ? (
            <div className="flex flex-col gap-2.5">
              <div className="grid gap-2 rounded border border-[#ffefd6]/14 bg-[#061d27]/82 p-3 text-[#ffefd6] shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl" data-testid="weapon-mini-editor">
                <span className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#ffefd6]/72">Weapon Info</span>
                <div className="grid grid-cols-1 gap-2">
                  <label className="grid gap-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#ffefd6]/70" htmlFor="editor-weapon-name">
                    Name
                    <input
                      id="editor-weapon-name"
                      type="text"
                      value={statsDraft.weapon.weaponName}
                      onChange={event => updateWeaponDraft({ weaponName: event.target.value })}
                      className="rounded border border-[#ffefd6]/15 bg-black/45 px-2 py-1.5 text-[0.75rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890]"
                    />
                  </label>
                  <label className="grid gap-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#ffefd6]/70" htmlFor="editor-weapon-tags">
                    Tags
                    <input
                      id="editor-weapon-tags"
                      type="text"
                      value={weaponTagsInput}
                      onChange={event => handleWeaponTagChange(event.target.value)}
                      className="rounded border border-[#ffefd6]/15 bg-black/45 px-2 py-1.5 text-[0.75rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#ffefd6]/70" htmlFor="editor-weapon-min-range">
                    Min
                    <input
                      id="editor-weapon-min-range"
                      type="text"
                      value={statsDraft.weapon.weaponMinRange}
                      onChange={event => updateWeaponDraft({ weaponMinRange: parseEditableNumber(event.target.value) })}
                      className="rounded border border-[#ffefd6]/15 bg-black/45 px-2 py-1.5 text-[0.75rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890]"
                    />
                  </label>
                  <label className="grid gap-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#ffefd6]/70" htmlFor="editor-weapon-max-range">
                    Max
                    <input
                      id="editor-weapon-max-range"
                      type="text"
                      value={statsDraft.weapon.weaponMaxRange}
                      onChange={event => updateWeaponDraft({ weaponMaxRange: parseEditableNumber(event.target.value) })}
                      className="rounded border border-[#ffefd6]/15 bg-black/45 px-2 py-1.5 text-[0.75rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="self-end rounded border border-[#ffefd6]/15 bg-black/30 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#ffefd6]/78 transition hover:border-[#2fc890]/70 hover:text-[#bafbe0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]"
                    onClick={() => setIsWeaponAssetModalOpen(true)}
                  >
                    Asset
                  </button>
                  <label className="flex cursor-pointer items-center justify-center gap-1 self-end rounded border border-dashed border-[#ffefd6]/20 bg-black/30 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#ffefd6]/78 transition hover:border-[#2fc890]/70 hover:text-[#bafbe0]">
                    <Upload className="size-3.5" aria-hidden />
                    Upload
                    <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={handleWeaponImageUpload} />
                  </label>
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

      <div
        className="pointer-events-auto absolute top-[88px] left-[clamp(18px,2vw,36px)] max-h-[calc(100vh-122px)] w-[min(30vw,360px)] overflow-y-auto rounded border border-[#ffefd6]/14 bg-[#061d27]/80 p-4 text-[#ffefd6] shadow-[0_20px_70px_rgba(0,0,0,0.46)] backdrop-blur-xl max-lg:w-[min(34vw,340px)] max-sm:left-3 max-sm:w-[min(88vw,360px)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.28em]">Create</h2>
            <p className="mt-1 text-xs leading-5 text-[#ffefd6]/58">{hero.displayName} draft</p>
          </div>
          <span className="rounded-full border border-[#2fc890]/35 bg-[#2fc890]/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#bafbe0]">Live</span>
        </div>

        <div className="grid gap-4">
          {activeTabId === 'overview' ? (
            <div className="grid gap-3">
              <span className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75">Hero Render</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={cn(
                    'rounded border px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]',
                    renderSelection.mode === 'background' ? 'border-[#2fc890] bg-[#2fc890]/18 text-[#bafbe0]' : 'border-[#ffefd6]/15 bg-black/30 text-[#ffefd6]/58 hover:text-[#ffefd6]',
                  )}
                  onClick={() => onRenderSelectionChange({ mode: 'background', src: null })}
                >
                  None
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded border px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]',
                    renderSelection.mode === 'hero' ? 'border-[#2fc890] bg-[#2fc890]/18 text-[#bafbe0]' : 'border-[#ffefd6]/15 bg-black/30 text-[#ffefd6]/58 hover:text-[#ffefd6]',
                  )}
                  onClick={() => setIsHeroRenderAssetModalOpen(true)}
                >
                  Asset
                </button>
                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-1 rounded border px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.14em] transition hover:border-[#2fc890]/70 hover:text-[#bafbe0]',
                    renderSelection.mode === 'custom' ? 'border-[#2fc890] bg-[#2fc890]/18 text-[#bafbe0]' : 'border-dashed border-[#ffefd6]/20 bg-black/30 text-[#ffefd6]/58',
                  )}
                >
                  <Upload className="size-3.5" aria-hidden />
                  Upload
                  <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={handleHeroRenderUpload} />
                </label>
              </div>
            </div>
          ) : null}

          <label className="grid gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75" htmlFor="editor-background">
            Background
            <select
              id="editor-background"
              value={selectedBackground}
              onChange={event => onBackgroundChange(event.target.value)}
              className="rounded border border-[#ffefd6]/15 bg-black/45 px-2.5 py-2 text-[0.74rem] tracking-[0.08em] text-[#ffefd6] outline-none transition focus:border-[#2fc890] focus:shadow-[0_0_0_2px_rgba(47,200,144,0.25)]"
              data-testid="editor-background-select"
            >
              {backgroundOptions.map(option => (
                <option key={option.path} value={option.path}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <span className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75">Hero Name</span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Hero name mode">
              {(['text', 'image'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    'rounded border px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]',
                    draft.nameType === mode ? 'border-[#2fc890] bg-[#2fc890]/18 text-[#bafbe0]' : 'border-[#ffefd6]/15 bg-black/30 text-[#ffefd6]/58 hover:text-[#ffefd6]',
                  )}
                  aria-pressed={draft.nameType === mode}
                  onClick={() => updateDraft({ nameType: mode })}
                >
                  {mode}
                </button>
              ))}
            </div>

            {draft.nameType === 'text' ? (
              <label className="grid gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75" htmlFor="editor-name-input">
                Name Text
                <input
                  id="editor-name-input"
                  type="text"
                  value={draft.nameValue}
                  onChange={event => updateDraft({ nameValue: event.target.value })}
                  className="rounded border border-[#ffefd6]/15 bg-black/45 px-2.5 py-2 text-[0.8rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890] focus:shadow-[0_0_0_2px_rgba(47,200,144,0.25)]"
                />
              </label>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-[#ffefd6]/20 bg-black/30 px-3 py-3 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#ffefd6]/78 transition hover:border-[#2fc890]/70 hover:text-[#bafbe0]">
                <Upload className="size-4" aria-hidden />
                Upload name image
                <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={handleNameUpload} />
              </label>
            )}
          </div>

          <div className="grid gap-3">
            <span className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75">Tags</span>
            {TAG_CONTROLS.map(tag => (
              <div key={tag.textKey} className="grid gap-2 rounded border border-[#ffefd6]/10 bg-black/15 p-2.5">
                <label className="grid gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#ffefd6]/75" htmlFor={`editor-${tag.textKey}`}>
                  {tag.label}
                  <input
                    id={`editor-${tag.textKey}`}
                    type="text"
                    value={draft[tag.textKey]}
                    onChange={event => updateDraft({ [tag.textKey]: event.target.value })}
                    className="rounded border border-[#ffefd6]/15 bg-black/45 px-2.5 py-2 text-[0.8rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890] focus:shadow-[0_0_0_2px_rgba(47,200,144,0.25)]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1.5 text-[0.56rem] font-bold uppercase tracking-[0.18em] text-[#ffefd6]/62" htmlFor={`editor-${tag.tiltKey}`}>
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
                      className="rounded border border-[#ffefd6]/15 bg-black/45 px-2 py-1.5 text-[0.72rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890] focus:shadow-[0_0_0_2px_rgba(47,200,144,0.25)]"
                    />
                  </label>
                  <label className="grid gap-1.5 text-[0.56rem] font-bold uppercase tracking-[0.18em] text-[#ffefd6]/62" htmlFor={`editor-${tag.offsetKey}`}>
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
                      className="rounded border border-[#ffefd6]/15 bg-black/45 px-2 py-1.5 text-[0.72rem] text-[#ffefd6] outline-none transition focus:border-[#2fc890] focus:shadow-[0_0_0_2px_rgba(47,200,144,0.25)]"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <ColorField label="Hero Name" value={draft.nameColor} onChange={value => updateDraft({ nameColor: value })} />
            <ColorField label="Tag Text" value={draft.tagTextColor} onChange={value => updateDraft({ tagTextColor: value })} />
            <ColorField label="Tag Rectangles" value={draft.tagColor} onChange={value => updateDraft({ tagColor: value })} />
            <ColorField label="Ability Icons" value={draft.abilityIconColor} onChange={value => updateDraft({ abilityIconColor: value })} />
            <ColorField label="Ability Circles" value={draft.abilityCircleColor} onChange={value => updateDraft({ abilityCircleColor: value })} />
          </div>
        </div>
      </div>

      {activeAbility ? (
        <EditorAssetModal
          title={activeAbility.label}
          description="Choose an existing icon or upload your own."
          uploadLabel="Upload custom icon"
          groups={abilityAssetGroups}
          previewMode="mask"
          previewColor={draft.abilityIconColor}
          testId="ability-icon-modal"
          onClose={() => setActiveAbilityIndex(null)}
          onSelect={selectAbilityIcon}
          onUpload={file => {
            updateDraft({
              [activeAbility.iconKey]: createUploadPreview(file),
            })
            setActiveAbilityIndex(null)
          }}
        />
      ) : null}

      {isHeroRenderAssetModalOpen ? (
        <EditorAssetModal
          title="Hero Render"
          description="Choose an existing hero render. Existing renders replace the selected background."
          uploadLabel="Upload custom render"
          groups={HERO_RENDER_GROUPS}
          previewMode="image"
          testId="hero-render-modal"
          onClose={() => setIsHeroRenderAssetModalOpen(false)}
          onSelect={assetPath => {
            onRenderSelectionChange({ mode: 'hero', src: assetPath })
            setIsHeroRenderAssetModalOpen(false)
          }}
          onUpload={file => {
            onRenderSelectionChange({ mode: 'custom', src: createUploadPreview(file) })
            setIsHeroRenderAssetModalOpen(false)
          }}
        />
      ) : null}

      {isWeaponAssetModalOpen ? (
        <EditorAssetModal
          title="Weapon Image"
          description="Choose an existing hero weapon or upload your own."
          uploadLabel="Upload custom weapon"
          groups={WEAPON_IMAGE_GROUPS}
          previewMode="image"
          testId="weapon-image-modal"
          onClose={() => setIsWeaponAssetModalOpen(false)}
          onSelect={assetPath => {
            updateWeaponDraft({ gunImageSrc: assetPath })
            setIsWeaponAssetModalOpen(false)
          }}
          onUpload={file => {
            updateWeaponDraft({ gunImageSrc: createUploadPreview(file) })
            setIsWeaponAssetModalOpen(false)
          }}
        />
      ) : null}
    </section>
  )
}
