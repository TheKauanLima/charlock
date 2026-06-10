'use client'

import { Bold, Italic, Moon, Plus, Save, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { getNextScaling } from '@/components/panels/scaling-utils'
import ScalingValueEditor from '@/components/panels/scaling-value-editor'
import type {
  AbilityDefinition,
  AbilityGridCell,
  AbilityGridSection,
  AbilityRichTextSection,
  AbilitySection,
  AbilityStat,
} from '@/lib/ability-editor-types'
import type { EditorAssetGroup } from '@/lib/editor-assets'
import cn from '@/lib/utilsd'

import styles from './AbilityEditor.module.css'

interface AbilityEditorProps {
  ability: AbilityDefinition
  propertyIconGroups: EditorAssetGroup[]
  onSave: (ability: AbilityDefinition) => void
  onCancel: () => void
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

const RICH_TEXT_COLORS: Array<{ id: string; label: string; token: string }> = [
  { id: 'spirit', label: 'Spirit', token: 'spirit' },
  { id: 'healing', label: 'Healing', token: 'healing' },
  { id: 'damage', label: 'Damage', token: 'damage' },
  { id: 'warning', label: 'Warning', token: 'warning' },
]

const ICON_COLOR_SWATCHES = [
  { id: 'default', label: 'Default', value: '' },
  { id: 'green', label: 'Green', value: '#2e9860' },
  { id: 'olive', label: 'Olive', value: '#919814' },
  { id: 'violet', label: 'Violet', value: '#594561' },
  { id: 'cream', label: 'Cream', value: '#f5eadb' },
] as const

const INLINE_ICON_CARET_STOP = '\u200B'

type RichTextEffect =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'dark' }
  | { type: 'color'; token: string }

function getIconName(path: string) {
  return (path.split('/').at(-1) ?? path).replace('.svg', '')
}

function isIntrinsicColorPropertyIcon(pathOrName: string) {
  return getIconName(pathOrName).toLowerCase().includes('color')
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

function createStat(id: string, label = 'New Stat'): AbilityGridCell {
  return {
    id,
    label,
    value: '0',
    unit: '',
    append: '',
    icon: '/panorama/images/icons/properties/spirit.svg',
    scaling: 'none',
    scalingValue: '0',
  }
}

function updateStatScaling(stat: AbilityStat): AbilityStat {
  return {
    ...stat,
    scaling: getNextScaling(stat.scaling),
  }
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
  html = html.replace(/\[c:(spirit|healing|damage|warning)\]([\s\S]*?)\[\/c\]/g, (_, color: string, content: string) => `<span class="${styles[`richColor${color.charAt(0).toUpperCase()}${color.slice(1)}`]}" data-rich-color="${color}">${content}</span>`)

  return html.replaceAll('\n', '<br>')
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
    return `${children}\n`
  }

  return children
}

function editableHtmlToTokenText(element: HTMLElement) {
  return Array.from(element.childNodes).map(serializeRichNode).join('').replace(/\n+$/g, '')
}

function removeRichTextColoring(fragment: DocumentFragment) {
  const richColorClasses = RICH_TEXT_COLORS.map(color => styles[`richColor${color.token.charAt(0).toUpperCase()}${color.token.slice(1)}`])

  fragment.querySelectorAll<HTMLElement>('[data-rich-color], [data-rich-dark]').forEach(element => {
    delete element.dataset.richColor
    delete element.dataset.richDark
    element.classList.remove(styles.darkenText, ...richColorClasses)
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

function unwrapEffectFromRange(range: Range, root: HTMLElement, effect: RichTextEffect) {
  const elements = Array.from(new Set(
    getRangeUnits(range, root)
      .map(unit => findRichTextEffectElement(unit, effect, root))
      .filter((element): element is HTMLElement => Boolean(element)),
  ))
  let firstNode: Node | null = null
  let lastNode: Node | null = null

  elements.forEach(element => {
    if (!element.isConnected) {
      return
    }

    const children = unwrapRichTextElement(element)

    if (!children?.length) {
      return
    }

    firstNode ??= children[0]
    lastNode = children.at(-1) ?? lastNode
  })

  if (!firstNode || !lastNode || !firstNode.parentNode || !lastNode.parentNode) {
    return null
  }

  const nextRange = document.createRange()

  nextRange.setStartBefore(firstNode)
  nextRange.setEndAfter(lastNode)

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

function cloneAbility(ability: AbilityDefinition): AbilityDefinition {
  return structuredClone(ability)
}

export default function AbilityEditor({ ability, propertyIconGroups, onSave, onCancel }: AbilityEditorProps) {
  const [draftAbility, setDraftAbility] = useState(() => cloneAbility(ability))
  const [iconTarget, setIconTarget] = useState<IconTarget | null>(null)
  const [iconSearch, setIconSearch] = useState('')
  const [selectedIconColor, setSelectedIconColor] = useState('')
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

  function updateStat(stat: AbilityStat, patch: Partial<AbilityStat>): AbilityStat {
    return {
      ...stat,
      ...patch,
    }
  }

  function updateSubStat(index: number, patch: Partial<AbilityStat>) {
    setDraftAbility(current => ({
      ...current,
      subStats: current.subStats.map((stat, statIndex) => (statIndex === index ? updateStat(stat, patch) : stat)),
    }))
  }

  function removeSubStat(index: number) {
    setDraftAbility(current => ({
      ...current,
      subStats: current.subStats.filter((_, statIndex) => statIndex !== index),
    }))
  }

  function updateSection(sectionId: string, updater: (section: AbilitySection) => AbilitySection) {
    setDraftAbility(current => ({
      ...current,
      sections: current.sections.map(section => (section.id === sectionId ? updater(section) : section)),
    }))
  }

  function removeSection(sectionId: string) {
    setDraftAbility(current => ({
      ...current,
      sections: current.sections.filter(section => section.id !== sectionId),
    }))
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
    })
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
          mainCells: [createStat(`${id}-main-1`, 'Damage')],
          lowerCells: [],
        }

    setDraftAbility(current => ({
      ...current,
      sections: [...current.sections, section],
    }))
  }

  function applyIcon(path: string) {
    if (!iconTarget) {
      return
    }

    const iconColor = isIntrinsicColorPropertyIcon(path) ? '' : selectedIconColor

    if (iconTarget.type === 'abilityIcon') {
      setDraftAbility(current => ({ ...current, icon: path }))
    } else if (iconTarget.type === 'cooldown') {
      setDraftAbility(current => ({ ...current, cooldown: updateStat(current.cooldown, { icon: path, iconColor }) }))
    } else if (iconTarget.type === 'charges') {
      setDraftAbility(current => ({ ...current, charges: updateStat(current.charges, { icon: path, iconColor }) }))
    } else if (iconTarget.type === 'rechargeTime') {
      setDraftAbility(current => ({ ...current, rechargeTime: updateStat(current.rechargeTime, { icon: path, iconColor }) }))
    } else if (iconTarget.type === 'subStat') {
      updateSubStat(iconTarget.index, { icon: path, iconColor })
    } else if (iconTarget.type === 'mainCell') {
      updateGridCell(iconTarget.sectionId, 'mainCells', iconTarget.index, { icon: path, iconColor })
    } else if (iconTarget.type === 'lowerCell') {
      updateGridCell(iconTarget.sectionId, 'lowerCells', iconTarget.index, { icon: path, iconColor })
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
      })
    }

    setIconTarget(null)
    setIconSearch('')
    setSelectedIconColor('')
  }

  function closeIconModal() {
    if (iconTarget?.type === 'inlineIcon') {
      const markerToken = `[[inline-icon-marker:${iconTarget.marker}]]`

      updateSection(iconTarget.sectionId, section => {
        if (section.type !== 'richText') {
          return section
        }

        return {
          ...section,
          text: section.text.replace(markerToken, ''),
        }
      })
    }

    setIconTarget(null)
    setIconSearch('')
    setSelectedIconColor('')
  }

  function shouldIgnoreStatBoxClick(target: EventTarget) {
    return target instanceof HTMLElement && Boolean(target.closest('input, button, textarea, select'))
  }

  function handleStatBoxKeyDown(event: KeyboardEvent<HTMLDivElement>, stat: AbilityStat, onChange: (stat: AbilityStat) => void) {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
      return
    }

    event.preventDefault()
    onChange(updateStatScaling(stat))
  }

  function renderInlineStat(stat: AbilityStat, label: string, onChange: (stat: AbilityStat) => void, onIconClick: () => void, variant: 'timing' | 'sub' | 'main' | 'lower' = 'sub') {
    const showAppend = variant === 'main' || variant === 'lower'
    const showDetail = variant !== 'lower'
    const unitInputStyle = variant === 'main'
      ? { width: `${Math.max(4, (stat.unit ?? '').length + 1)}ch`, visibility: 'visible' as const }
      : variant === 'timing' || variant === 'sub'
        ? { width: stat.unit ? `${Math.max(2, stat.unit.length + 1)}ch` : '0px', visibility: stat.unit ? 'visible' as const : 'hidden' as const }
        : undefined
    const appendInputStyle = showAppend
      ? { width: stat.append ? `${Math.max(1, stat.append.length + 1)}ch` : '1ch' }
      : undefined
    const nextValue = (value: string) => variant === 'main' ? value : value.replace(/[^\d.-]/g, '')

    return (
      <div
        className={cn(styles.inlineStatEditor, styles[`inlineStatEditor${variant.charAt(0).toUpperCase()}${variant.slice(1)}`], stat.scaling !== 'none' && styles.inlineStatEditorScaled)}
        data-scaling={stat.scaling}
        data-testid={`ability-stat-${variant}-${label.toLowerCase().replaceAll(' ', '-')}`}
        role="group"
        tabIndex={0}
        aria-label={`${label} stat. Scaling ${stat.scaling}. Click box to change scaling.`}
        onClick={event => {
          if (!shouldIgnoreStatBoxClick(event.target)) {
            onChange(updateStatScaling(stat))
          }
        }}
        onKeyDown={event => handleStatBoxKeyDown(event, stat, onChange)}
      >
        {variant === 'main' ? (
          <div className={styles.mainRow}>
            <button type="button" className={styles.iconButton} aria-label={`Choose ${label} icon`} onClick={onIconClick}>
              <span
                className={cn(styles.propertyIcon, isIntrinsicColorPropertyIcon(stat.icon) && styles.propertyIconOriginalColor)}
                aria-hidden="true"
                style={getPropertyIconVisualStyle(stat.icon, stat.iconColor)}
              />
            </button>
            <label className={styles.valueInputLabel}>
              <span className={styles.srOnly}>Value</span>
              <input
                className={styles.valueInput}
                style={{ width: `${Math.max(1, String(stat.value).length)}ch` }}
                value={stat.value}
                onChange={event => onChange(updateStat(stat, { value: nextValue(event.target.value) }))}
              />
            </label>
            {showAppend ? (
              <label className={styles.appendInputLabel}>
                <span className={styles.srOnly}>Append</span>
                <input
                  className={styles.appendInput}
                  style={appendInputStyle}
                  placeholder="+"
                  value={stat.append ?? ''}
                  onChange={event => onChange(updateStat(stat, { append: event.target.value }))}
                />
              </label>
            ) : null}
          </div>
        ) : (
          <>
            <button type="button" className={styles.iconButton} aria-label={`Choose ${label} icon`} onClick={onIconClick}>
              <span
                className={cn(styles.propertyIcon, isIntrinsicColorPropertyIcon(stat.icon) && styles.propertyIconOriginalColor)}
                aria-hidden="true"
                style={getPropertyIconVisualStyle(stat.icon, stat.iconColor)}
              />
            </button>
            <label className={styles.valueInputLabel}>
              <span className={styles.srOnly}>Value</span>
              <input
                className={styles.valueInput}
                style={variant === 'timing' || variant === 'sub' || variant === 'lower' ? { width: `${Math.max(1, String(stat.value).length)}ch` } : undefined}
                value={stat.value}
                onChange={event => onChange(updateStat(stat, { value: nextValue(event.target.value) }))}
              />
            </label>
            {showAppend ? (
              <label className={styles.appendInputLabel}>
                <span className={styles.srOnly}>Append</span>
                <input
                  className={styles.appendInput}
                  style={appendInputStyle}
                  placeholder="+"
                  value={stat.append ?? ''}
                  onChange={event => onChange(updateStat(stat, { append: event.target.value }))}
                />
              </label>
            ) : null}
          </>
        )}
        {showDetail ? (
          <label className={styles.unitInputLabel}>
          <span className={styles.srOnly}>{variant === 'main' ? 'Detail' : 'Unit'}</span>
          <input
            className={styles.unitInput}
            style={unitInputStyle}
            placeholder={variant === 'main' ? 'Detail' : undefined}
            value={stat.unit ?? ''}
            onChange={event => onChange(updateStat(stat, { unit: event.target.value }))}
          />
          </label>
        ) : null}
        {variant !== 'timing' && variant !== 'sub' && variant !== 'main' ? (
          <label className={styles.statLabelInputLabel}>
            <span className={styles.srOnly}>Detail</span>
            <input
              className={styles.statLabelInput}
              style={variant === 'sub' ? { width: `${Math.max(4, stat.label.length)}ch` } : undefined}
              value={stat.label}
              aria-label="Detail"
              onChange={event => onChange(updateStat(stat, { label: event.target.value }))}
            />
          </label>
        ) : null}
        <span className={styles.scalingValueWrap}>
          <ScalingValueEditor scaling={stat.scaling} scalingValue={stat.scalingValue} isEditable onChange={scalingValue => onChange(updateStat(stat, { scalingValue }))} />
        </span>
      </div>
    )
  }

  return (
    <section className={styles.focusShell} data-testid="ability-editor" aria-label={`Ability editor for ${draftAbility.name}`}>
      <div className={styles.focusBackdrop} />
      <div className={styles.editorLayout}>
        <aside className={styles.sideTabs} aria-label="Append ability sections">
          <button type="button" aria-label="Add sub-header stat" onClick={() => setDraftAbility(current => ({ ...current, subStats: [...current.subStats, createStat(`ability-${current.slot}-sub-${Date.now()}`, 'Stat')] }))}>
            <Plus aria-hidden="true" />
          </button>
          <button type="button" onClick={() => addSection('richText')}>Text</button>
          <button type="button" onClick={() => addSection('grid')}>Grid</button>
        </aside>

        <div className={styles.tooltipSurface}>
          <div className={styles.tooltipTexture} />
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <button type="button" className={styles.abilityIconButton} aria-label="Choose ability icon" onClick={() => setIconTarget({ type: 'abilityIcon' })}>
                <span aria-hidden="true" style={{ WebkitMaskImage: `url('${draftAbility.icon}')`, maskImage: `url('${draftAbility.icon}')` }} />
              </button>
              <label className={styles.nameInputWrap}>
                <span className={styles.srOnly}>Ability Name</span>
                <input value={draftAbility.name} onChange={event => setDraftAbility(current => ({ ...current, name: event.target.value }))} />
              </label>
            </div>

            <div className={styles.timingPanel}>
              <label className={styles.chargeToggle}>
                <input type="checkbox" checked={draftAbility.hasCharges} onChange={event => setDraftAbility(current => ({ ...current, hasCharges: event.target.checked }))} />
                Charges
              </label>
              {draftAbility.hasCharges ? (
                <div className={styles.chargeGrid}>
                  {renderInlineStat(draftAbility.charges, 'Charges', charges => setDraftAbility(current => ({ ...current, charges })), () => setIconTarget({ type: 'charges' }), 'timing')}
                  {renderInlineStat(draftAbility.rechargeTime, 'Recharge Time', rechargeTime => setDraftAbility(current => ({ ...current, rechargeTime })), () => setIconTarget({ type: 'rechargeTime' }), 'timing')}
                </div>
              ) : null}
              {renderInlineStat(draftAbility.cooldown, 'Cooldown', cooldown => setDraftAbility(current => ({ ...current, cooldown })), () => setIconTarget({ type: 'cooldown' }), 'timing')}
            </div>
          </header>

          <section className={styles.subStats} aria-label="Sub-header stats">
            {draftAbility.subStats.map((stat, index) => (
              <div key={`${stat.label}-${index}`} className={styles.subStat}>
                <button type="button" className={styles.removeStatButton} aria-label={`Remove ${stat.label}`} onClick={() => removeSubStat(index)}>
                  <X aria-hidden="true" />
                </button>
                {renderInlineStat(stat, stat.label, nextStat => updateSubStat(index, nextStat), () => setIconTarget({ type: 'subStat', index }), 'sub')}
              </div>
            ))}
          </section>

          <section className={styles.sections} aria-label="Ability sections">
            {draftAbility.sections.map(section => (
              <article key={section.id} className={styles.section}>
                <button type="button" className={styles.removeSectionButton} aria-label={`Remove ${section.title} section`} onClick={() => removeSection(section.id)}>
                  <X aria-hidden="true" />
                </button>

                {section.type === 'richText' ? (
                  <>
                    <label className={styles.sectionTitleLabel}>
                      <span className={styles.srOnly}>Section Title</span>
                      <input value={section.title} onChange={event => updateSection(section.id, current => ({ ...current, title: event.target.value }))} />
                    </label>
                    <RichTextSection section={section} onTextChange={text => updateSection(section.id, current => ({ ...current, text }))} onInlineIcon={marker => setIconTarget({ type: 'inlineIcon', sectionId: section.id, marker })} />
                  </>
                ) : (
                  <GridSection
                    section={section}
                    renderInlineStat={renderInlineStat}
                    onAddMainCell={() => updateSection(section.id, current => current.type === 'grid' ? { ...current, mainCells: [...current.mainCells, createStat(`${section.id}-main-${current.mainCells.length + 1}`, 'Value')].slice(0, 3) } : current)}
                    onAddLowerCell={() => updateSection(section.id, current => current.type === 'grid' ? { ...current, lowerCells: [...current.lowerCells, createStat(`${section.id}-lower-${current.lowerCells.length + 1}`, 'Detail')] } : current)}
                    onMainCellChange={(index, cell) => updateGridCell(section.id, 'mainCells', index, cell)}
                    onLowerCellChange={(index, cell) => updateGridCell(section.id, 'lowerCells', index, cell)}
                    onMainCellRemove={index => updateSection(section.id, current => current.type === 'grid' ? { ...current, mainCells: current.mainCells.filter((_, cellIndex) => cellIndex !== index) } : current)}
                    onLowerCellRemove={index => updateSection(section.id, current => current.type === 'grid' ? { ...current, lowerCells: current.lowerCells.filter((_, cellIndex) => cellIndex !== index) } : current)}
                    onMainIconClick={index => setIconTarget({ type: 'mainCell', sectionId: section.id, index })}
                    onLowerIconClick={index => setIconTarget({ type: 'lowerCell', sectionId: section.id, index })}
                  />
                )}
              </article>
            ))}
          </section>
        </div>

        <aside className={styles.returnPanel}>
          <p>Focused Ability Editor</p>
          <h2>{draftAbility.name}</h2>
          <button type="button" className={styles.saveReturnButton} onClick={() => onSave(draftAbility)}>
            <Save aria-hidden="true" />
            Save & Return
          </button>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            <X aria-hidden="true" />
            Cancel
          </button>
        </aside>
      </div>

      {iconTarget ? (
        <IconSearchModal
          groups={filteredIconGroups}
          search={iconSearch}
          selectedIconColor={selectedIconColor}
          onIconColorChange={setSelectedIconColor}
          onSearch={setIconSearch}
          onSelect={applyIcon}
          onClose={closeIconModal}
        />
      ) : null}
    </section>
  )
}

