'use client'

import { Download, X } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { toPng } from 'html-to-image'

import {
  CHARACTER_CARD_HEIGHT,
  CHARACTER_CARD_WIDTH,
  type CharacterExportPayload,
} from '@/lib/character-export'
import cn from '@/lib/utilsd'

import styles from './CharacterExportButton.module.css'

interface CharacterExportButtonProps {
  payload: CharacterExportPayload
  className?: string
}

type ExportStatus = 'idle' | 'generating' | 'ready' | 'error'

function getDownloadName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'character'}-charlock-card.png`
}

async function generateCardImage(card: HTMLElement) {
  return toPng(card, {
    width: CHARACTER_CARD_WIDTH,
    height: CHARACTER_CARD_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#080706',
  })
}

export default function CharacterExportButton({ payload, className }: CharacterExportButtonProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    let isCancelled = false
    const frameId = window.requestAnimationFrame(() => {
      async function buildPreview() {
        if (!cardRef.current) {
          return
        }

        setStatus('generating')
        setMessage('Generating preview...')

        try {
          const nextPreviewUrl = await generateCardImage(cardRef.current)

          if (isCancelled) {
            return
          }

          setPreviewUrl(nextPreviewUrl)
          setStatus('ready')
          setMessage('Preview ready.')
        } catch {
          if (isCancelled) {
            return
          }

          setStatus('error')
          setMessage('Preview generation failed. Check that the character images are available.')
        }
      }

      void buildPreview()
    })

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [isOpen, payload])

  function openModal() {
    setPreviewUrl(null)
    setStatus('idle')
    setMessage(null)
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
    setPreviewUrl(null)
    setStatus('idle')
    setMessage(null)
  }

  async function handleDownload() {
    const imageUrl = previewUrl ?? (cardRef.current ? await generateCardImage(cardRef.current) : null)

    if (!imageUrl) {
      setStatus('error')
      setMessage('No card preview is available to download.')
      return
    }

    const link = document.createElement('a')
    link.href = imageUrl
    link.download = getDownloadName(payload.name)
    link.click()
  }

  return (
    <>
      <button type="button" className={cn(styles.trigger, className)} onClick={openModal}>
        <Download aria-hidden="true" />
        Export Character
      </button>

      {isOpen ? (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Export character card">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p>Character Card</p>
                <h2>{payload.name}</h2>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Close export preview" onClick={closeModal}>
                <X aria-hidden="true" />
              </button>
            </div>

            <div className={styles.previewFrame}>
              {previewUrl ? (
                <div
                  className={styles.generatedPreview}
                  role="img"
                  aria-label={`${payload.name} generated character card preview`}
                  style={{ backgroundImage: `url('${previewUrl}')` }}
                />
              ) : null}
              <div className={previewUrl ? styles.sourceCardHidden : styles.sourceCardVisible}>
                <CharacterExportCard ref={cardRef} payload={payload} />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" onClick={handleDownload} disabled={status === 'generating'}>
                <Download aria-hidden="true" />
                Download PNG
              </button>
            </div>

            {message ? <p className={styles.status} role="status">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

interface CharacterExportCardProps {
  payload: CharacterExportPayload
}

const CharacterExportCard = forwardRef<HTMLDivElement, CharacterExportCardProps>(function CharacterExportCard({ payload }, ref) {
  return (
    <div
      ref={ref}
      className={styles.card}
      data-testid="character-export-card"
      style={{
        '--export-accent': payload.accentColor,
        '--export-tag-bg': payload.tagColor,
        '--export-tag-color': payload.tagTextColor,
      } as CSSProperties}
    >
      <div className={styles.cardBackdrop} style={{ backgroundImage: `url('${payload.render}')` }} />
      <div className={styles.cardWash} />
      <div className={styles.cardContent}>
        <div className={styles.portraitPanel}>
          <div className={styles.portrait} role="img" aria-label={`${payload.name} portrait`} style={{ backgroundImage: `url('${payload.portrait}')` }} />
        </div>
        <div className={styles.cardDetails}>
          <p className={styles.eyebrow}>Charlock Character Card</p>
          <h3>{payload.name}</h3>
          <div className={styles.tags} aria-label="Character tags">
            {payload.tags.map(tag => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <dl className={styles.stats}>
            {payload.stats.map(stat => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <span className={styles.watermark}>{payload.watermark}</span>
    </div>
  )
})
