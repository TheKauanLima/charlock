'use client'

import { Bold, GripVertical, Italic, Moon, Plus, Search, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode, RefObject } from 'react'

import HeroAbilityIconRow from '@/components/HeroAbilityIconRow/HeroAbilityIconRow'
import ScalingPicker from '@/components/panels/scaling-picker'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type {
  AbilityDefinition,
  AbilityGridCell,
  AbilityGridSection,
  AbilityRichTextSection,
  AbilitySection,
  AbilityStat,
  AbilityTier,
  AbilityTierLevel,
  AbilityVariant,
} from '@/lib/ability-editor-types'
import type { AbilityIconGroup, EditorAssetGroup } from '@/lib/editor-assets'
import {
  DEFAULT_HERO_NAME_FONT_FAMILY,
  DEFAULT_HERO_NAME_FONT_SIZE,
  DEFAULT_HERO_NAME_FONT_WEIGHT,
  type HeroDefinition,
  type HeroInfoDefinition,
} from '@/lib/hero-data'
import cn from '@/lib/utilsd'

import styles from './AbilityEditor.module.css'

type AbilityEditorMode = 'edit' | 'preview'

interface AbilityEditorCapabilities {
  canEditText: boolean
  canEditStats: boolean
  canChangeIcons: boolean
  canAddSections: boolean
  canDeleteSections: boolean
  canToggleCharges: boolean
  canToggleSecondSet: boolean
  showHeroInfoCluster: boolean
  canNavigateAbilities: boolean
  canSwitchTiers: boolean
}

const ABILITY_EDITOR_CAPABILITIES: Record<AbilityEditorMode, AbilityEditorCapabilities> = {
  edit: {
    canEditText: true,
    canEditStats: true,
    canChangeIcons: true,
    canAddSections: true,
    canDeleteSections: true,
    canToggleCharges: true,
    canToggleSecondSet: true,
    showHeroInfoCluster: true,
    canNavigateAbilities: true,
    canSwitchTiers: true,
  },
  preview: {
    canEditText: false,
    canEditStats: false,
    canChangeIcons: false,
    canAddSections: false,
    canDeleteSections: false,
    canToggleCharges: false,
    canToggleSecondSet: false,
    showHeroInfoCluster: false,
    canNavigateAbilities: false,
    canSwitchTiers: true,
  },
}

interface AbilityEditorProps {
  ability: AbilityDefinition
  propertyIconGroups: EditorAssetGroup[]
  mode?: AbilityEditorMode
  previewLayout?: 'browse' | 'editor'
  className?: string
  hero?: HeroDefinition
  heroInfo?: HeroInfoDefinition
  activeAbilityTarget?: AbilityEditorTarget
  secondaryAbilities?: AbilityDefinition[]
  secondaryAbilitySlots?: number[]
  secondaryAbilityAnchorIndex?: number
  isSecondAbilitySetEnabled?: boolean
  abilityIconGroups?: AbilityIconGroup[]
  showDetails?: boolean
  onHeroInfoChange?: (heroInfo: HeroInfoDefinition) => void
  onAbilityIconChange?: (target: AbilityEditorTarget, iconPath: string) => void
  onAbilitySelect?: (target: AbilityEditorTarget, currentAbility: AbilityDefinition) => void
  onAbilitySwap?: (primaryIndex: number, currentAbility: AbilityDefinition) => void
  onSecondAbilitySetToggle?: (enabled: boolean, currentAbility: AbilityDefinition) => void
  onModeToggle?: (currentAbility: AbilityDefinition) => void
  onSave?: (ability: AbilityDefinition) => void
  onCancel?: () => void
}

type IconTarget =
  | { type: 'abilityIcon' }
  | { type: 'cooldown' }
  | { type: 'charges' }
  | { type: 'rechargeTime' }
  | { type: 'subStat'; index: number }
  | { type: 'mainCell'; sectionId: string; index: number }
  | { type: 'lowerCell'; sectionId: string; index: number }
  | { type: 'inlineIcon'; sectionId: string; marker: string }

type AbilityIconKey = 'ability1Icon' | 'ability2Icon' | 'ability3Icon' | 'ability4Icon'
type AbilitySetId = 'primary' | 'secondary'

interface AbilityEditorTarget {
  set: AbilitySetId
  index: number
}

const RICH_TEXT_COLORS: Array<{ id: string; label: string; token: string }> = [
  { id: 'spirit', label: 'Spirit', token: 'spirit' },
  { id: 'healing', label: 'Healing', token: 'healing' },
  { id: 'damage', label: 'Damage', token: 'damage' },
  { id: 'warning', label: 'Warning', token: 'warning' },
  { id: 'green', label: 'Green', token: 'green' },
  { id: 'orange', label: 'Orange', token: 'orange' },
]

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

const INLINE_ICON_CARET_STOP = '\u200B'
const TIER_BOXES: Array<{ tier: AbilityTierLevel; cost: string }> = [
  { tier: 1, cost: '1' },
  { tier: 2, cost: '2' },
  { tier: 3, cost: '5' },
]
type ActiveTier = 0 | AbilityTierLevel
type SectionDropPosition = 'before' | 'after'
const ABILITY_ICON_KEYS: AbilityIconKey[] = ['ability1Icon', 'ability2Icon', 'ability3Icon', 'ability4Icon']
const TIER_TEXT_APPROX_CHARS_PER_LINE = 16
const MAX_LOWER_GRID_CELLS = 24

type RichTextEffect =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'dark' }
  | { type: 'color'; token: string }

function getIconName(path: string) {
  return (path.split('/').at(-1) ?? path).replace('.svg', '')
}

function isIntrinsicColorPropertyIcon(pathOrName: string) {
  const fileName = pathOrName.split('/').at(-1)?.toLowerCase() ?? pathOrName.toLowerCase()

  return fileName.includes('color') || fileName.endsWith('.png')
}

