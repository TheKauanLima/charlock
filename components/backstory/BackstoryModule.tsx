'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { Plus } from 'lucide-react'

import type { HeroDefinition } from '@/lib/hero-data'
import { notifyIfLimitedTextKeyDown, notifyIfLimitedTextPaste } from '@/lib/input-limit-feedback'

import styles from './BackstoryModule.module.css'

interface BackstoryModuleProps {
  hero: HeroDefinition
  accentImageSrc?: string
  isEditable?: boolean
  onCreateFromHero?: () => void
  onBackstoryChange?: (value: string) => void
  onBlockedAction?: (message: string) => void
}

type BackstoryStyle = CSSProperties & {
  '--backstory-accent': string
  '--backstory-accent-rgb': string
}

const BOOK_ICON_PATH = '/panorama/images/icons/icon_book.svg'
const FALLBACK_BACKSTORY = 'No character backstory has been added yet.'
const BACKSTORY_VISIBLE_ROWS = 15
const BACKSTORY_MAX_LENGTH = 10000

interface RgbColor {
  r: number
  g: number
  b: number
}

interface ColorBucket extends RgbColor {
  count: number
  score: number
}

function clampColorChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function getHexChannel(value: number) {
  return clampColorChannel(value).toString(16).padStart(2, '0')
}

function rgbToHex({ r, g, b }: RgbColor) {
  return `#${getHexChannel(r)}${getHexChannel(g)}${getHexChannel(b)}`
}

export function getRgbTriplet(color: string) {
  const hexMatch = color.trim().match(/^#?([0-9a-f]{6})$/i)

  if (!hexMatch) {
    return '255, 239, 215'
  }

  const hex = hexMatch[1]
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `${red}, ${green}, ${blue}`
}

export function getProminentColorFromPixels(pixels: Uint8ClampedArray) {
  const buckets = new Map<string, ColorBucket>()

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]

    if (alpha < 128) {
      continue
    }

    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const maxChannel = Math.max(red, green, blue)
    const minChannel = Math.min(red, green, blue)
    const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel
    const lightness = (maxChannel + minChannel) / 510

    if (lightness < 0.08 || lightness > 0.92) {
      continue
    }

    const bucketRed = Math.round(red / 32) * 32
    const bucketGreen = Math.round(green / 32) * 32
    const bucketBlue = Math.round(blue / 32) * 32
    const key = `${bucketRed}:${bucketGreen}:${bucketBlue}`
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0, score: 0 }

    bucket.r += red
    bucket.g += green
    bucket.b += blue
    bucket.count += 1
    bucket.score += 0.45 + saturation + Math.min(lightness, 1 - lightness)
    buckets.set(key, bucket)
  }

  const prominentBucket = Array.from(buckets.values()).sort((first, second) => second.score - first.score)[0]

  if (!prominentBucket) {
    return null
  }

  return rgbToHex({
    r: prominentBucket.r / prominentBucket.count,
    g: prominentBucket.g / prominentBucket.count,
    b: prominentBucket.b / prominentBucket.count,
  })
}

function getBackstoryAccentImage(hero: HeroDefinition) {
  const heroWithBackground = hero as HeroDefinition & { background?: string }

  return heroWithBackground.background || hero.render
}

export default function BackstoryModule({ hero, accentImageSrc, isEditable = false, onCreateFromHero, onBackstoryChange, onBlockedAction }: BackstoryModuleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const themeAccentColor = hero.heroInfo.abilityCircleColor || hero.heroInfo.tagColor
  const [sampledAccentColor, setSampledAccentColor] = useState<{ source: string; color: string } | null>(null)
  const modalRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = `backstory-title-${hero.slug}`
  const bodyId = `backstory-body-${hero.slug}`
  const backstoryTooltipId = `backstory-tooltip-${hero.slug}`
  const createTooltipId = `copy-hero-tooltip-${hero.slug}`
  const editableBackstory = hero.heroInfo.backstory ?? ''
  const backstory = isEditable ? editableBackstory : hero.heroInfo.backstory?.trim() || FALLBACK_BACKSTORY
  const accentSource = accentImageSrc ?? getBackstoryAccentImage(hero)
  const accentColor = sampledAccentColor?.source === accentSource ? sampledAccentColor.color : themeAccentColor

  useEffect(() => {
    if (!accentSource || typeof window === 'undefined') {
      return undefined
    }

    let isCancelled = false
    const image = new window.Image()

    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (isCancelled) {
        return
      }

      const canvas = document.createElement('canvas')
      const size = 28

      canvas.width = size
      canvas.height = size

      const context = canvas.getContext('2d', { willReadFrequently: true })

      if (!context) {
        return
      }

      try {
        context.drawImage(image, 0, 0, size, size)

        const prominentColor = getProminentColorFromPixels(context.getImageData(0, 0, size, size).data)

        if (prominentColor) {
          setSampledAccentColor({ source: accentSource, color: prominentColor })
        }
      } catch {
        return undefined
      }
    }
    image.src = accentSource

    return () => {
      isCancelled = true
    }
  }, [accentSource])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    if (isEditable) {
      textareaRef.current?.focus()
    } else {
      closeButtonRef.current?.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const modal = modalRef.current

      if (!modal) {
        return
      }

      const focusableElements = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute('aria-hidden'))

      if (!focusableElements.length) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
        return
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
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
            ref={modalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            style={{
              '--backstory-accent': accentColor,
              '--backstory-accent-rgb': getRgbTriplet(accentColor),
            } as BackstoryStyle}
          >
            <h2 id={titleId} className={styles.title}>
              <span className={styles.titleInitial}>B</span>ACKSTORY:
            </h2>
            {isEditable ? (
              <textarea
                ref={textareaRef}
                id={bodyId}
                aria-label="Backstory"
                className={`${styles.body} ${styles.bodyInput}`}
                value={editableBackstory}
                maxLength={BACKSTORY_MAX_LENGTH}
                onKeyDown={event => notifyIfLimitedTextKeyDown(event, editableBackstory, BACKSTORY_MAX_LENGTH, 'Backstory', onBlockedAction)}
                onPaste={event => notifyIfLimitedTextPaste(event, editableBackstory, BACKSTORY_MAX_LENGTH, 'Backstory', onBlockedAction)}
                onChange={event => onBackstoryChange?.(event.target.value)}
                rows={BACKSTORY_VISIBLE_ROWS}
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
