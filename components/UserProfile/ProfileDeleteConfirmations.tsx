'use client'

import { Trash2, X } from 'lucide-react'

import ProfileModalPortal from './ProfileModalPortal'
import styles from './UserProfile.module.css'

interface ConfirmationProps {
  isPending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteHeroConfirmation({ hero, isPending, error, onCancel, onConfirm }: ConfirmationProps & {
  hero: { name: string }
}) {
  return (
    <ProfileModalPortal onBackdropClick={() => { if (!isPending) onCancel() }}>
      <section
        className={styles.deleteHeroModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-hero-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.backgroundModalHeader}>
          <div>
            <p id="delete-hero-title">Delete {hero.name}?</p>
            <span>Permanent database deletion</span>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onCancel} aria-label="Close hero deletion confirmation" disabled={isPending}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className={styles.deleteHeroWarning}>
          This permanently removes the character, its stats, abilities, comments, likes, and bookmarks. This action cannot be undone.
        </p>
        {error ? <p className={styles.deleteHeroError} role="alert">{error}</p> : null}
        <div className={styles.backgroundModalActions}>
          <button type="button" className={styles.backgroundCancelButton} onClick={onCancel} disabled={isPending}>Cancel</button>
          <button type="button" className={styles.deleteHeroConfirmButton} onClick={onConfirm} disabled={isPending}>
            <Trash2 aria-hidden="true" size={15} />
            {isPending ? 'Deleting Character...' : 'Permanently Delete'}
          </button>
        </div>
      </section>
    </ProfileModalPortal>
  )
}

export function BulkDeleteHeroConfirmation({ count, isPending, error, onCancel, onConfirm }: ConfirmationProps & {
  count: number
}) {
  return (
    <ProfileModalPortal onBackdropClick={() => { if (!isPending) onCancel() }}>
      <section
        className={styles.deleteHeroModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-heroes-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.backgroundModalHeader}>
          <div>
            <p id="bulk-delete-heroes-title">Delete {count} characters?</p>
            <span>Permanent bulk database deletion</span>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onCancel} aria-label="Close bulk hero deletion confirmation" disabled={isPending}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className={styles.deleteHeroWarning}>
          This permanently removes every selected character and all associated stats, abilities, comments, likes, and bookmarks. This action cannot be undone.
        </p>
        {error ? <p className={styles.deleteHeroError} role="alert">{error}</p> : null}
        <div className={styles.backgroundModalActions}>
          <button type="button" className={styles.backgroundCancelButton} onClick={onCancel} disabled={isPending}>Cancel</button>
          <button type="button" className={styles.deleteHeroConfirmButton} onClick={onConfirm} disabled={isPending}>
            <Trash2 aria-hidden="true" size={15} />
            {isPending ? `Deleting ${count} Characters...` : `Permanently Delete ${count} Characters`}
          </button>
        </div>
      </section>
    </ProfileModalPortal>
  )
}
