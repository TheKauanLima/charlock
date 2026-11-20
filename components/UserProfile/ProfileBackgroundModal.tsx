'use client'

import Image from 'next/image'
import { Check, Cog, X } from 'lucide-react'
import type { CSSProperties, PointerEvent } from 'react'

import { getThumbnailUrl, IMAGE_BLUR_DATA_URL } from '@/lib/image-optimization'
import type { ProfileBackgroundVisual } from '@/lib/profile'

import ProfileModalPortal from './ProfileModalPortal'
import styles from './UserProfile.module.css'

export interface ProfileBackgroundOption extends ProfileBackgroundVisual {
  portrait: string
  source: 'Official' | 'Created'
}

export type BackgroundPickerTab = ProfileBackgroundOption['source']

interface BackgroundOptionStyle extends CSSProperties {
  '--option-accent': string
  '--option-name': string
}

interface ProfileBackgroundModalProps {
  options: ProfileBackgroundOption[]
  activeId: string
  draftId: string
  activeTab: BackgroundPickerTab
  isPending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
  onPreview: (option: ProfileBackgroundOption) => void
  onPreviewEnd: () => void
  onSelectDraft: (option: ProfileBackgroundOption) => void
  onTabChange: (tab: BackgroundPickerTab) => void
}

// Hover previews are mouse-only. A touch "hover" that swaps content makes iOS
// swallow the first tap, so touch and pen users preview by tapping (onClick
// selects the draft and previews it) or by focusing the option.
function isMousePointer(event: PointerEvent<HTMLElement>) {
  return event.pointerType === 'mouse'
}

export default function ProfileBackgroundModal({
  options,
  activeId,
  draftId,
  activeTab,
  isPending,
  error,
  onClose,
  onConfirm,
  onPreview,
  onPreviewEnd,
  onSelectDraft,
  onTabChange,
}: ProfileBackgroundModalProps) {
  const visibleOptions = options.filter(option => option.source === activeTab)

  return (
    <ProfileModalPortal onBackdropClick={onClose}>
      <section
        className={styles.backgroundModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-background-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.backgroundModalHeader}>
          <div>
            <p id="profile-background-title">Profile Background</p>
            <span>{isPending ? 'Saving selection' : 'Choose a character render'}</span>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Close background picker">
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className={styles.backgroundTabs} role="tablist" aria-label="Background source">
          <button type="button" role="tab" aria-selected={activeTab === 'Official'} onClick={() => onTabChange('Official')} disabled={isPending}>
            Official Characters
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'Created'} onClick={() => onTabChange('Created')} disabled={isPending}>
            My Custom Characters
          </button>
        </div>

        {visibleOptions.length ? (
          <div className={styles.backgroundOptions}>
            {visibleOptions.map(option => {
              const optionStyle: BackgroundOptionStyle = {
                '--option-accent': option.accent,
                '--option-name': option.nameColor,
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.backgroundOption} ${draftId === option.id ? styles.backgroundOptionDraft : ''} ${activeId === option.id ? styles.backgroundOptionActive : ''}`}
                  style={optionStyle}
                  onClick={() => onSelectDraft(option)}
                  onFocus={() => onPreview(option)}
                  onBlur={onPreviewEnd}
                  onPointerEnter={event => { if (isMousePointer(event)) onPreview(option) }}
                  onPointerLeave={event => { if (isMousePointer(event)) onPreviewEnd() }}
                  aria-pressed={draftId === option.id}
                  disabled={isPending}
                >
                  <span className={styles.backgroundOptionRender}>
                    <Image src={option.render} alt="" fill sizes="(max-width: 760px) 84vw, 280px" className={styles.backgroundOptionRenderImage} />
                    <span className={styles.backgroundOptionWash} aria-hidden="true" />
                  </span>
                  <span className={styles.backgroundOptionPortrait}>
                    <Image src={getThumbnailUrl(option.portrait, 152, 246)} alt="" fill sizes="76px" className={styles.backgroundOptionPortraitImage} placeholder="blur" blurDataURL={IMAGE_BLUR_DATA_URL} />
                  </span>
                  <span className={styles.backgroundOptionLabel}>{option.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className={styles.backgroundEmpty}>No created characters yet.</p>
        )}

        {error ? <p className={styles.backgroundError} role="alert">{error}</p> : null}

        <div className={styles.backgroundModalActions}>
          <button type="button" className={styles.backgroundCancelButton} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className={styles.backgroundConfirmButton} onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Cog aria-hidden="true" size={15} className={styles.syncGear} />
                COMMITTING MEMORY CORE...
              </>
            ) : (
              <>
                <Check aria-hidden="true" size={15} />
                Confirm Background
              </>
            )}
          </button>
        </div>
      </section>
    </ProfileModalPortal>
  )
}
