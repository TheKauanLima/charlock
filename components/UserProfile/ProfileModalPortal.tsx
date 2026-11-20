'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

import styles from './UserProfile.module.css'

interface ProfileModalPortalProps {
  children: ReactNode
  onBackdropClick: () => void
}

/**
 * Renders a profile modal backdrop on document.body so no ancestor stacking
 * context (or the floating GlobalNav) can sit above the dialog.
 */
export default function ProfileModalPortal({ children, onBackdropClick }: ProfileModalPortalProps) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={styles.modalBackdrop}
      role="presentation"
      data-modal-backdrop="true"
      onClick={event => {
        if (event.target === event.currentTarget) onBackdropClick()
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
