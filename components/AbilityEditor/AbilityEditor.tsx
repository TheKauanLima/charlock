'use client'

import { Bold, Italic, Moon, Plus, Save, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import {
  SCALING_ICONS,
  SCALING_VALUE_COLORS,
  getNextScaling,
} from '@/components/panels/scaling-utils'
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
  | { type: 'inlineIcon'; sectionId: string }

const RICH_TEXT_COLORS: Array<{ id: string; label: string; token: string }> = [
  { id: 'spirit', label: 'Spirit', token: 'spirit' },
  { id: 'healing', label: 'Healing', token: 'healing' },
  { id: 'damage', label: 'Damage', token: 'damage' },
  { id: 'warning', label: 'Warning', token: 'warning' },
]

function getIconName(path: string) {
  return (path.split('/').at(-1) ?? path).replace('.svg', '')
}

function createStat(id: string, label = 'New Stat'): AbilityGridCell {
  return {
    id,
    label,
    value: '0',
    unit: '',
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

function getScalingStyle(stat: AbilityStat): CSSProperties {
  if (stat.scaling === 'none') {
    return {}
  }

  const color = SCALING_VALUE_COLORS[stat.scaling]

  return {
    color: color.fill,
    textShadow: `0 0 0 ${color.border}`,
  }
}

function renderRichText(text: string) {
  const tokenPattern = /(\[i:[^\]]+\]|\[b\][\s\S]*?\[\/b\]|\[i\][\s\S]*?\[\/i\]|\[dark\][\s\S]*?\[\/dark\]|\[c:(?:spirit|healing|damage|warning)\][\s\S]*?\[\/c\])/g
  const parts = text.split(tokenPattern).filter(part => part !== undefined && part !== '')

  return parts.map((part, index) => {
    if (part.startsWith('[i:')) {
      const iconName = part.slice(3, -1)

      return <span key={`${part}-${index}`} className={styles.inlineIcon} style={{ WebkitMaskImage: `url('/panorama/images/icons/properties/${iconName}.svg')`, maskImage: `url('/panorama/images/icons/properties/${iconName}.svg')` }} />
    }

    if (part.startsWith('[b]')) {
      return <strong key={`${part}-${index}`}>{part.replace(/^\[b\]|\[\/b\]$/g, '')}</strong>
    }

    if (part.startsWith('[i]')) {
      return <em key={`${part}-${index}`}>{part.replace(/^\[i\]|\[\/i\]$/g, '')}</em>
    }

    if (part.startsWith('[dark]')) {
      return <span key={`${part}-${index}`} className={styles.darkenText}>{part.replace(/^\[dark\]|\[\/dark\]$/g, '')}</span>
    }

    const colorMatch = part.match(/^\[c:(spirit|healing|damage|warning)\]([\s\S]*?)\[\/c\]$/)

    if (colorMatch) {
      return <span key={`${part}-${index}`} className={styles[`richColor${colorMatch[1].charAt(0).toUpperCase()}${colorMatch[1].slice(1)}`]}>{colorMatch[2]}</span>
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function statWithIcon(stat: AbilityStat) {
  return (
    <>
      <span className={styles.propertyIcon} aria-hidden="true" style={{ WebkitMaskImage: `url('${stat.icon}')`, maskImage: `url('${stat.icon}')` }} />
      <strong style={getScalingStyle(stat)}>{stat.value}{stat.unit}</strong>
    </>
  )
}

function cloneAbility(ability: AbilityDefinition): AbilityDefinition {
  return structuredClone(ability)
}

export default function AbilityEditor({ ability, propertyIconGroups, onSave, onCancel }: AbilityEditorProps) {
  const [draftAbility, setDraftAbility] = useState(() => cloneAbility(ability))
  const [iconTarget, setIconTarget] = useState<IconTarget | null>(null)
  const [iconSearch, setIconSearch] = useState('')
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

  function updateSection(sectionId: string, updater: (section: AbilitySection) => AbilitySection) {
    setDraftAbility(current => ({
      ...current,
      sections: current.sections.map(section => (section.id === sectionId ? updater(section) : section)),
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

  function appendRichToken(sectionId: string, token: string) {
    updateSection(sectionId, section => {
      if (section.type !== 'richText') {
        return section
      }

      return {
        ...section,
        text: `${section.text}${section.text ? ' ' : ''}${token}`,
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
          text: 'New [b]ability[/b] detail.',
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

    if (iconTarget.type === 'abilityIcon') {
      setDraftAbility(current => ({ ...current, icon: path }))
    } else if (iconTarget.type === 'cooldown') {
      setDraftAbility(current => ({ ...current, cooldown: updateStat(current.cooldown, { icon: path }) }))
    } else if (iconTarget.type === 'charges') {
      setDraftAbility(current => ({ ...current, charges: updateStat(current.charges, { icon: path }) }))
    } else if (iconTarget.type === 'rechargeTime') {
      setDraftAbility(current => ({ ...current, rechargeTime: updateStat(current.rechargeTime, { icon: path }) }))
    } else if (iconTarget.type === 'subStat') {
      updateSubStat(iconTarget.index, { icon: path })
    } else if (iconTarget.type === 'mainCell') {
      updateGridCell(iconTarget.sectionId, 'mainCells', iconTarget.index, { icon: path })
    } else if (iconTarget.type === 'lowerCell') {
      updateGridCell(iconTarget.sectionId, 'lowerCells', iconTarget.index, { icon: path })
    } else {
      appendRichToken(iconTarget.sectionId, `[i:${getIconName(path)}]`)
    }

    setIconTarget(null)
    setIconSearch('')
  }

  function renderScalingButton(stat: AbilityStat, onChange: (stat: AbilityStat) => void) {
    const icon = SCALING_ICONS[stat.scaling]

    return (
      <button
        type="button"
        className={cn(styles.scalingButton, stat.scaling !== 'none' && styles.scalingButtonActive)}
        data-scaling={stat.scaling}
        onClick={() => onChange(updateStatScaling(stat))}
      >
        {icon ? <span aria-hidden="true" style={{ backgroundImage: `url('${icon}')` }} /> : null}
        {stat.scaling}
      </button>
    )
  }

  function renderStatEditor(stat: AbilityStat, label: string, onChange: (stat: AbilityStat) => void, onIconClick: () => void) {
    return (
      <div className={styles.statEditor}>
        <button type="button" className={styles.iconButton} aria-label={`Choose ${label} icon`} onClick={onIconClick}>
          <span className={styles.propertyIcon} aria-hidden="true" style={{ WebkitMaskImage: `url('${stat.icon}')`, maskImage: `url('${stat.icon}')` }} />
        </button>
        <label>
          Label
          <input value={stat.label} onChange={event => onChange(updateStat(stat, { label: event.target.value }))} />
        </label>
        <label>
          Value
          <input value={stat.value} onChange={event => onChange(updateStat(stat, { value: event.target.value.replace(/[^\d.-]/g, '') }))} />
        </label>
        <label>
          Unit
          <input value={stat.unit ?? ''} onChange={event => onChange(updateStat(stat, { unit: event.target.value }))} />
        </label>
        {renderScalingButton(stat, onChange)}
        {stat.scaling !== 'none' ? (
          <label>
            Scale
            <input value={stat.scalingValue} onChange={event => onChange(updateStat(stat, { scalingValue: event.target.value.replace(/[^\d.-]/g, '') }))} />
          </label>
        ) : null}
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
              <label>
                Ability Name
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
                  <div>{statWithIcon(draftAbility.charges)}<span>Charges</span></div>
                  <div>{statWithIcon(draftAbility.rechargeTime)}<span>Recharge Time</span></div>
                </div>
              ) : null}
              <div className={styles.cooldownBox}>
                {statWithIcon(draftAbility.cooldown)}
                <span>Cooldown</span>
              </div>
            </div>
          </header>

          <div className={styles.coreEditors}>
            {renderStatEditor(draftAbility.cooldown, 'Cooldown', cooldown => setDraftAbility(current => ({ ...current, cooldown })), () => setIconTarget({ type: 'cooldown' }))}
            {draftAbility.hasCharges ? (
              <>
                {renderStatEditor(draftAbility.charges, 'Charges', charges => setDraftAbility(current => ({ ...current, charges })), () => setIconTarget({ type: 'charges' }))}
                {renderStatEditor(draftAbility.rechargeTime, 'Recharge Time', rechargeTime => setDraftAbility(current => ({ ...current, rechargeTime })), () => setIconTarget({ type: 'rechargeTime' }))}
              </>
            ) : null}
          </div>

          <section className={styles.subStats} aria-label="Sub-header stats">
            {draftAbility.subStats.map((stat, index) => (
              <div key={`${stat.label}-${index}`} className={styles.subStat}>
                {statWithIcon(stat)}
                <span>{stat.label}</span>
                {renderStatEditor(stat, stat.label, nextStat => updateSubStat(index, nextStat), () => setIconTarget({ type: 'subStat', index }))}
              </div>
            ))}
          </section>

          <section className={styles.sections} aria-label="Ability sections">
            {draftAbility.sections.map(section => (
              <article key={section.id} className={styles.section}>
                <label className={styles.sectionTitleLabel}>
                  Section Title
                  <input value={section.title} onChange={event => updateSection(section.id, current => ({ ...current, title: event.target.value }))} />
                </label>

                {section.type === 'richText' ? (
                  <RichTextSection section={section} onTextChange={text => updateSection(section.id, current => ({ ...current, text }))} onAppendToken={token => appendRichToken(section.id, token)} onInlineIcon={() => setIconTarget({ type: 'inlineIcon', sectionId: section.id })} />
                ) : (
                  <GridSection
                    section={section}
                    renderStatEditor={renderStatEditor}
                    onAddMainCell={() => updateSection(section.id, current => current.type === 'grid' ? { ...current, mainCells: [...current.mainCells, createStat(`${section.id}-main-${current.mainCells.length + 1}`, 'Value')].slice(0, 3) } : current)}
                    onAddLowerCell={() => updateSection(section.id, current => current.type === 'grid' ? { ...current, lowerCells: [...current.lowerCells, createStat(`${section.id}-lower-${current.lowerCells.length + 1}`, 'Detail')] } : current)}
                    onMainCellChange={(index, cell) => updateGridCell(section.id, 'mainCells', index, cell)}
                    onLowerCellChange={(index, cell) => updateGridCell(section.id, 'lowerCells', index, cell)}
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
        <IconSearchModal groups={filteredIconGroups} search={iconSearch} onSearch={setIconSearch} onSelect={applyIcon} onClose={() => setIconTarget(null)} />
      ) : null}
    </section>
  )
}

interface RichTextSectionProps {
  section: AbilityRichTextSection
  onTextChange: (text: string) => void
  onAppendToken: (token: string) => void
  onInlineIcon: () => void
}

function RichTextSection({ section, onTextChange, onAppendToken, onInlineIcon }: RichTextSectionProps) {
  return (
    <div className={styles.richTextEditor}>
      <div className={styles.richToolbar}>
        <button type="button" aria-label="Insert bold text" onClick={() => onAppendToken('[b]Bold text[/b]')}><Bold aria-hidden="true" /></button>
        <button type="button" aria-label="Insert italic text" onClick={() => onAppendToken('[i]Italic text[/i]')}><Italic aria-hidden="true" /></button>
        <button type="button" aria-label="Insert darkened text" onClick={() => onAppendToken('[dark]Darkened text[/dark]')}><Moon aria-hidden="true" /></button>
        {RICH_TEXT_COLORS.map(color => (
          <button key={color.id} type="button" onClick={() => onAppendToken(`[c:${color.token}]${color.label} text[/c]`)}>
            {color.label}
          </button>
        ))}
        <button type="button" onClick={onInlineIcon}>Inline Icon</button>
      </div>
      <textarea value={section.text} onChange={event => onTextChange(event.target.value)} rows={5} />
      <div className={styles.richPreview}>
        {renderRichText(section.text)}
      </div>
    </div>
  )
}

interface GridSectionProps {
  section: AbilityGridSection
  renderStatEditor: (stat: AbilityStat, label: string, onChange: (stat: AbilityStat) => void, onIconClick: () => void) => ReactNode
  onAddMainCell: () => void
  onAddLowerCell: () => void
  onMainCellChange: (index: number, cell: AbilityGridCell) => void
  onLowerCellChange: (index: number, cell: AbilityGridCell) => void
  onMainIconClick: (index: number) => void
  onLowerIconClick: (index: number) => void
}

function GridSection({ section, renderStatEditor, onAddMainCell, onAddLowerCell, onMainCellChange, onLowerCellChange, onMainIconClick, onLowerIconClick }: GridSectionProps) {
  return (
    <div className={styles.gridEditor}>
      <div className={styles.gridActions}>
        <button type="button" onClick={onAddMainCell} disabled={section.mainCells.length >= 3}>Add Main Cell</button>
        <button type="button" onClick={onAddLowerCell}>Add Lower Cell</button>
      </div>
      <div className={styles.mainCellGrid}>
        {section.mainCells.map((cell, index) => (
          <div key={cell.id} className={styles.mainCell}>
            <div>{statWithIcon(cell)}</div>
            <span>{cell.label}</span>
            {renderStatEditor(cell, cell.label, stat => onMainCellChange(index, { ...cell, ...stat }), () => onMainIconClick(index))}
          </div>
        ))}
      </div>
      {section.lowerCells.length ? (
        <div className={styles.lowerCellGrid}>
          {section.lowerCells.map((cell, index) => (
            <div key={cell.id} className={styles.lowerCell}>
              {statWithIcon(cell)}
              <span>{cell.label}</span>
              {renderStatEditor(cell, cell.label, stat => onLowerCellChange(index, { ...cell, ...stat }), () => onLowerIconClick(index))}
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
  onSearch: (search: string) => void
  onSelect: (path: string) => void
  onClose: () => void
}

function IconSearchModal({ groups, search, onSearch, onSelect, onClose }: IconSearchModalProps) {
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
        <div className={styles.iconGrid}>
          {groups.flatMap(group => group.assets).map(asset => (
            <button key={asset.path} type="button" aria-label={`Use ${asset.label}`} onClick={() => onSelect(asset.path)}>
              <span aria-hidden="true" style={{ WebkitMaskImage: `url('${asset.path}')`, maskImage: `url('${asset.path}')` }} />
              {asset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
