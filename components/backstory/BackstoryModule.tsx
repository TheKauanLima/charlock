'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'

import type { HeroDefinition } from '@/lib/hero-data'

import styles from './BackstoryModule.module.css'

interface BackstoryModuleProps {
  hero: HeroDefinition
}

type BackstoryStyle = CSSProperties & {
  '--backstory-accent': string
}

const LEARN_ICON_PATH = '/panorama/images/main_menu/icons/menu_learn.svg'
const FALLBACK_BACKSTORY = 'No character backstory has been added yet.'

export default function BackstoryModule({ hero }: BackstoryModuleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = `backstory-title-${hero.slug}`
  const bodyId = `backstory-body-${hero.slug}`
  const tooltipId = `backstory-tooltip-${hero.slug}`
  const backstory = hero.heroInfo.backstory?.trim() || FALLBACK_BACKSTORY
  const accentColor = hero.heroInfo.abilityCircleColor || hero.heroInfo.tagColor

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIsOpen(false)
    }
  }

  return (
    <>
      <div className={styles.toggleWrap}>
        <span id={tooltipId} className={styles.tooltip} role="tooltip">
          View Character Backstory.
        </span>
        <button
          type="button"
          className={styles.toggleButton}
          aria-label={`View ${hero.displayName} character backstory`}
          aria-describedby={tooltipId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          <span
            className={styles.learnIcon}
            aria-hidden="true"
            style={{
              WebkitMaskImage: `url('${LEARN_ICON_PATH}')`,
              maskImage: `url('${LEARN_ICON_PATH}')`,
            }}
          />
        </button>
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
            <div id={bodyId} className={styles.body} tabIndex={0}>
              {backstory}
            </div>
            <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={() => setIsOpen(false)}>
              <span>CLOSE</span>
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}
