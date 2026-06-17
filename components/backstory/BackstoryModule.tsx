'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { Plus } from 'lucide-react'

import type { HeroDefinition } from '@/lib/hero-data'

import styles from './BackstoryModule.module.css'

interface BackstoryModuleProps {
  hero: HeroDefinition
  isEditable?: boolean
  onCreateFromHero?: () => void
  onBackstoryChange?: (value: string) => void
}

type BackstoryStyle = CSSProperties & {
  '--backstory-accent': string
}

const BOOK_ICON_PATH = '/panorama/images/icons/icon_book.svg'
const FALLBACK_BACKSTORY = 'No character backstory has been added yet.'

export default function BackstoryModule({ hero, isEditable = false, onCreateFromHero, onBackstoryChange }: BackstoryModuleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = `backstory-title-${hero.slug}`
  const bodyId = `backstory-body-${hero.slug}`
  const backstoryTooltipId = `backstory-tooltip-${hero.slug}`
  const createTooltipId = `copy-hero-tooltip-${hero.slug}`
  const editableBackstory = hero.heroInfo.backstory ?? ''
  const backstory = isEditable ? editableBackstory : hero.heroInfo.backstory?.trim() || FALLBACK_BACKSTORY
  const rowCount = Math.min(20, Math.max(5, editableBackstory.split(/\r\n|\r|\n/).length + 2))
  const accentColor = hero.heroInfo.abilityCircleColor || hero.heroInfo.tagColor

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    if (isEditable) {
      textareaRef.current?.focus()
    } else {
      closeButtonRef.current?.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditable, isOpen])

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIsOpen(false)
    }
  }

  return (
    <>
      <div className={styles.toggleWrap}>
        {onCreateFromHero ? (
          <>
            <button
              type="button"
              className={styles.createButton}
              aria-label={`Create hero from ${hero.displayName}`}
              aria-describedby={createTooltipId}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                onCreateFromHero()
              }}
            >
              <Plus aria-hidden="true" />
            </button>
            <span id={createTooltipId} className={`${styles.tooltip} ${styles.createTooltip}`} role="tooltip">
              Copy This Hero.
            </span>
          </>
        ) : null}
        <button
          type="button"
          className={styles.toggleButton}
          aria-label={`${isEditable ? 'Edit' : 'View'} ${hero.displayName} character backstory`}
          aria-describedby={backstoryTooltipId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          <span
            className={styles.learnIcon}
            aria-hidden="true"
            style={{
              WebkitMaskImage: `url('${BOOK_ICON_PATH}')`,
              maskImage: `url('${BOOK_ICON_PATH}')`,
            }}
          />
        </button>
        <span id={backstoryTooltipId} className={`${styles.tooltip} ${styles.backstoryTooltip}`} role="tooltip">
          {isEditable ? 'Edit Character Backstory.' : 'View Character Backstory.'}
        </span>
      </div>

      {isOpen ? (
        <div className={styles.backdrop} onMouseDown={handleBackdropMouseDown}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            style={{ '--backstory-accent': accentColor } as BackstoryStyle}
          >
            <h2 id={titleId} className={styles.title}>
              BACKSTORY:
            </h2>
            {isEditable ? (
              <textarea
                ref={textareaRef}
                id={bodyId}
                aria-label="Backstory"
                className={`${styles.body} ${styles.bodyInput}`}
                value={editableBackstory}
                onChange={event => onBackstoryChange?.(event.target.value)}
                rows={rowCount}
                wrap="soft"
                placeholder="Write this character's story..."
              />
            ) : (
              <div id={bodyId} className={styles.body} tabIndex={0}>
                {backstory}
              </div>
            )}
            <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={() => setIsOpen(false)}>
              <span>CLOSE</span>
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}