function getPropertyIconVisualStyle(path: string, iconColor = ''): CSSProperties {
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

function getWhiteAbilityIconVisualStyle(path: string): CSSProperties {
  return {
    backgroundColor: '#ffffff',
    WebkitMaskImage: `url('${path}')`,
    maskImage: `url('${path}')`,
  }
}

function getInlineIconHtml(iconName: string, iconColor = '') {
  const iconPath = `/panorama/images/icons/properties/${iconName}.svg`
  const hasIntrinsicColor = isIntrinsicColorPropertyIcon(iconName)
  const className = hasIntrinsicColor ? `${styles.inlineIcon} ${styles.inlineIconOriginalColor}` : styles.inlineIcon
  const style = isIntrinsicColorPropertyIcon(iconName)
    ? `background-image:url('${iconPath}')`
    : `${iconColor ? `background-color:${iconColor};` : ''}-webkit-mask-image:url('${iconPath}');mask-image:url('${iconPath}')`
  const colorAttribute = !hasIntrinsicColor && iconColor ? ` data-inline-icon-color="${iconColor}"` : ''

  return `<span class="${className}" data-inline-icon="${iconName}"${colorAttribute} contenteditable="false" style="${style}"></span><span class="${styles.inlineIconCaret}" data-inline-icon-caret="true">${INLINE_ICON_CARET_STOP}</span>`
}

function createStat(label = 'New Stat'): AbilityStat {
  return {
    label,
    value: '0',
    unit: '',
    append: '',
    icon: '/panorama/images/icons/properties/spirit.svg',
    scaling: 'none',
    scalingValue: '0',
  }
}

function createGridCell(id: string, label = 'New Stat'): AbilityGridCell {
  return {
    id,
    ...createStat(label),
  }
}

function getNextGridCellId(section: AbilityGridSection, cellType: 'main' | 'lower') {
  const cells = cellType === 'main' ? section.mainCells : section.lowerCells
  const existingIds = new Set(cells.map(cell => cell.id))
  let index = 1

  while (existingIds.has(`${section.id}-${cellType}-${index}`)) {
    index += 1
  }

  return `${section.id}-${cellType}-${index}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function tokenTextToHtml(text: string) {
  let html = escapeHtml(text)

  html = html.replace(/\[\[inline-icon-marker:([^\]]+)\]\]/g, (_, marker: string) => `<span class="${styles.inlineIconPending}" data-inline-icon-marker="${marker}" contenteditable="false"></span>`)
  html = html.replace(/\[i:([^\]|]+)(?:\|([^\]]+))?\]/g, (_, iconName: string, iconColor: string = '') => getInlineIconHtml(iconName, iconColor))
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>')
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>')
  html = html.replace(/\[dark\]([\s\S]*?)\[\/dark\]/g, `<span class="${styles.darkenText}" data-rich-dark="true">$1</span>`)
  html = html.replace(/\[c:(spirit|healing|damage|warning|green|orange)\]([\s\S]*?)\[\/c\]/g, (_, color: string, content: string) => `<span class="${styles[`richColor${color.charAt(0).toUpperCase()}${color.slice(1)}`]}" data-rich-color="${color}">${content}</span>`)

  return html.replaceAll('\n', '<br>')
}

function hasSerializableContent(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return Boolean((node.textContent ?? '').replaceAll(INLINE_ICON_CARET_STOP, '').trim())
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false
  }

  const element = node as HTMLElement

  if (element.tagName === 'BR') {
    return false
  }

  if (element.dataset.inlineIcon || element.dataset.inlineIconMarker) {
    return true
  }

  return Array.from(element.childNodes).some(hasSerializableContent)
}

function stripLeadingSerializedLineBreaks(text: string) {
  let nextText = text
  let previousText = ''
  const openingTokenPattern = String.raw`\[(?:b|i|dark|c:(?:spirit|healing|damage|warning|green|orange))\]`
  const leadingLineBreakPattern = new RegExp(`^((?:${openingTokenPattern})*)\\n+`)

  while (nextText !== previousText) {
    previousText = nextText
    nextText = nextText.replace(leadingLineBreakPattern, '$1')
  }

  return nextText
}

function stripTrailingSerializedLineBreaks(text: string) {
  let nextText = text
  let previousText = ''
  const closingTokenPattern = String.raw`\[\/(?:b|i|dark|c)\]`
  const trailingLineBreakPattern = new RegExp(`\\n+((?:${closingTokenPattern})*)$`)

  while (nextText !== previousText) {
    previousText = nextText
    nextText = nextText.replace(trailingLineBreakPattern, '$1')
  }

  return nextText
}

function serializeRichBlockElement(element: HTMLElement) {
  const children = Array.from(element.childNodes).map(serializeRichNode).join('')

  if (!Array.from(element.childNodes).some(hasSerializableContent)) {
    return '\n'
  }

  return `${stripTrailingSerializedLineBreaks(stripLeadingSerializedLineBreaks(children))}\n`
}

function serializeRichNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replaceAll(INLINE_ICON_CARET_STOP, '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement

  if (element.tagName === 'BR') {
    return '\n'
  }

  if (element.dataset.inlineIconCaret) {
    return ''
  }

  const children = Array.from(element.childNodes).map(serializeRichNode).join('')
  const inlineIcon = element.dataset.inlineIcon
  const inlineIconColor = element.dataset.inlineIconColor
  const inlineIconMarker = element.dataset.inlineIconMarker

  if (inlineIcon) {
    return inlineIconColor ? `[i:${inlineIcon}|${inlineIconColor}]` : `[i:${inlineIcon}]`
  }

  if (inlineIconMarker) {
    return `[[inline-icon-marker:${inlineIconMarker}]]`
  }

  if (element.dataset.richColor) {
    if (!children) {
      return ''
    }

    return `[c:${element.dataset.richColor}]${children}[/c]`
  }

  if (element.dataset.richDark) {
    if (!children) {
      return ''
    }

    return `[dark]${children}[/dark]`
  }

  if (element.tagName === 'STRONG' || element.tagName === 'B') {
    if (!children) {
      return ''
    }

    return `[b]${children}[/b]`
  }

  if (element.tagName === 'EM') {
    if (!children) {
      return ''
    }

    return `[i]${children}[/i]`
  }

  if (element.tagName === 'DIV' || element.tagName === 'P') {
    return serializeRichBlockElement(element)
  }

  return children
}

function editableHtmlToTokenText(element: HTMLElement) {
  return Array.from(element.childNodes).map(serializeRichNode).join('').replace(/\n+$/g, '')
}

function estimateTierTextLineCount(text: string) {
  return text.split(/\r?\n/).reduce((total, paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)

    if (!words.length) {
      return total + 1
    }

    let lines = 1
    let currentLineLength = 0

    for (const word of words) {
      const wordLength = word.length
      const nextLength = currentLineLength ? currentLineLength + 1 + wordLength : wordLength

      if (nextLength > TIER_TEXT_APPROX_CHARS_PER_LINE && currentLineLength > 0) {
        lines += 1
        currentLineLength = wordLength
      } else {
        currentLineLength = nextLength
      }
    }

    return total + lines
  }, 0)
}

function getTierTextDensity(text: string) {
  const normalizedText = text.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
  const lineCount = estimateTierTextLineCount(normalizedText)

  if (lineCount > 5 || normalizedText.length > 68) {
    return 'tiny'
  }

  if (lineCount > 4 || normalizedText.length > 50) {
    return 'compact'
  }

  if (lineCount > 3 || normalizedText.length > 42) {
    return 'dense'
  }

  return 'default'
}

function removeRichTextColoring(fragment: DocumentFragment) {
  fragment.querySelectorAll<HTMLElement>('[data-rich-color]').forEach(element => {
    unwrapRichTextElement(element)
  })
}

function elementMatchesRichTextEffect(element: HTMLElement, effect: RichTextEffect) {
  if (effect.type === 'bold') {
    return element.tagName === 'STRONG' || element.tagName === 'B'
  }

  if (effect.type === 'italic') {
    return element.tagName === 'EM'
  }

  if (effect.type === 'dark') {
    return element.dataset.richDark === 'true'
  }

  return element.dataset.richColor === effect.token
}

function findRichTextEffectElement(node: Node, effect: RichTextEffect, root: HTMLElement) {
  let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode

  while (current && current !== root) {
    if (current instanceof HTMLElement && elementMatchesRichTextEffect(current, effect)) {
      return current
    }

    current = current.parentNode
  }

  return null
}

function getRangeUnits(range: Range, root: HTMLElement) {
  const units: Node[] = []
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        try {
          if (!range.intersectsNode(node)) {
            return NodeFilter.FILTER_REJECT
          }
        } catch {
          return NodeFilter.FILTER_REJECT
        }

        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }

        if (node instanceof HTMLElement && (node.dataset.inlineIcon || node.dataset.inlineIconMarker)) {
          return NodeFilter.FILTER_ACCEPT
        }

        return NodeFilter.FILTER_SKIP
      },
    },
  )

  let current = walker.nextNode()

  while (current) {
    units.push(current)
    current = walker.nextNode()
  }

  return units
}

function rangeFullyHasEffect(range: Range, root: HTMLElement, effect: RichTextEffect) {
  const units = getRangeUnits(range, root)

  return units.length > 0 && units.every(unit => Boolean(findRichTextEffectElement(unit, effect, root)))
}

function unwrapRichTextElement(element: HTMLElement) {
  const parent = element.parentNode

  if (!parent) {
    return null
  }

  const children = Array.from(element.childNodes)

  children.forEach(child => {
    parent.insertBefore(child, element)
  })
  element.remove()

  return children
}

function unwrapSingleContainingEffectFromRange(range: Range, root: HTMLElement, effect: RichTextEffect) {
  const startEffectElement = findRichTextEffectElement(range.startContainer, effect, root)
  const endEffectElement = findRichTextEffectElement(range.endContainer, effect, root)

  if (!startEffectElement || startEffectElement !== endEffectElement) {
    return null
  }

  const effectElement = startEffectElement
  const parent = effectElement.parentNode

  if (!parent) {
    return null
  }

  const startMarker = document.createElement('span')
  const endMarker = document.createElement('span')
  const startRange = range.cloneRange()
  const endRange = range.cloneRange()

  startMarker.dataset.richTextBoundary = 'start'
  endMarker.dataset.richTextBoundary = 'end'
  endRange.collapse(false)
  endRange.insertNode(endMarker)
  startRange.collapse(true)
  startRange.insertNode(startMarker)

  if (startMarker.parentNode !== effectElement || endMarker.parentNode !== effectElement) {
    startMarker.remove()
    endMarker.remove()
    return null
  }

  const children = Array.from(effectElement.childNodes)
  const startIndex = children.indexOf(startMarker)
  const endIndex = children.indexOf(endMarker)

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    startMarker.remove()
    endMarker.remove()
    return null
  }

  const beforeNodes = children.slice(0, startIndex)
  const selectedNodes = children.slice(startIndex + 1, endIndex)
  const afterNodes = children.slice(endIndex + 1)

  if (!selectedNodes.some(hasSerializableContent)) {
    startMarker.remove()
    endMarker.remove()
    return null
  }

  if (beforeNodes.some(hasSerializableContent)) {
    const beforeElement = effectElement.cloneNode(false) as HTMLElement

    beforeNodes.forEach(node => beforeElement.append(node))
    parent.insertBefore(beforeElement, effectElement)
  }

  selectedNodes.forEach(node => {
    parent.insertBefore(node, effectElement)
  })

  if (afterNodes.some(hasSerializableContent)) {
    const afterElement = effectElement.cloneNode(false) as HTMLElement

    afterNodes.forEach(node => afterElement.append(node))
    parent.insertBefore(afterElement, effectElement)
  }

  effectElement.remove()

  const firstNode = selectedNodes[0]
  const lastNode = selectedNodes.at(-1)

  if (!firstNode?.parentNode || !lastNode?.parentNode) {
    return null
  }

  const nextRange = document.createRange()

  nextRange.setStartBefore(firstNode)
  nextRange.setEndAfter(lastNode)

  return nextRange
}

function unwrapEffectFromRange(range: Range, root: HTMLElement, effect: RichTextEffect) {
  const partialEffectRange = unwrapSingleContainingEffectFromRange(range, root, effect)

  if (partialEffectRange) {
    return partialEffectRange
  }

  const elements = Array.from(new Set(
    getRangeUnits(range, root)
      .map(unit => findRichTextEffectElement(unit, effect, root))
      .filter((element): element is HTMLElement => Boolean(element)),
  ))
  let firstNode: Node | null = null
  let lastNode: Node | null = null

  for (const element of elements) {
    if (!element.isConnected) {
      continue
    }

    const children = unwrapRichTextElement(element)

    if (!children?.length) {
      continue
    }

    firstNode ??= children[0]
    lastNode = children.at(-1) ?? lastNode
  }

  if (!firstNode || !lastNode || !firstNode.parentNode || !lastNode.parentNode) {
    return null
  }

  const nextRange = document.createRange()

  nextRange.setStartBefore(firstNode)
  nextRange.setEndAfter(lastNode)

  return nextRange
}

function unwrapColorEffectsFromRange(range: Range, root: HTMLElement) {
  let nextRange = range

  for (const color of RICH_TEXT_COLORS) {
    const effect: RichTextEffect = { type: 'color', token: color.token }

    if (!rangeFullyHasEffect(nextRange, root, effect)) {
      continue
    }

    const unwrappedRange = unwrapEffectFromRange(nextRange, root, effect)

    if (unwrappedRange) {
      nextRange = unwrappedRange
    }
  }

  return nextRange
}

function getInlineIconIdentity(node: Node | null) {
  if (!(node instanceof HTMLElement)) {
    return null
  }

  if (node.dataset.inlineIcon) {
    return `icon:${node.dataset.inlineIcon}`
  }

  if (node.dataset.inlineIconMarker) {
    return `marker:${node.dataset.inlineIconMarker}`
  }

  return null
}

function getSignificantSibling(node: Node, direction: 'previous' | 'next') {
  let sibling = direction === 'previous' ? node.previousSibling : node.nextSibling

  while (sibling && sibling.nodeType === Node.TEXT_NODE && !(sibling.textContent ?? '').replaceAll(INLINE_ICON_CARET_STOP, '').trim()) {
    sibling = direction === 'previous' ? sibling.previousSibling : sibling.nextSibling
  }

  return sibling
}

function removeAdjacentDuplicateInlineIcons(wrapper: HTMLElement) {
  const wrappedIconIdentities = new Set(
    Array.from(wrapper.querySelectorAll<HTMLElement>('[data-inline-icon], [data-inline-icon-marker]'))
      .map(getInlineIconIdentity)
      .filter((identity): identity is string => Boolean(identity)),
  )

  if (!wrappedIconIdentities.size) {
    return
  }

  const previousIdentity = getInlineIconIdentity(getSignificantSibling(wrapper, 'previous'))
  const nextIdentity = getInlineIconIdentity(getSignificantSibling(wrapper, 'next'))

  if (previousIdentity && wrappedIconIdentities.has(previousIdentity)) {
    getSignificantSibling(wrapper, 'previous')?.remove()
  }

  if (nextIdentity && wrappedIconIdentities.has(nextIdentity)) {
    getSignificantSibling(wrapper, 'next')?.remove()
  }
}

function normalizeTierUpgradeText(text: string) {
  return text.trim().toLowerCase() === 'n/a' ? '' : text
}

function syncAbilityNames(ability: AbilityDefinition): AbilityDefinition {
  return {
    ...ability,
    tiers: ability.tiers.map(tier => ({
      ...tier,
      upgradeText: normalizeTierUpgradeText(tier.upgradeText),
      variant: {
        ...tier.variant,
        name: ability.name,
      },
    })),
  }
}

function cloneAbility(ability: AbilityDefinition): AbilityDefinition {
  return syncAbilityNames(structuredClone(ability))
}

function getAbilityIconGroupsAsAssets(groups: AbilityIconGroup[]): EditorAssetGroup[] {
  return groups.map(group => ({
    id: `ability-icons-${group.heroSlug}`,
    label: group.heroName,
    assets: group.icons.map((icon, index) => ({
      label: `${group.heroName} ${index + 1}`,
      path: icon,
    })),
  }))
}

function getActiveVariant(ability: AbilityDefinition, activeTier: ActiveTier): AbilityVariant {
  if (activeTier === 0) {
    return ability
  }

  return ability.tiers.find(tier => tier.tier === activeTier)?.variant ?? ability
}

function updateActiveVariant(ability: AbilityDefinition, activeTier: ActiveTier, updater: (variant: AbilityVariant) => AbilityVariant): AbilityDefinition {
  const nextVariant = updater(getActiveVariant(ability, activeTier))

  if (activeTier === 0) {
    return {
      ...ability,
      ...nextVariant,
    }
  }

  return {
    ...ability,
    tiers: ability.tiers.map(tier => tier.tier === activeTier ? { ...tier, variant: nextVariant } : tier),
  }
}

function updateActiveAndHigherVariants(ability: AbilityDefinition, activeTier: ActiveTier, updater: (variant: AbilityVariant) => AbilityVariant): AbilityDefinition {
  const nextAbility = activeTier === 0
    ? {
        ...ability,
        ...updater(ability),
      }
    : ability

  return {
    ...nextAbility,
    tiers: nextAbility.tiers.map(tier => {
      if (activeTier !== 0 && tier.tier < activeTier) {
        return tier
      }

      return {
        ...tier,
        variant: updater(tier.variant),
      }
    }),
  }
}

function hasCooldownEnabled(variant: AbilityVariant) {
  return variant.hasCooldown !== false
}

function getSectionActionLabel(section: AbilitySection) {
  return section.title.trim() || (section.type === 'richText' ? 'Text' : 'Grid')
}

function getRichTextAriaLabel(section: AbilityRichTextSection) {
  return section.title.trim() || 'Ability text'
}

function getMainCellTitleInputValue(cell: AbilityGridCell) {
  return cell.label === 'Damage' || cell.label === 'Value' ? '' : cell.label
}

function reorderSections(sections: AbilitySection[], sourceIndex: number, targetIndex: number, position: SectionDropPosition) {
  if (sourceIndex < 0 || sourceIndex >= sections.length || targetIndex < 0 || targetIndex >= sections.length) {
    return sections
  }

  const nextSections = [...sections]
  const [movedSection] = nextSections.splice(sourceIndex, 1)
  let insertionIndex = targetIndex + (position === 'after' ? 1 : 0)

  if (sourceIndex < insertionIndex) {
    insertionIndex -= 1
  }

  nextSections.splice(insertionIndex, 0, movedSection)
  return nextSections
}

export default function AbilityEditor({ ability, propertyIconGroups, mode = 'edit', previewLayout = 'browse', className, hero, heroInfo, activeAbilityTarget, secondaryAbilities = [], secondaryAbilitySlots, secondaryAbilityAnchorIndex, isSecondAbilitySetEnabled = secondaryAbilities.length > 0, abilityIconGroups = [], showDetails = false, onHeroInfoChange, onAbilityIconChange, onAbilitySelect, onAbilitySwap, onSecondAbilitySetToggle, onModeToggle, onSave, onCancel }: AbilityEditorProps) {
  const capabilities = ABILITY_EDITOR_CAPABILITIES[mode]
  const isPreviewMode = mode === 'preview'
  const isEditorPreview = isPreviewMode && previewLayout === 'editor'
  const [draftAbility, setDraftAbility] = useState(() => cloneAbility(ability))
  const [activeTier, setActiveTier] = useState<ActiveTier>(0)
  const [flashingTier, setFlashingTier] = useState<AbilityTierLevel | null>(null)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mainEditorColumnRef = useRef<HTMLDivElement | null>(null)
  const tierSystemRef = useRef<HTMLElement | null>(null)
  const [iconTarget, setIconTarget] = useState<IconTarget | null>(null)
  const [abilityIconTarget, setAbilityIconTarget] = useState<AbilityEditorTarget | null>(null)
  const [openScalingPickerId, setOpenScalingPickerId] = useState<string | null>(null)
  const [iconSearch, setIconSearch] = useState('')
  const [selectedIconColor, setSelectedIconColor] = useState('')
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
  const [sectionDropTarget, setSectionDropTarget] = useState<{ id: string; position: SectionDropPosition } | null>(null)
  const [baseTierButtonStyle, setBaseTierButtonStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const abilityIconAssetGroups = useMemo(() => getAbilityIconGroupsAsAssets(abilityIconGroups), [abilityIconGroups])
  const filteredIconGroups = useMemo(() => {
    const query = iconSearch.trim().toLowerCase()

    if (!query) {
      return propertyIconGroups
    }

    return propertyIconGroups.map(group => ({
      ...group,
      assets: group.assets.filter(asset => asset.label.toLowerCase().includes(query) || asset.path.toLowerCase().includes(query)),
    })).filter(group => group.assets.length)
  }, [iconSearch, propertyIconGroups])
  const activeAbility = getActiveVariant(draftAbility, activeTier)
  const abilityName = draftAbility.name
  const abilityIconPickerGroups = useMemo(() => {
    const query = iconSearch.trim().toLowerCase()

    if (!query) {
      return abilityIconAssetGroups
    }

    return abilityIconAssetGroups.map(group => ({
      ...group,
      assets: group.assets.filter(asset => asset.label.toLowerCase().includes(query) || asset.path.toLowerCase().includes(query)),
    })).filter(group => group.assets.length)
  }, [abilityIconAssetGroups, iconSearch])

  useEffect(() => () => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    function syncBaseTierButtonPosition() {
      const tierRect = tierSystemRef.current?.getBoundingClientRect()

      if (!tierRect) {
        return
      }

      const nextStyle: CSSProperties = {
        left: `${tierRect.left - 39}px`,
        top: `${tierRect.top}px`,
        visibility: 'visible',
      }

      setBaseTierButtonStyle(current => (
        current.left === nextStyle.left && current.top === nextStyle.top && current.visibility === nextStyle.visibility ? current : nextStyle
      ))
    }

    syncBaseTierButtonPosition()
    const editorColumn = mainEditorColumnRef.current

    editorColumn?.addEventListener('scroll', syncBaseTierButtonPosition, { passive: true })
    window.addEventListener('resize', syncBaseTierButtonPosition)

    return () => {
      editorColumn?.removeEventListener('scroll', syncBaseTierButtonPosition)
      window.removeEventListener('resize', syncBaseTierButtonPosition)
    }
  })

  function setActiveAbility(updater: (variant: AbilityVariant) => AbilityVariant, options: { cascadeToHigher?: boolean } = {}) {
    if (!capabilities.canEditStats && !capabilities.canEditText) {
      return
    }

    setDraftAbility(current => (
      options.cascadeToHigher
        ? updateActiveAndHigherVariants(current, activeTier, updater)
        : updateActiveVariant(current, activeTier, updater)
    ))
  }

  function selectTier(tier: ActiveTier) {
    setActiveTier(tier)

    if (tier === 0) {
      return
    }

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current)
    }

    setFlashingTier(tier)
    flashTimeoutRef.current = setTimeout(() => {
      setFlashingTier(current => current === tier ? null : current)
    }, 500)
  }

  function updateTierText(tierToUpdate: AbilityTierLevel, upgradeText: string) {
    if (!capabilities.canEditText) {
      return
    }

    setDraftAbility(current => ({
      ...current,
      tiers: current.tiers.map(tier => tier.tier === tierToUpdate ? { ...tier, upgradeText: normalizeTierUpgradeText(upgradeText) } : tier),
    }))
  }

  function updateAbilityName(name: string) {
    if (!capabilities.canEditText) {
      return
    }

    setDraftAbility(current => syncAbilityNames({
      ...current,
      name,
    }))
  }

  function updateStat(stat: AbilityStat, patch: Partial<AbilityStat>): AbilityStat {
    return {
      ...stat,
      ...patch,
    }
  }

  function updateSubStat(index: number, patch: Partial<AbilityStat>) {
    setActiveAbility(current => ({
      ...current,
      subStats: current.subStats.map((stat, statIndex) => (statIndex === index ? updateStat(stat, patch) : stat)),
    }), { cascadeToHigher: true })
  }

  function removeSubStat(index: number) {
    setActiveAbility(current => ({
      ...current,
      subStats: current.subStats.filter((_, statIndex) => statIndex !== index),
    }), { cascadeToHigher: true })
  }

  function updateSection(sectionId: string, updater: (section: AbilitySection) => AbilitySection, options: { cascadeToHigher?: boolean } = {}) {
    const activeSectionIndex = activeAbility.sections.findIndex(section => section.id === sectionId)

    if (activeSectionIndex === -1) {
      return
    }

    setActiveAbility(current => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => (sectionIndex === activeSectionIndex ? updater(section) : section)),
    }), options)
  }

  function removeSection(sectionId: string) {
    const activeSectionIndex = activeAbility.sections.findIndex(section => section.id === sectionId)

    if (activeSectionIndex === -1) {
      return
    }

    setActiveAbility(current => ({
      ...current,
      sections: current.sections.filter((_, sectionIndex) => sectionIndex !== activeSectionIndex),
    }), { cascadeToHigher: true })
  }

  function updateGridCell(sectionId: string, cellType: 'mainCells' | 'lowerCells', index: number, patch: Partial<AbilityGridCell>) {
    updateSection(sectionId, section => {
      if (section.type !== 'grid') {
        return section
      }

      return {
        ...section,
        [cellType]: section[cellType].map((cell, cellIndex) => (cellIndex === index ? { ...cell, ...patch } : cell)),
      }
    }, { cascadeToHigher: true })
  }

  function addSection(type: 'richText' | 'grid') {
    const id = `ability-${draftAbility.slot}-${type}-${Date.now()}`
    const section: AbilitySection = type === 'richText'
      ? {
          id,
          type: 'richText',
          title: 'Description',
          text: 'New ability detail.',
        }
      : {
          id,
          type: 'grid',
          title: 'Stats',
          mainCells: [createGridCell(`${id}-main-1`, 'Damage')],
          lowerCells: [],
        }

    setActiveAbility(current => ({
      ...current,
      sections: [...current.sections, section],
    }), { cascadeToHigher: true })
  }

  function reorderSection(sourceId: string, targetId: string, position: SectionDropPosition) {
    const sourceIndex = activeAbility.sections.findIndex(section => section.id === sourceId)
    const targetIndex = activeAbility.sections.findIndex(section => section.id === targetId)

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return
    }

    setActiveAbility(current => ({
      ...current,
      sections: reorderSections(current.sections, sourceIndex, targetIndex, position),
    }), { cascadeToHigher: true })
  }

  function handleSectionDragStart(event: DragEvent<HTMLButtonElement>, sectionId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', sectionId)
    setDraggedSectionId(sectionId)
    setSectionDropTarget(null)
  }

  function handleSectionDragOver(event: DragEvent<HTMLElement>, targetId: string) {
    if (!draggedSectionId || draggedSectionId === targetId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'

    setSectionDropTarget(current => current?.id === targetId && current.position === position
      ? current
      : { id: targetId, position })
  }

  function finishSectionDrag() {
    setDraggedSectionId(null)
    setSectionDropTarget(null)
  }

  function handleSectionDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault()

    if (draggedSectionId && sectionDropTarget?.id === targetId) {
      reorderSection(draggedSectionId, targetId, sectionDropTarget.position)
    }

    finishSectionDrag()
  }

  function handleSectionReorderKey(event: KeyboardEvent<HTMLButtonElement>, sectionId: string) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return
    }

    const sourceIndex = activeAbility.sections.findIndex(section => section.id === sectionId)
    const targetIndex = sourceIndex + (event.key === 'ArrowUp' ? -1 : 1)
    const target = activeAbility.sections[targetIndex]

    if (!target) {
      return
    }

    event.preventDefault()
    reorderSection(sectionId, target.id, event.key === 'ArrowUp' ? 'before' : 'after')
  }

  function getIconTargetStat(target: IconTarget): AbilityStat | null {
    if (target.type === 'cooldown') {
      return activeAbility.cooldown
    }

    if (target.type === 'charges') {
      return activeAbility.charges
    }

    if (target.type === 'rechargeTime') {
      return activeAbility.rechargeTime
    }

    if (target.type === 'subStat') {
      return activeAbility.subStats[target.index] ?? null
    }

    if (target.type === 'mainCell' || target.type === 'lowerCell') {
      const section = activeAbility.sections.find(candidate => candidate.id === target.sectionId)

      if (section?.type !== 'grid') {
        return null
      }

      return target.type === 'mainCell'
        ? section.mainCells[target.index] ?? null
        : section.lowerCells[target.index] ?? null
    }

    return null
  }

  function updateIconTarget(target: IconTarget, patch: Partial<AbilityStat>) {
    if (target.type === 'cooldown') {
      setActiveAbility(current => ({ ...current, cooldown: updateStat(current.cooldown, patch) }), { cascadeToHigher: true })
    } else if (target.type === 'charges') {
      setActiveAbility(current => ({ ...current, charges: updateStat(current.charges, patch) }), { cascadeToHigher: true })
    } else if (target.type === 'rechargeTime') {
      setActiveAbility(current => ({ ...current, rechargeTime: updateStat(current.rechargeTime, patch) }), { cascadeToHigher: true })
    } else if (target.type === 'subStat') {
      updateSubStat(target.index, patch)
    } else if (target.type === 'mainCell') {
      updateGridCell(target.sectionId, 'mainCells', target.index, patch)
    } else if (target.type === 'lowerCell') {
      updateGridCell(target.sectionId, 'lowerCells', target.index, patch)
    }
  }

  function openIconModal(target: IconTarget) {
    setSelectedIconColor(getIconTargetStat(target)?.iconColor ?? '')
    setIconTarget(target)
  }

  function applyIconColor(color: string) {
    setSelectedIconColor(color)

    if (!iconTarget) {
      return
    }

    const targetStat = getIconTargetStat(iconTarget)

    if (!targetStat || isIntrinsicColorPropertyIcon(targetStat.icon)) {
      return
    }

    updateIconTarget(iconTarget, { iconColor: color })
  }

  function applyIcon(path: string) {
    if (!iconTarget) {
      return
    }

    const iconColor = isIntrinsicColorPropertyIcon(path) ? '' : selectedIconColor

    if (iconTarget.type === 'abilityIcon') {
      setActiveAbility(current => ({ ...current, icon: path }))
    } else if (iconTarget.type !== 'inlineIcon') {
      updateIconTarget(iconTarget, { icon: path, iconColor })
    } else {
      updateSection(iconTarget.sectionId, section => {
        if (section.type !== 'richText') {
          return section
        }

        const markerToken = `[[inline-icon-marker:${iconTarget.marker}]]`
        const iconName = getIconName(path)
        const iconToken = iconColor ? `[i:${iconName}|${iconColor}]` : `[i:${iconName}]`

        return {
          ...section,
          text: section.text.includes(markerToken) ? section.text.replace(markerToken, iconToken) : `${section.text}${section.text ? ' ' : ''}${iconToken}`,
        }
      }, { cascadeToHigher: true })
    }

    setIconTarget(null)
    setIconSearch('')
    setSelectedIconColor('')
  }

  function applyHeroAbilityIcon(target: AbilityEditorTarget, iconPath: string) {
    const iconKey = ABILITY_ICON_KEYS[target.index]

    if (target.set === 'primary' && heroInfo && iconKey && onHeroInfoChange) {
      onHeroInfoChange({
        ...heroInfo,
        [iconKey]: iconPath,
      })
    }

    onAbilityIconChange?.(target, iconPath)

    if (target.set === (activeAbilityTarget?.set ?? 'primary') && target.index === (activeAbilityTarget?.index ?? draftAbility.slot - 1)) {
      setDraftAbility(current => ({
        ...current,
        icon: iconPath,
      }))
    }

    setAbilityIconTarget(null)
    setIconSearch('')
  }

  function closeIconModal() {
    if (iconTarget?.type === 'inlineIcon') {
      const markerToken = `[[inline-icon-marker:${iconTarget.marker}]]`

      document.querySelectorAll<HTMLElement>('[data-inline-icon-marker]').forEach(element => {
        if (element.dataset.inlineIconMarker === iconTarget.marker) {
          element.remove()
        }
      })

      updateSection(iconTarget.sectionId, section => {
        if (section.type !== 'richText') {
          return section
        }

        return {
          ...section,
          text: section.text.replace(markerToken, ''),
        }
      }, { cascadeToHigher: true })
    }

    setIconTarget(null)
    setIconSearch('')
    setSelectedIconColor('')
  }

  function closeAbilityIconModal() {
    setAbilityIconTarget(null)
    setIconSearch('')
  }

  function renderInlineStat(stat: AbilityStat, label: string, onChange: (stat: AbilityStat) => void, onIconClick: () => void, variant: 'timing' | 'sub' | 'main' | 'lower' = 'sub') {
    const canEditStat = capabilities.canEditStats
    const showAppend = (variant === 'timing' || variant === 'main' || variant === 'lower') && (capabilities.canEditStats || Boolean(stat.append))
    const showDetail = variant !== 'lower'
    const valueInputStyle = { width: `${Math.max(2, String(stat.value).length + 1)}ch` }
    const unitInputStyle = variant === 'main'
      ? { width: `${Math.max(6, (stat.unit ?? '').length + 1)}ch`, visibility: 'visible' as const }
      : variant === 'sub'
        ? { width: stat.unit ? `${Math.max(2, stat.unit.length + 1)}ch` : '2ch', visibility: (capabilities.canEditStats || stat.unit) ? 'visible' as const : 'hidden' as const }
        : variant === 'timing'
        ? { width: stat.unit ? `${Math.max(2, stat.unit.length + 1)}ch` : '0px', visibility: stat.unit ? 'visible' as const : 'hidden' as const }
        : undefined
    const appendInputStyle = showAppend
      ? { width: stat.append ? `${Math.max(3, stat.append.length + 1)}ch` : '2ch' }
      : undefined
    const nextValue = (value: string) => variant === 'main' ? value.replace(/\s+/g, '') : value.replace(/[^\d.-]/g, '')
    const statLabel = capabilities.canEditStats ? `${label} stat. Scaling ${stat.scaling}. Use the scaling button to edit scaling.` : `${label} stat`
    const iconContent = (
      <span
        className={cn(styles.propertyIcon, isIntrinsicColorPropertyIcon(stat.icon) && styles.propertyIconOriginalColor)}
        aria-hidden="true"
        style={getPropertyIconVisualStyle(stat.icon, stat.iconColor)}
      />
    )
    const iconControl = !capabilities.canChangeIcons
      ? <span className={styles.iconButton} aria-hidden="true">{iconContent}</span>
      : (
        <button type="button" className={styles.iconButton} aria-label={`Choose ${label} icon`} onClick={onIconClick}>
          {iconContent}
        </button>
      )
    const hasScalingControl = canEditStat || stat.scaling !== 'none'
    const renderStatText = (className: string, value: string | number | undefined, fallback = '', wrap = true) => (
      canEditStat ? null : (
        <span className={cn(className, styles.readonlyStatText, !wrap && styles.readonlyStatTextNoWrap)}>
          {value === undefined || value === '' ? fallback : value}
        </span>
      )
    )

    return (
      <div
        className={cn(styles.inlineStatEditor, styles[`inlineStatEditor${variant.charAt(0).toUpperCase()}${variant.slice(1)}`], stat.scaling !== 'none' && styles.inlineStatEditorScaled, hasScalingControl && styles.inlineStatEditorHasScaling)}
        data-scaling={stat.scaling}
        data-testid={`ability-stat-${variant}-${label.toLowerCase().replaceAll(' ', '-')}`}
        role="group"
        aria-label={statLabel}
      >
        {variant === 'main' ? (
          <div className={styles.mainRow}>
            {iconControl}
            <label className={styles.valueInputLabel}>
              <span className={styles.srOnly}>Value</span>
              {canEditStat ? (
                <input
                  className={styles.valueInput}
                  style={valueInputStyle}
                  value={stat.value}
                  placeholder="0"
                  onChange={event => onChange(updateStat(stat, { value: nextValue(event.target.value) }))}
                />
              ) : renderStatText(styles.valueInput, stat.value, '0', false)}
            </label>
            {showAppend ? (
              <label className={styles.appendInputLabel}>
                <span className={styles.srOnly}>Append</span>
                {canEditStat ? (
                  <input
                    className={styles.appendInput}
                    style={appendInputStyle}
                    value={stat.append ?? ''}
                    placeholder="+"
                    onChange={event => onChange(updateStat(stat, { append: event.target.value }))}
                  />
                ) : renderStatText(styles.appendInput, stat.append, '', false)}
              </label>
            ) : null}
          </div>
        ) : (
          <>
            {iconControl}
            <label className={styles.valueInputLabel}>
              <span className={styles.srOnly}>Value</span>
              {canEditStat ? (
                <input
                  className={styles.valueInput}
                  style={variant === 'timing' || variant === 'sub' || variant === 'lower' ? valueInputStyle : undefined}
                  value={stat.value}
                  placeholder="0"
                  onChange={event => onChange(updateStat(stat, { value: nextValue(event.target.value) }))}
                />
              ) : renderStatText(styles.valueInput, stat.value, '0', false)}
            </label>
            {showAppend ? (
              <label className={styles.appendInputLabel}>
                <span className={styles.srOnly}>Append</span>
                {canEditStat ? (
                  <input
                    className={styles.appendInput}
                    style={appendInputStyle}
                    value={stat.append ?? ''}
                    placeholder="+"
                    onChange={event => onChange(updateStat(stat, { append: event.target.value }))}
                  />
                ) : renderStatText(styles.appendInput, stat.append, '', false)}
              </label>
            ) : null}
          </>
        )}
        {showDetail ? (
          <label className={styles.unitInputLabel}>
          <span className={styles.srOnly}>{variant === 'main' ? 'Detail' : 'Unit'}</span>
          {canEditStat ? (
            <input
              className={styles.unitInput}
              style={unitInputStyle}
              placeholder={variant === 'main' ? 'Detail' : 'Unit'}
              value={stat.unit ?? ''}
              onChange={event => onChange(updateStat(stat, { unit: event.target.value }))}
            />
          ) : renderStatText(styles.unitInput, stat.unit, '', variant === 'main')}
          </label>
        ) : null}
        {variant !== 'timing' && variant !== 'sub' && variant !== 'main' ? (
          <label className={styles.statLabelInputLabel}>
            <span className={styles.srOnly}>Detail</span>
            {canEditStat ? (
              <input
                className={styles.statLabelInput}
                value={stat.label}
                aria-label="Detail"
                placeholder="Detail"
                onChange={event => onChange(updateStat(stat, { label: event.target.value }))}
              />
            ) : renderStatText(styles.statLabelInput, stat.label)}
          </label>
        ) : null}
        <span className={cn(styles.scalingValueWrap, variant !== 'main' && !capabilities.canEditStats && showDetails && stat.scaling !== 'none' && styles.scalingValueWrapExpanded)}>
          {capabilities.canEditStats ? (
            <ScalingPicker
              label={label}
              scaling={stat.scaling}
              scalingValue={stat.scalingValue}
              boundaryRef={mainEditorColumnRef}
              openPickerId={openScalingPickerId}
              onChange={updates => onChange(updateStat(stat, updates))}
              onOpenPickerChange={setOpenScalingPickerId}
            />
          ) : (
            <ScalingValueEditor scaling={stat.scaling} scalingValue={stat.scalingValue} showValue={showDetails} valuePosition={variant === 'main' ? 'lower' : 'center'} />
          )}
        </span>
      </div>
    )
  }

  return (
    <section className={cn(styles.focusShell, isPreviewMode && styles.focusShellPreview, className)} data-testid="ability-editor" aria-label={`${isPreviewMode ? 'Ability preview' : 'Ability editor'} for ${abilityName}`}>
      <div className={styles.focusBackdrop} />
      {hero && heroInfo && (capabilities.showHeroInfoCluster || isEditorPreview) ? (
        <>
          {capabilities.canToggleSecondSet ? (
            <button
            type="button"
            className={cn(styles.secondAbilityToggle, isSecondAbilitySetEnabled && styles.secondAbilityToggleActive)}
            aria-label="Secondary Abilities"
            aria-pressed={isSecondAbilitySetEnabled}
            onClick={() => onSecondAbilitySetToggle?.(true, syncAbilityNames(draftAbility))}
            >
              <span>2nd</span>
              <strong>Slots</strong>
            </button>
          ) : null}
          <AbilityHeroInfoCluster
            hero={hero}
            heroInfo={heroInfo}
            activeTarget={activeAbilityTarget ?? { set: 'primary', index: draftAbility.slot - 1 }}
            secondaryAbilities={secondaryAbilities}
            secondaryAbilitySlots={secondaryAbilitySlots}
            secondaryAbilityAnchorIndex={secondaryAbilityAnchorIndex}
            editable={capabilities.canChangeIcons}
            onAbilityClick={target => {
              const currentTarget = activeAbilityTarget ?? { set: 'primary' as const, index: draftAbility.slot - 1 }

              if (!capabilities.canChangeIcons) {
                if (target.set !== currentTarget.set || target.index !== currentTarget.index) {
                  onAbilitySelect?.(target, syncAbilityNames(draftAbility))
                }

                return
              }

              if (target.set === currentTarget.set && target.index === currentTarget.index) {
                setAbilityIconTarget(target)
                return
              }

              onAbilitySelect?.(target, syncAbilityNames(draftAbility))
            }}
            onAbilitySwap={onAbilitySwap ? primaryIndex => onAbilitySwap(primaryIndex, syncAbilityNames(draftAbility)) : undefined}
          />
        </>
      ) : null}
      <div className={cn(styles.editorLayout, isPreviewMode && previewLayout === 'browse' && styles.editorLayoutPreview)} data-ability-preview-panel={isPreviewMode ? 'true' : undefined}>
        {capabilities.canAddSections ? (
          <aside className={styles.sideTabs} aria-label="Append ability sections">
          <button type="button" aria-label="Add sub-header stat" onClick={() => setActiveAbility(current => ({ ...current, subStats: [...current.subStats, createStat('Stat')] }), { cascadeToHigher: true })}>
            <Plus aria-hidden="true" />
          </button>
          <button type="button" onClick={() => addSection('richText')}>Text</button>
          <button type="button" onClick={() => addSection('grid')}>Grid</button>
          </aside>
        ) : null}

        <div className={cn(styles.mainEditorColumn, isPreviewMode && styles.mainEditorColumnPreview, isEditorPreview && styles.mainEditorColumnEditorPreview)} data-testid="ability-editor-scroll-container" ref={mainEditorColumnRef}>
          <div className={styles.tooltipSurface}>
            <div className={styles.scrollContent}>
              <div className={styles.tooltipTexture} />
              <header className={styles.header}>
              <div className={styles.titleGroup}>
                {capabilities.canChangeIcons ? (
                  <button type="button" className={styles.abilityIconButton} aria-label="Choose ability icon" onClick={() => openIconModal({ type: 'abilityIcon' })}>
                  <span aria-hidden="true" style={{ WebkitMaskImage: `url('${activeAbility.icon}')`, maskImage: `url('${activeAbility.icon}')` }} />
                  </button>
                ) : null}
                <label className={styles.nameInputWrap}>
                  <span className={styles.srOnly}>Ability Name</span>
                  <input value={abilityName} placeholder="Ability name" readOnly={!capabilities.canEditText} tabIndex={capabilities.canEditText ? undefined : -1} onChange={!capabilities.canEditText ? undefined : event => updateAbilityName(event.target.value)} />
                </label>
              </div>

              <div className={styles.timingPanel}>
                {capabilities.canToggleCharges ? (
                  <div className={styles.timingToggleRow}>
                    <label className={styles.chargeToggle}>
                      <input type="checkbox" checked={activeAbility.hasCharges} onChange={event => setActiveAbility(current => ({ ...current, hasCharges: event.target.checked }), { cascadeToHigher: true })} />
                      Charges
                    </label>
                    <label className={styles.chargeToggle}>
                      <input type="checkbox" checked={hasCooldownEnabled(activeAbility)} onChange={event => setActiveAbility(current => ({ ...current, hasCooldown: event.target.checked }), { cascadeToHigher: true })} />
                      Cooldown
                    </label>
                  </div>
                ) : null}
                {activeAbility.hasCharges ? (
                  <div className={styles.chargeGrid}>
                    {renderInlineStat(activeAbility.charges, 'Charges', charges => setActiveAbility(current => ({ ...current, charges }), { cascadeToHigher: true }), () => openIconModal({ type: 'charges' }), 'timing')}
                    {renderInlineStat(activeAbility.rechargeTime, 'Recharge Time', rechargeTime => setActiveAbility(current => ({ ...current, rechargeTime }), { cascadeToHigher: true }), () => openIconModal({ type: 'rechargeTime' }), 'timing')}
                  </div>
                ) : null}
                {hasCooldownEnabled(activeAbility) ? renderInlineStat(activeAbility.cooldown, 'Cooldown', cooldown => setActiveAbility(current => ({ ...current, cooldown }), { cascadeToHigher: true }), () => openIconModal({ type: 'cooldown' }), 'timing') : null}
              </div>
              </header>

              <section className={styles.subStats} aria-label="Sub-header stats">
              {activeAbility.subStats.map((stat, index) => (
                <div key={`${stat.label}-${index}`} className={styles.subStat}>
                  {capabilities.canDeleteSections ? (
                    <button type="button" className={styles.removeStatButton} aria-label={`Remove ${stat.label}`} onClick={() => removeSubStat(index)}>
                    <X aria-hidden="true" />
                    </button>
                  ) : null}
                  {renderInlineStat(stat, stat.label, nextStat => updateSubStat(index, nextStat), () => openIconModal({ type: 'subStat', index }), 'sub')}
                </div>
              ))}
              </section>

              <section className={styles.sections} aria-label="Ability sections">
              {activeAbility.sections.map(section => (
                <article
                  key={section.id}
                  className={styles.section}
                  data-dragging={draggedSectionId === section.id ? 'true' : undefined}
                  data-drop-position={sectionDropTarget?.id === section.id ? sectionDropTarget.position : undefined}
                  onDragOver={event => handleSectionDragOver(event, section.id)}
                  onDrop={event => handleSectionDrop(event, section.id)}
                >
                  {capabilities.canDeleteSections ? (
                    <>
                      <button
                        type="button"
                        className={styles.sectionDragHandle}
                        aria-label={`Reorder ${getSectionActionLabel(section)} section`}
                        title="Drag to reorder; use arrow keys to move"
                        draggable
                        onDragStart={event => handleSectionDragStart(event, section.id)}
                        onDragEnd={finishSectionDrag}
                        onKeyDown={event => handleSectionReorderKey(event, section.id)}
                      >
                        <GripVertical aria-hidden="true" />
                      </button>
                      <button type="button" className={styles.removeSectionButton} aria-label={`Remove ${getSectionActionLabel(section)} section`} onClick={() => removeSection(section.id)}>
                        <X aria-hidden="true" />
                      </button>
                    </>
                  ) : null}

                  {section.type === 'richText' ? (
                    <>
                      <RichTextSection section={section} readOnly={!capabilities.canEditText} onTextChange={text => updateSection(section.id, current => ({ ...current, text }), { cascadeToHigher: true })} onInlineIcon={marker => openIconModal({ type: 'inlineIcon', sectionId: section.id, marker })} />
                    </>
                  ) : (
                    <GridSection
                      section={section}
                      readOnly={!capabilities.canEditStats}
                      renderInlineStat={renderInlineStat}
                      onAddMainCell={() => updateSection(section.id, current => current.type === 'grid' ? { ...current, mainCells: [...current.mainCells, createGridCell(getNextGridCellId(current, 'main'), 'Value')].slice(0, 3) } : current, { cascadeToHigher: true })}
                      onAddLowerCell={() => updateSection(section.id, current => current.type === 'grid' && current.lowerCells.length < MAX_LOWER_GRID_CELLS ? { ...current, lowerCells: [...current.lowerCells, createGridCell(getNextGridCellId(current, 'lower'), 'Detail')] } : current, { cascadeToHigher: true })}
                      onMainCellChange={(index, cell) => updateGridCell(section.id, 'mainCells', index, cell)}
                      onLowerCellChange={(index, cell) => updateGridCell(section.id, 'lowerCells', index, cell)}
                      onMainCellRemove={index => updateSection(section.id, current => current.type === 'grid' ? { ...current, mainCells: current.mainCells.filter((_, cellIndex) => cellIndex !== index) } : current, { cascadeToHigher: true })}
                      onLowerCellRemove={index => updateSection(section.id, current => current.type === 'grid' ? { ...current, lowerCells: current.lowerCells.filter((_, cellIndex) => cellIndex !== index) } : current, { cascadeToHigher: true })}
                      onMainIconClick={index => openIconModal({ type: 'mainCell', sectionId: section.id, index })}
                      onLowerIconClick={index => openIconModal({ type: 'lowerCell', sectionId: section.id, index })}
                    />
                  )}
                </article>
              ))}
              </section>
            </div>
          </div>
          <TierSelector
            activeTier={activeTier}
            flashingTier={flashingTier}
            tiers={draftAbility.tiers}
            readOnly={!capabilities.canEditText}
            canSwitchTiers={capabilities.canSwitchTiers}
            tierSystemRef={tierSystemRef}
            onTierSelect={selectTier}
            onTierTextChange={updateTierText}
          />
        </div>

        {onModeToggle ? (
          <button
            type="button"
            className={cn(styles.modeToggleButton, isPreviewMode && styles.modeToggleButtonActive)}
            data-testid="ability-mode-toggle"
            data-placement="right"
            aria-pressed={isPreviewMode}
            onClick={() => onModeToggle(syncAbilityNames(draftAbility))}
          >
            {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          </button>
        ) : null}

        <aside className={styles.returnPanel}>
          <p>{isPreviewMode ? 'Ability Preview' : 'Focused Ability Editor'}</p>
          <h2>{abilityName}</h2>
          <button type="button" className={styles.saveReturnButton} onClick={() => isPreviewMode ? onCancel?.() : onSave?.(syncAbilityNames(draftAbility))}>
            Go Back
          </button>
        </aside>
      </div>

      <button
        type="button"
        className={cn(styles.baseTierButton, activeTier === 0 && styles.baseTierButtonActive)}
        title="View base ability stats"
        aria-pressed={activeTier === 0}
        style={baseTierButtonStyle}
        onClick={() => selectTier(0)}
      >
        0
      </button>

      {iconTarget ? (
        <IconSearchModal
          groups={filteredIconGroups}
          search={iconSearch}
          selectedIconColor={selectedIconColor}
          onIconColorChange={applyIconColor}
          onSearch={setIconSearch}
          onSelect={applyIcon}
          onClose={closeIconModal}
        />
      ) : null}

      {abilityIconTarget ? (
        <IconSearchModal
          groups={abilityIconPickerGroups}
          statGroups={filteredIconGroups}
          search={iconSearch}
          selectedIconColor=""
          title="Ability icon selector"
          testId="ability-icon-modal"
          searchPlaceholder="Search ability icons"
          previewMode="ability"
          showColorPicker={false}
          closeLabel="Close ability icon selector"
          onIconColorChange={() => undefined}
          onSearch={setIconSearch}
          onSelect={iconPath => applyHeroAbilityIcon(abilityIconTarget, iconPath)}
          onClose={closeAbilityIconModal}
        />
      ) : null}
    </section>
  )
}

interface RichTextSectionProps {
  section: AbilityRichTextSection
  readOnly?: boolean
  onTextChange: (text: string) => void
  onInlineIcon: (marker: string) => void
}

interface TierSelectorProps {
  activeTier: ActiveTier
  flashingTier: AbilityTierLevel | null
  tiers: AbilityTier[]
  readOnly?: boolean
  canSwitchTiers?: boolean
  tierSystemRef: RefObject<HTMLElement | null>
  onTierSelect: (tier: ActiveTier) => void
  onTierTextChange: (tier: AbilityTierLevel, text: string) => void
}

function TierSelector({ activeTier, flashingTier, tiers, readOnly = false, canSwitchTiers = true, tierSystemRef, onTierSelect, onTierTextChange }: TierSelectorProps) {
  return (
    <section className={styles.tierSystem} aria-label="Ability tiers" ref={tierSystemRef}>
      <div className={styles.tierBoxes}>
        {TIER_BOXES.map(({ tier, cost }) => {
          const tierData = tiers.find(candidate => candidate.tier === tier)

          if (!tierData) {
            return null
          }

          return (
            <article
              key={tier}
              className={cn(
                styles.tierBox,
                activeTier !== 0 && tier <= activeTier && styles.tierBoxActive,
                flashingTier === tier && styles.tierBoxFlashing,
              )}
              aria-label={`Tier ${tier} upgrade`}
              aria-pressed={activeTier === tier}
              role="button"
              tabIndex={canSwitchTiers ? 0 : undefined}
              onClick={event => {
                if (!canSwitchTiers) {
                  return
                }

                if (event.target instanceof HTMLElement && event.target.closest('[contenteditable="true"], button')) {
                  return
                }

                onTierSelect(tier)
              }}
              onKeyDown={event => {
                if (!canSwitchTiers) {
                  return
                }

                if (event.target instanceof HTMLElement && event.target.closest('[contenteditable="true"], button')) {
                  return
                }

                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onTierSelect(tier)
                }
              }}
            >
              <header className={styles.tierHeader}>
                <span className={styles.tierApIcon} aria-hidden="true" />
                <span>{cost}</span>
              </header>
              <TierTextEditor
                text={tierData.upgradeText}
                tier={tier}
                readOnly={readOnly}
                onFocus={() => onTierSelect(tier)}
                onTextChange={text => onTierTextChange(tier, text)}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}

interface TierTextEditorProps {
  text: string
  tier: AbilityTierLevel
  readOnly?: boolean
  onFocus: () => void
  onTextChange: (text: string) => void
}

function TierTextEditor({ text, tier, readOnly = false, onFocus, onTextChange }: TierTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastTextRef = useRef('')
  const lastSelectionRef = useRef<Range | null>(null)
  const handledToolbarPointerRef = useRef(false)
  const textDensity = getTierTextDensity(text)
  const isEmpty = text.trim().length === 0

  useEffect(() => {
    if (!editorRef.current || document.activeElement === editorRef.current || lastTextRef.current === text) {
      return
    }

    editorRef.current.innerHTML = tokenTextToHtml(text)
    lastTextRef.current = text
  }, [text])

  useEffect(() => {
    function handleSelectionChange() {
      rememberSelection({ allowCollapsed: false })
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  })

  function isEditorNode(node: Node | null) {
    return Boolean(node && editorRef.current && (node === editorRef.current || editorRef.current.contains(node)))
  }

  function rememberSelection({ allowCollapsed = true }: { allowCollapsed?: boolean } = {}) {
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0 || !isEditorNode(selection.anchorNode) || !isEditorNode(selection.focusNode)) {
      return
    }

    const range = selection.getRangeAt(0)

    if (!allowCollapsed && range.collapsed) {
      return
    }

    lastSelectionRef.current = range.cloneRange()
  }

  function getEditorRange() {
    const selection = window.getSelection()
    const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null

    if (currentRange && isEditorNode(currentRange.commonAncestorContainer)) {
      return currentRange
    }

    return lastSelectionRef.current && isEditorNode(lastSelectionRef.current.commonAncestorContainer)
      ? lastSelectionRef.current
      : null
  }

  function syncText() {
    if (!editorRef.current) {
      return
    }

    const nextText = editableHtmlToTokenText(editorRef.current)

    if (!nextText.trim()) {
      editorRef.current.innerHTML = ''
    }

    lastTextRef.current = nextText
    onTextChange(nextText)
  }

  function applyBold() {
    const range = getEditorRange()
    const selection = window.getSelection()

    if (!selection || !range || range.collapsed || !editorRef.current) {
      return
    }

    if (rangeFullyHasEffect(range, editorRef.current, { type: 'bold' })) {
      const nextRange = unwrapEffectFromRange(range, editorRef.current, { type: 'bold' })

      if (nextRange) {
        selection.removeAllRanges()
        selection.addRange(nextRange)
        lastSelectionRef.current = nextRange.cloneRange()
        editorRef.current.focus()
        syncText()
      }

      return
    }

    selection.removeAllRanges()
    selection.addRange(range)

    const wrapper = document.createElement('strong')
    const selectedContent = range.extractContents()

    wrapper.append(selectedContent)
    range.insertNode(wrapper)
    const nextRange = document.createRange()

    nextRange.selectNodeContents(wrapper)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    lastSelectionRef.current = nextRange.cloneRange()
    editorRef.current?.focus()
    syncText()
  }

  function handleToolbarPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    rememberSelection({ allowCollapsed: false })
    handledToolbarPointerRef.current = true
    applyBold()
  }

  function handleToolbarClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (!handledToolbarPointerRef.current) {
      applyBold()
    }

    handledToolbarPointerRef.current = false
  }

  return (
    <div className={cn(styles.tierTextShell, readOnly && styles.tierTextShellReadOnly)} onClick={readOnly ? undefined : event => event.stopPropagation()}>
      {!readOnly ? (
        <div className={styles.tierTextToolbar}>
        <button
          type="button"
          className={styles.tierTextBoldButton}
          aria-label={`Bold Tier ${tier} selected text`}
          onPointerDown={handleToolbarPointerDown}
          onClick={handleToolbarClick}
        >
          <Bold aria-hidden="true" />
        </button>
        </div>
      ) : null}
      <div
        ref={editorRef}
        className={cn(
          styles.tierTextEditor,
          readOnly && styles.tierTextEditorReadOnly,
          textDensity === 'dense' && styles.tierTextEditorDense,
          textDensity === 'compact' && styles.tierTextEditorCompact,
          textDensity === 'tiny' && styles.tierTextEditorTiny,
        )}
        contentEditable={!readOnly}
        role="textbox"
        aria-label={`Tier ${tier} upgrade text`}
        aria-readonly={readOnly || undefined}
        data-placeholder={`Tier ${tier} upgrade`}
        data-empty={isEmpty ? 'true' : undefined}
        spellCheck
        onFocus={onFocus}
        onKeyDown={readOnly ? undefined : event => event.stopPropagation()}
        onPointerUp={readOnly ? undefined : () => rememberSelection()}
        onMouseUp={readOnly ? undefined : () => rememberSelection()}
        onKeyUp={readOnly ? undefined : () => rememberSelection()}
        onInput={readOnly ? undefined : () => {
          rememberSelection()
          syncText()
        }}
        suppressContentEditableWarning
      />
    </div>
  )
}

interface AbilityHeroInfoClusterProps {
  hero: HeroDefinition
  heroInfo: HeroInfoDefinition
  activeTarget: AbilityEditorTarget
  secondaryAbilities: AbilityDefinition[]
  secondaryAbilitySlots?: number[]
  secondaryAbilityAnchorIndex?: number
  editable?: boolean
  onAbilityClick: (target: AbilityEditorTarget) => void
  onAbilitySwap?: (primaryIndex: number) => void
}

function AbilityHeroInfoCluster({ hero, heroInfo, activeTarget, secondaryAbilities, secondaryAbilitySlots, secondaryAbilityAnchorIndex, editable = true, onAbilityClick, onAbilitySwap }: AbilityHeroInfoClusterProps) {
  const tags = [
    { text: heroInfo.tag1Text, tilt: heroInfo.tag1Tilt, offsetY: heroInfo.tag1OffsetY },
    { text: heroInfo.tag2Text, tilt: heroInfo.tag2Tilt, offsetY: heroInfo.tag2OffsetY },
    { text: heroInfo.tag3Text, tilt: heroInfo.tag3Tilt, offsetY: heroInfo.tag3OffsetY },
  ]

  return (
    <aside className={styles.heroInfoCluster} aria-label={`${hero.displayName} ability editor hero info`}>
      <div className={styles.heroInfoNameRow}>
        {heroInfo.nameType === 'image' ? (
          <span
            className={styles.heroInfoNameImage}
            aria-label={`${hero.displayName} name`}
            role="img"
            style={{
              backgroundColor: heroInfo.nameColor,
              WebkitMaskImage: `url('${heroInfo.nameValue}')`,
              maskImage: `url('${heroInfo.nameValue}')`,
            }}
          />
        ) : (
          <span
            className={styles.heroInfoNameText}
            style={{
              color: heroInfo.nameColor,
              fontSize: heroInfo.nameFontSize || DEFAULT_HERO_NAME_FONT_SIZE,
              fontFamily: heroInfo.nameFontFamily || DEFAULT_HERO_NAME_FONT_FAMILY,
              fontWeight: heroInfo.nameFontWeight || DEFAULT_HERO_NAME_FONT_WEIGHT,
            }}
          >
            {heroInfo.nameValue || hero.displayName}
          </span>
        )}
      </div>

      <div className={styles.heroInfoTags} aria-label="Hero tags">
        {tags.map((tag, index) => (
          <span
            key={`${hero.slug}-focused-tag-${index + 1}`}
            className={styles.heroInfoTag}
            style={{
              transform: `translateY(${tag.offsetY}px) rotate(${tag.tilt}deg)`,
              backgroundColor: heroInfo.tagColor,
              color: heroInfo.tagTextColor,
            }}
          >
            <span>{tag.text}</span>
          </span>
        ))}
      </div>

      <HeroAbilityIconRow
        heroInfo={heroInfo}
        secondaryAbilities={secondaryAbilities}
        secondaryAbilitySlots={secondaryAbilitySlots}
        secondaryAbilityAnchorIndex={secondaryAbilityAnchorIndex}
        activeTarget={activeTarget}
        onAbilityClick={onAbilityClick}
        onAbilitySwap={editable ? onAbilitySwap : undefined}
        className={styles.heroInfoAbilities}
        primaryTestIdPrefix="ability-editor-hero-info-ability"
        secondaryTestIdPrefix="ability-editor-hero-info-secondary-ability"
        primaryLabel={(slot, isActive) => editable ? (isActive ? `Change Ability ${slot} icon` : `Edit Ability ${slot}`) : `View Ability ${slot}`}
        secondaryLabel={(slot, isActive) => editable ? (isActive ? `Change Secondary Ability ${slot} icon` : `Edit Secondary Ability ${slot}`) : `View Secondary Ability ${slot}`}
        editable={editable}
      />
    </aside>
  )
}

function RichTextSection({ section, readOnly = false, onTextChange, onInlineIcon }: RichTextSectionProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const swatchMenuRef = useRef<HTMLDivElement | null>(null)
  const lastTextRef = useRef('')
  const lastSelectionRef = useRef<Range | null>(null)
  const [isSwatchOpen, setIsSwatchOpen] = useState(false)

  useEffect(() => {
    if (!editorRef.current || document.activeElement === editorRef.current || lastTextRef.current === section.text) {
      return
    }

    editorRef.current.innerHTML = tokenTextToHtml(section.text)
    lastTextRef.current = section.text
  }, [section.text])

  useEffect(() => {
    if (!isSwatchOpen) {
      return
    }

    function handleDocumentPointerDown(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && swatchMenuRef.current?.contains(event.target)) {
        return
      }

      setIsSwatchOpen(false)
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true)

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    }
  }, [isSwatchOpen])

  function syncEditorText() {
    if (!editorRef.current) {
      return
    }

    const nextText = editableHtmlToTokenText(editorRef.current)

    lastTextRef.current = nextText
    onTextChange(nextText)
  }

  function isEditorNode(node: Node | null) {
    return Boolean(node && editorRef.current && (node === editorRef.current || editorRef.current.contains(node)))
  }

  function rememberSelection({ allowCollapsed = true }: { allowCollapsed?: boolean } = {}) {
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0 || !isEditorNode(selection.anchorNode) || !isEditorNode(selection.focusNode)) {
      return
    }

    const range = selection.getRangeAt(0)

    if (!allowCollapsed && range.collapsed) {
      return
    }

    lastSelectionRef.current = range.cloneRange()
  }

  function getEditorRange() {
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0 && isEditorNode(selection.anchorNode) && isEditorNode(selection.focusNode)) {
      const range = selection.getRangeAt(0)

      if (range.collapsed && lastSelectionRef.current && !lastSelectionRef.current.collapsed && isEditorNode(lastSelectionRef.current.commonAncestorContainer)) {
        const restoredRange = lastSelectionRef.current.cloneRange()

        selection.removeAllRanges()
        selection.addRange(restoredRange)
        return restoredRange
      }

      lastSelectionRef.current = range.cloneRange()
      return range
    }

    if (!selection || !lastSelectionRef.current || !isEditorNode(lastSelectionRef.current.commonAncestorContainer)) {
      return null
    }

    const restoredRange = lastSelectionRef.current.cloneRange()

    selection.removeAllRanges()
    selection.addRange(restoredRange)
    return restoredRange
  }

  function isSkippableTextNode(node: Node | null) {
    return node?.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').replaceAll(INLINE_ICON_CARET_STOP, '').trim()
  }

  function isInlineIconNode(node: Node | null) {
    return node instanceof HTMLElement && Boolean(node.dataset.inlineIcon || node.dataset.inlineIconMarker)
  }

  function getEdgeInlineIcon(node: Node | null, edge: 'first' | 'last'): HTMLElement | null {
    if (!node) {
      return null
    }

    if (isInlineIconNode(node)) {
      return node as HTMLElement
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return null
    }

    const children = Array.from(node.childNodes)
    const orderedChildren = edge === 'first' ? children : children.reverse()

    for (const child of orderedChildren) {
      if (isSkippableTextNode(child)) {
        continue
      }

      const inlineIcon = getEdgeInlineIcon(child, edge)

      if (inlineIcon) {
        return inlineIcon
      }

      if (child.nodeType === Node.TEXT_NODE) {
        return null
      }
    }

    return null
  }

  function getSiblingInlineIcon(node: Node, direction: 'previous' | 'next') {
    let current: Node | null = node

    while (current && current !== editorRef.current) {
      const sibling = getSignificantSibling(current, direction)
      const inlineIcon = getEdgeInlineIcon(sibling, direction === 'previous' ? 'last' : 'first')

      if (inlineIcon) {
        return inlineIcon
      }

      if (sibling) {
        return null
      }

      current = current.parentNode
    }

    return null
  }

  function isSkippableBoundaryNode(node: Node | null) {
    if (!node) {
      return true
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return isSkippableTextNode(node)
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement

      if (element.tagName === 'BR') {
        return true
      }

      if (!isInlineIconNode(element)) {
        return !element.textContent?.trim() && !element.querySelector('[data-inline-icon], [data-inline-icon-marker]')
      }
    }

    return false
  }

  function getInlineIconNearContainerOffset(container: Node, offset: number, direction: 'previous' | 'next') {
    const children = Array.from(container.childNodes)
    let index = direction === 'previous' ? offset - 1 : offset

    while (index >= 0 && index < children.length) {
      const child = children[index]
      const inlineIcon = getEdgeInlineIcon(child, direction === 'previous' ? 'last' : 'first')

      if (inlineIcon) {
        return inlineIcon
      }

      if (!isSkippableBoundaryNode(child)) {
        return null
      }

      index += direction === 'previous' ? -1 : 1
    }

    return null
  }

  function getBoundaryInlineIcon(range: Range, direction: 'previous' | 'next') {
    const container = direction === 'previous' ? range.startContainer : range.endContainer
    const offset = direction === 'previous' ? range.startOffset : range.endOffset

    if (container.nodeType === Node.TEXT_NODE) {
      const textLength = container.textContent?.length ?? 0

      if (isSkippableTextNode(container)) {
        return getSiblingInlineIcon(container, direction)
      }

      if ((direction === 'previous' && offset > 0) || (direction === 'next' && offset < textLength)) {
        return null
      }

      return getSiblingInlineIcon(container, direction)
    }

    const inlineIcon = getInlineIconNearContainerOffset(container, offset, direction)

    return inlineIcon ?? getSiblingInlineIcon(container, direction)
  }

  function placeCaretNearRemovedNode(parent: Node, offset: number) {
    const selection = window.getSelection()
    const nextRange = document.createRange()

    nextRange.setStart(parent, Math.min(offset, parent.childNodes.length))
    nextRange.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(nextRange)
    lastSelectionRef.current = nextRange.cloneRange()
  }

  function placeCaretAfterInlineIcon(inlineIcon: HTMLElement) {
    const selection = window.getSelection()
    const nextRange = document.createRange()

    nextRange.setStartAfter(inlineIcon)
    nextRange.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(nextRange)
    lastSelectionRef.current = nextRange.cloneRange()
  }

  function getInlineIconFromEventTarget(target: EventTarget | null) {
    return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-inline-icon], [data-inline-icon-marker]') : null
  }

  function handleEditorMouseDown(event: MouseEvent<HTMLDivElement>) {
    const inlineIcon = getInlineIconFromEventTarget(event.target)

    if (!inlineIcon || !editorRef.current?.contains(inlineIcon)) {
      return
    }

    event.preventDefault()
    editorRef.current.focus()
    placeCaretAfterInlineIcon(inlineIcon)
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return
    }

    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0 || !isEditorNode(selection.anchorNode) || !isEditorNode(selection.focusNode)) {
      return
    }

    const range = selection.getRangeAt(0)

    if (!range.collapsed) {
      event.preventDefault()
      range.deleteContents()
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      lastSelectionRef.current = range.cloneRange()
      syncEditorText()
      return
    }

    const inlineIcon = getBoundaryInlineIcon(range, event.key === 'Backspace' ? 'previous' : 'next')

    if (!inlineIcon?.parentNode) {
      return
    }

    event.preventDefault()

    const parent = inlineIcon.parentNode
    const offset = Array.from(parent.childNodes).indexOf(inlineIcon)

    inlineIcon.remove()
    placeCaretNearRemovedNode(parent, offset)
    syncEditorText()
  }

  function handleToolbarMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    rememberSelection({ allowCollapsed: false })
  }

  function applyInlineElement(tagName: 'strong' | 'em' | 'span', attributes: Record<string, string> = {}, className = '', options: { clearColoring?: boolean; toggleEffect?: RichTextEffect } = {}) {
    let range = getEditorRange()
    const selection = window.getSelection()

    if (!range || !selection || range.collapsed) {
      return
    }

    if (editorRef.current && options.clearColoring) {
      range = unwrapColorEffectsFromRange(range, editorRef.current)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    if (editorRef.current && options.toggleEffect && rangeFullyHasEffect(range, editorRef.current, options.toggleEffect)) {
      const nextRange = unwrapEffectFromRange(range, editorRef.current, options.toggleEffect)

      if (nextRange) {
        selection.removeAllRanges()
        selection.addRange(nextRange)
        lastSelectionRef.current = nextRange.cloneRange()
        editorRef.current.focus()
        syncEditorText()
        return
      }
    }

    const wrapper = document.createElement(tagName)

    if (className) {
      wrapper.className = className
    }

    Object.entries(attributes).forEach(([name, value]) => {
      wrapper.setAttribute(name, value)
    })

    const selectedContent = range.extractContents()

    if (options.clearColoring) {
      removeRichTextColoring(selectedContent)
    }

    wrapper.append(selectedContent)
    range.insertNode(wrapper)
    removeAdjacentDuplicateInlineIcons(wrapper)
    const nextRange = document.createRange()
    nextRange.selectNodeContents(wrapper)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    lastSelectionRef.current = nextRange.cloneRange()
    editorRef.current?.focus()
    syncEditorText()
  }

  function clearInlineColoring() {
    let range = getEditorRange()
    const selection = window.getSelection()

    if (!range || !selection || range.collapsed) {
      return
    }

    if (editorRef.current) {
      range = unwrapColorEffectsFromRange(range, editorRef.current)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    const selectedContent = range.extractContents()

    removeRichTextColoring(selectedContent)

    const firstNode = selectedContent.firstChild
    const lastNode = selectedContent.lastChild

    if (!firstNode || !lastNode) {
      syncEditorText()
      return
    }

    range.insertNode(selectedContent)

    if (!firstNode.parentNode || !lastNode.parentNode) {
      syncEditorText()
      return
    }

    const nextRange = document.createRange()

    nextRange.setStartBefore(firstNode)
    nextRange.setEndAfter(lastNode)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    lastSelectionRef.current = nextRange.cloneRange()
    editorRef.current?.focus()
    syncEditorText()
  }

  function handleIconInsert() {
    if (!editorRef.current) {
      return
    }

    const marker = `${section.id}-${Date.now()}`
    const markerElement = document.createElement('span')

    markerElement.className = styles.inlineIconPending
    markerElement.dataset.inlineIconMarker = marker
    markerElement.setAttribute('contenteditable', 'false')

    const selection = window.getSelection()
    const range = getEditorRange()

    if (selection && range) {
      range.collapse(false)
      range.insertNode(markerElement)
      range.setStartAfter(markerElement)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      lastSelectionRef.current = range.cloneRange()
    } else {
      editorRef.current.append(markerElement)
    }

    syncEditorText()
    onInlineIcon(marker)
  }

  return (
    <div className={styles.richTextEditor}>
      {!readOnly ? (
        <div className={styles.richToolbar}>
        <button type="button" aria-label="Bold selected text" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineElement('strong', {}, '', { toggleEffect: { type: 'bold' } })}><Bold aria-hidden="true" /></button>
        <button type="button" aria-label="Italicize selected text" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineElement('em', {}, '', { toggleEffect: { type: 'italic' } })}><Italic aria-hidden="true" /></button>
        <button type="button" aria-label="Darken selected text" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineElement('span', { 'data-rich-dark': 'true' }, styles.darkenText, { toggleEffect: { type: 'dark' } })}><Moon aria-hidden="true" /></button>
        <div className={styles.swatchMenu} ref={swatchMenuRef}>
          <button type="button" aria-label="Open text color swatches" onMouseDown={handleToolbarMouseDown} onClick={() => setIsSwatchOpen(open => !open)}>
            Swatches
          </button>
          {isSwatchOpen ? (
            <div className={styles.swatchPanel}>
              <button
                type="button"
                className={styles.swatchDefault}
                aria-label="Apply Default color"
                onMouseDown={handleToolbarMouseDown}
                onClick={() => {
                  clearInlineColoring()
                  setIsSwatchOpen(false)
                }}
              >
                Default
              </button>
              {RICH_TEXT_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  aria-label={`Apply ${color.label} color`}
                  className={styles[`swatch${color.id.charAt(0).toUpperCase()}${color.id.slice(1)}`]}
                  onMouseDown={handleToolbarMouseDown}
                  onClick={() => {
                    applyInlineElement('span', { 'data-rich-color': color.token }, styles[`richColor${color.token.charAt(0).toUpperCase()}${color.token.slice(1)}`], { clearColoring: true })
                    setIsSwatchOpen(false)
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" onMouseDown={handleToolbarMouseDown} onClick={handleIconInsert}>Inline Icon</button>
        </div>
      ) : null}
      <div
        ref={editorRef}
        className={styles.richEditable}
        contentEditable={!readOnly}
        role="textbox"
        aria-label={`${getRichTextAriaLabel(section)} rich text`}
        data-placeholder="Write ability text..."
        spellCheck
        onKeyDown={readOnly ? undefined : handleEditorKeyDown}
        onMouseDown={readOnly ? undefined : handleEditorMouseDown}
        onMouseUp={readOnly ? undefined : () => rememberSelection()}
        onKeyUp={readOnly ? undefined : () => rememberSelection()}
        onInput={readOnly ? undefined : () => {
          rememberSelection()
          syncEditorText()
        }}
        suppressContentEditableWarning
      />
    </div>
  )
}

interface GridSectionProps {
  section: AbilityGridSection
  readOnly?: boolean
  renderInlineStat: (stat: AbilityStat, label: string, onChange: (stat: AbilityStat) => void, onIconClick: () => void, variant?: 'timing' | 'sub' | 'main' | 'lower') => ReactNode
  onAddMainCell: () => void
  onAddLowerCell: () => void
  onMainCellChange: (index: number, cell: AbilityGridCell) => void
  onLowerCellChange: (index: number, cell: AbilityGridCell) => void
  onMainCellRemove: (index: number) => void
  onLowerCellRemove: (index: number) => void
  onMainIconClick: (index: number) => void
  onLowerIconClick: (index: number) => void
}

function GridSection({ section, readOnly = false, renderInlineStat, onAddMainCell, onAddLowerCell, onMainCellChange, onLowerCellChange, onMainCellRemove, onLowerCellRemove, onMainIconClick, onLowerIconClick }: GridSectionProps) {
  return (
    <div className={styles.gridEditor}>
      {!readOnly ? (
        <div className={styles.gridActions}>
        <button type="button" onClick={onAddMainCell} disabled={section.mainCells.length >= 3}>Add Main Cell</button>
        <button type="button" onClick={onAddLowerCell} disabled={section.lowerCells.length >= MAX_LOWER_GRID_CELLS}>Add Lower Cell</button>
        </div>
      ) : null}
      <div
        className={styles.mainCellGrid}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, section.mainCells.length)}, minmax(0, 1fr))` }}
      >
        {section.mainCells.map((cell, index) => (
          <div key={cell.id} className={styles.mainCell}>
            {readOnly && !getMainCellTitleInputValue(cell) ? (
              <span className={styles.mainCellTitleSpacer} aria-hidden="true" />
            ) : (
              <label className={styles.mainCellTitleLabel}>
                <span className={styles.srOnly}>Main Cell Title</span>
                <input
                  value={getMainCellTitleInputValue(cell)}
                  aria-label={`Main cell ${index + 1} title`}
                  placeholder="Detail"
                  readOnly={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  onChange={readOnly ? undefined : event => onMainCellChange(index, { ...cell, label: event.target.value })}
                />
              </label>
            )}
            {renderInlineStat(cell, cell.label, stat => onMainCellChange(index, { ...cell, ...stat }), () => onMainIconClick(index), 'main')}
            {!readOnly ? (
              <button type="button" className={styles.removeGridCellButton} aria-label={`Remove main cell ${index + 1}`} onClick={() => onMainCellRemove(index)}>
              <X aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {section.lowerCells.length ? (
        <div className={styles.lowerCellGrid} data-testid="lower-cell-grid">
          {section.lowerCells.map((cell, index) => (
            <div key={cell.id} className={styles.lowerCell}>
              {renderInlineStat(cell, cell.label, stat => onLowerCellChange(index, { ...cell, ...stat }), () => onLowerIconClick(index), 'lower')}
              {!readOnly ? (
                <button type="button" className={styles.removeLowerCellButton} aria-label={`Remove lower cell ${index + 1}`} onClick={() => onLowerCellRemove(index)}>
                <X aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
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
  onIconColorChange: (color: string) => void
  onSearch: (search: string) => void
  onSelect: (path: string) => void
  onClose: () => void
}

function IconSearchModal({ groups, statGroups = [], search, selectedIconColor, title = 'Property icon selector', testId = 'property-icon-modal', searchPlaceholder = 'Search property icons', previewMode = 'property', showColorPicker = true, closeLabel = 'Close property icon selector', onIconColorChange, onSearch, onSelect, onClose }: IconSearchModalProps) {
  const isAbilityPicker = previewMode === 'ability'
  const [abilityIconTab, setAbilityIconTab] = useState<'abilities' | 'stats'>('abilities')
  const showsAbilityIcons = isAbilityPicker && abilityIconTab === 'abilities'

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
              ? getWhiteAbilityIconVisualStyle(asset.path)
              : getPropertyIconVisualStyle(asset.path, selectedIconColor || '#ffffff')
        }
      />
      {assetPreviewMode === 'ability' ? null : asset.label}
    </button>
  )

  return (
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
        {isAbilityPicker ? (
          <div className={styles.iconTabs} role="tablist" aria-label="Ability icon categories">
            <button
              type="button"
              id="ability-icon-tab-abilities"
              role="tab"
              aria-controls="ability-icon-tabpanel"
              aria-selected={abilityIconTab === 'abilities'}
              className={cn(abilityIconTab === 'abilities' && styles.iconTabActive)}
              onClick={() => setAbilityIconTab('abilities')}
            >
              Hero abilities
            </button>
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
          aria-labelledby={isAbilityPicker ? `ability-icon-tab-${abilityIconTab}` : undefined}
        >
          {showsAbilityIcons
            ? groups.map(group => (
                <div key={group.id} className={styles.iconAbilityGroup} role="group" aria-label={group.label}>
                  <p className={styles.iconAbilityGroupTitle}>{group.label}</p>
                  {group.assets.slice(0, 4).map(asset => renderIconButton(asset, 'ability'))}
                </div>
              ))
            : (isAbilityPicker ? statGroups : groups).flatMap(group => group.assets).map(asset => renderIconButton(asset, previewMode === 'ability' ? 'property' : previewMode))}
        </div>
      </div>
    </div>
  )
}