interface RichTextSectionProps {
  section: AbilityRichTextSection
  onTextChange: (text: string) => void
  onInlineIcon: (marker: string) => void
}

function RichTextSection({ section, onTextChange, onInlineIcon }: RichTextSectionProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
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

  function isInlineIconNode(node: Node | null): node is HTMLElement {
    return node instanceof HTMLElement && Boolean(node.dataset.inlineIcon || node.dataset.inlineIconMarker)
  }

  function getEdgeInlineIcon(node: Node | null, edge: 'first' | 'last'): HTMLElement | null {
    if (!node) {
      return null
    }

    if (isInlineIconNode(node)) {
      return node
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

    if (node instanceof HTMLBRElement) {
      return true
    }

    if (node instanceof HTMLElement && !isInlineIconNode(node)) {
      return !node.textContent?.trim() && !node.querySelector('[data-inline-icon], [data-inline-icon-marker]')
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
    const range = getEditorRange()
    const selection = window.getSelection()

    if (!range || !selection || range.collapsed) {
      return
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
      <div className={styles.richToolbar}>
        <button type="button" aria-label="Bold selected text" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineElement('strong', {}, '', { toggleEffect: { type: 'bold' } })}><Bold aria-hidden="true" /></button>
        <button type="button" aria-label="Italicize selected text" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineElement('em', {}, '', { toggleEffect: { type: 'italic' } })}><Italic aria-hidden="true" /></button>
        <button type="button" aria-label="Darken selected text" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineElement('span', { 'data-rich-dark': 'true' }, styles.darkenText, { toggleEffect: { type: 'dark' } })}><Moon aria-hidden="true" /></button>
        <div className={styles.swatchMenu}>
          <button type="button" aria-label="Open text color swatches" onMouseDown={handleToolbarMouseDown} onClick={() => setIsSwatchOpen(open => !open)}>
            Swatches
          </button>
          {isSwatchOpen ? (
            <div className={styles.swatchPanel}>
              {RICH_TEXT_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  aria-label={`Apply ${color.label} color`}
                  className={styles[`swatch${color.id.charAt(0).toUpperCase()}${color.id.slice(1)}`]}
                  onMouseDown={handleToolbarMouseDown}
                  onClick={() => {
                    applyInlineElement('span', { 'data-rich-color': color.token }, styles[`richColor${color.token.charAt(0).toUpperCase()}${color.token.slice(1)}`], { clearColoring: true, toggleEffect: { type: 'color', token: color.token } })
                    setIsSwatchOpen(false)
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" onMouseDown={handleToolbarMouseDown} onClick={handleIconInsert}>Inline Icon</button>
      </div>
      <div
        ref={editorRef}
        className={styles.richEditable}
        contentEditable
        role="textbox"
        aria-label={`${section.title} rich text`}
        spellCheck
        onKeyDown={handleEditorKeyDown}
        onMouseDown={handleEditorMouseDown}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onInput={() => {
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

function GridSection({ section, renderInlineStat, onAddMainCell, onAddLowerCell, onMainCellChange, onLowerCellChange, onMainCellRemove, onLowerCellRemove, onMainIconClick, onLowerIconClick }: GridSectionProps) {
  return (
    <div className={styles.gridEditor}>
      <div className={styles.gridActions}>
        <button type="button" onClick={onAddMainCell} disabled={section.mainCells.length >= 3}>Add Main Cell</button>
        <button type="button" onClick={onAddLowerCell}>Add Lower Cell</button>
      </div>
      <div
        className={styles.mainCellGrid}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, section.mainCells.length)}, minmax(min-content, 1fr))` }}
      >
        {section.mainCells.map((cell, index) => (
          <div key={cell.id} className={styles.mainCell}>
            <label className={styles.mainCellTitleLabel}>
              <span className={styles.srOnly}>Main Cell Title</span>
              <input
                value={cell.label}
                aria-label={`Main cell ${index + 1} title`}
                onChange={event => onMainCellChange(index, { ...cell, label: event.target.value })}
              />
            </label>
            {renderInlineStat(cell, cell.label, stat => onMainCellChange(index, { ...cell, ...stat }), () => onMainIconClick(index), 'main')}
            <button type="button" className={styles.removeGridCellButton} aria-label={`Remove main cell ${index + 1}`} onClick={() => onMainCellRemove(index)}>
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      {section.lowerCells.length ? (
        <div className={styles.lowerCellGrid} data-testid="lower-cell-grid">
          {section.lowerCells.map((cell, index) => (
            <div key={cell.id} className={styles.lowerCell}>
              {renderInlineStat(cell, cell.label, stat => onLowerCellChange(index, { ...cell, ...stat }), () => onLowerIconClick(index), 'lower')}
              <button type="button" className={styles.removeLowerCellButton} aria-label={`Remove lower cell ${index + 1}`} onClick={() => onLowerCellRemove(index)}>
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface IconSearchModalProps {
  groups: EditorAssetGroup[]
  search: string
  selectedIconColor: string
  onIconColorChange: (color: string) => void
  onSearch: (search: string) => void
  onSelect: (path: string) => void
  onClose: () => void
}

function IconSearchModal({ groups, search, selectedIconColor, onIconColorChange, onSearch, onSelect, onClose }: IconSearchModalProps) {
  return (
    <div className={styles.iconBackdrop} role="dialog" aria-modal="true" aria-label="Property icon selector" data-testid="property-icon-modal">
      <div className={styles.iconModal}>
        <div className={styles.iconHeader}>
          <label>
            <Search aria-hidden="true" />
            <input value={search} onChange={event => onSearch(event.target.value)} placeholder="Search property icons" />
          </label>
          <button type="button" aria-label="Close property icon selector" onClick={onClose}><X aria-hidden="true" /></button>
        </div>
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
        <div className={styles.iconGrid}>
          {groups.flatMap(group => group.assets).map(asset => (
            <button key={asset.path} type="button" aria-label={`Use ${asset.label}`} onClick={() => onSelect(asset.path)}>
              <span
                className={cn(styles.iconPreview, isIntrinsicColorPropertyIcon(asset.path) && styles.iconPreviewOriginalColor)}
                aria-hidden="true"
                style={getPropertyIconVisualStyle(asset.path, selectedIconColor)}
              />
              {asset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
