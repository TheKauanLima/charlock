'use client'

import { Flag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useHeroGridBackdropDismiss } from '@/hooks/use-hero-grid-backdrop-dismiss'
import { REPORT_REASONS } from '@/lib/moderation-types'
import type { ModerationStatus, ReportReason } from '@/lib/moderation-types'
import cn from '@/lib/utilsd'

import styles from './ReportDialog.module.css'

interface ReportDialogProps {
  endpoint: string
  contentLabel: string
  compact?: boolean
  className?: string
  onReported?: (moderationStatus: ModerationStatus) => void
}

interface ReportResponse {
  report?: {
    moderationStatus: ModerationStatus
  }
  error?: string
}

const SUCCESS_MESSAGE = 'SYSTEM: Content report logged. Thank you for maintaining safety.'

export default function ReportDialog({ endpoint, contentLabel, compact = false, className, onReported }: ReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const backdropDismissProps = useHeroGridBackdropDismiss(() => setIsOpen(false))

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  async function submitReport() {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, ...(details.trim() ? { details: details.trim() } : {}) }),
      })
      const body = await response.json() as ReportResponse

      if (!response.ok || !body.report) {
        throw new Error(body.error || `Report request failed with ${response.status}`)
      }

      setIsOpen(false)
      setDetails('')
      setFeedback(SUCCESS_MESSAGE)
      onReported?.(body.report.moderationStatus)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to submit report.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // The trigger sits inside positioned, z-indexed containers (hero cluster, comment rows), so the
  // dialog and toast render on document.body to clear the GlobalNav (spec 23, A1).
  const portalTarget = typeof document === 'undefined' ? null : document.body

  return (
    <>
      <button
        type="button"
        className={cn(styles.trigger, compact && styles.triggerCompact, className)}
        aria-label={compact ? `Report ${contentLabel}` : undefined}
        onClick={() => {
          setFeedback(null)
          setIsOpen(true)
        }}
      >
        <Flag aria-hidden="true" />
        {compact ? null : 'Report Content'}
      </button>

      {feedback && portalTarget ? createPortal(<div className={styles.toast} role="status">{feedback}</div>, portalTarget) : null}

      {isOpen && portalTarget ? createPortal(
        <div
          className={styles.backdrop}
          data-modal-backdrop="true"
          role="presentation"
          {...backdropDismissProps}
        >
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
            <header>
              <div>
                <p>Community safety</p>
                <h2 id="report-dialog-title">Report {contentLabel}</h2>
              </div>
              <button type="button" aria-label="Close report dialog" onClick={() => setIsOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </header>

            <fieldset>
              <legend>Reason</legend>
              {REPORT_REASONS.map(option => (
                <label key={option}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={option}
                    checked={reason === option}
                    onChange={() => setReason(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>

            <label className={styles.detailsLabel}>
              Additional explanation <span>Optional</span>
              <textarea
                value={details}
                inputMode="text"
                autoCapitalize="sentences"
                maxLength={1000}
                placeholder="Add context that may help the moderation review."
                onChange={event => setDetails(event.target.value)}
              />
            </label>

            {feedback ? <p className={styles.error} role="alert">{feedback}</p> : null}

            <footer>
              <button type="button" onClick={() => setIsOpen(false)}>Cancel</button>
              <button type="button" disabled={isSubmitting} onClick={() => void submitReport()}>
                {isSubmitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </footer>
          </section>
        </div>,
        portalTarget,
      ) : null}
    </>
  )
}
