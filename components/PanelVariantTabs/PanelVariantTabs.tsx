'use client'

import { useState } from 'react'

import styles from './PanelVariantTabs.module.css'

export interface PanelVariantTab {
  id: string
  name: string
}

interface PanelVariantTabsProps {
  baseName: string
  baseTabName?: string
  variants?: PanelVariantTab[]
  activeId: string
  canAdd?: boolean
  canRename?: boolean
  canRemove?: boolean
  onSelect: (id: string) => void
  onAdd?: (name: string) => void
  onRename?: (id: string, name: string) => void
  onRemove?: (id: string) => void
}

export const BASE_PANEL_ID = 'base'

export default function PanelVariantTabs({ baseName, baseTabName = baseName, variants = [], activeId, canAdd = false, canRename = false, canRemove = false, onSelect, onAdd, onRename, onRemove }: PanelVariantTabsProps) {
  const [namingMode, setNamingMode] = useState<'add' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const canSubmit = Boolean(name.trim()) && (namingMode === 'rename' || variants.length < 8)
  const activeName = activeId === BASE_PANEL_ID
    ? baseTabName
    : variants.find(variant => variant.id === activeId)?.name ?? baseName

  function addPanel() {
    if (!canSubmit || !onAdd) return

    onAdd(name.trim())
    setName('')
    setNamingMode(null)
  }

  function renamePanel() {
    if (!canSubmit || !onRename) return

    onRename(activeId, name.trim())
    setName('')
    setNamingMode(null)
  }

  return (
    <div className={styles.shell} data-panel-kind={baseName.toLowerCase()}>
      <div className={styles.tabs} role="tablist" aria-label={`${baseName} panel variants`}>
        <button type="button" role="tab" aria-selected={activeId === BASE_PANEL_ID} className={styles.tab} onClick={() => onSelect(BASE_PANEL_ID)}>
          {baseTabName}
        </button>
        {variants.map(variant => {
          const isActive = activeId === variant.id
          const isRemovable = canRemove && isActive

          return (
            <span key={variant.id} className={styles.tabShell} role="presentation">
              <button type="button" role="tab" aria-selected={isActive} className={`${styles.tab} ${isRemovable ? styles.removableTab : ''}`} onClick={() => onSelect(variant.id)}>
                {variant.name}
              </button>
              {isRemovable ? (
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Remove active ${baseName} panel`}
                  onClick={() => {
                    setNamingMode(null)
                    onRemove?.(variant.id)
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </span>
          )
        })}
        {canAdd && variants.length < 8 ? (
          <button type="button" className={styles.addButton} aria-label={`Add ${baseName} panel`} onClick={() => { setName(''); setNamingMode('add') }}>
            + Panel
          </button>
        ) : null}
        {canRename ? (
          <button type="button" className={styles.renameButton} aria-label={`Rename active ${baseName} panel`} onClick={() => { setName(activeName); setNamingMode('rename') }}>
            Rename
          </button>
        ) : null}
      </div>
      {namingMode ? (
        <div className={styles.namingRow}>
          <input
            autoFocus
            value={name}
            maxLength={80}
            aria-label={namingMode === 'add' ? `New ${baseName} panel name` : `Rename ${baseName} panel`}
            placeholder="Panel name"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                if (namingMode === 'add') addPanel()
                else renamePanel()
              }
              if (event.key === 'Escape') setNamingMode(null)
            }}
          />
          <button type="button" disabled={!canSubmit} onClick={namingMode === 'add' ? addPanel : renamePanel}>{namingMode === 'add' ? 'Add' : 'Save Name'}</button>
          <button type="button" onClick={() => setNamingMode(null)}>Cancel</button>
        </div>
      ) : null}
    </div>
  )
}
