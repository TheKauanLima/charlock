'use client'

import { Upload, X } from 'lucide-react'
import type { ChangeEvent, CSSProperties } from 'react'

import type { EditorAssetGroup } from '@/lib/editor-assets'
import cn from '@/lib/utilsd'

import styles from './EditorAssetModal.module.css'

interface EditorAssetModalProps {
  title: string
  description: string
  uploadLabel: string
  groups: EditorAssetGroup[]
  previewMode: 'mask' | 'image'
  previewColor?: string
  testId: string
  onClose: () => void
  onSelect: (assetPath: string) => void
  onUpload: (file: File) => void
}

function getPreviewStyle(assetPath: string, previewMode: 'mask' | 'image', previewColor?: string): CSSProperties {
  if (previewMode === 'image') {
    return {
      backgroundImage: `url('${assetPath}')`,
    }
  }

  return {
    backgroundColor: previewColor ?? '#ffefd6',
    WebkitMaskImage: `url('${assetPath}')`,
    maskImage: `url('${assetPath}')`,
  }
}

export default function EditorAssetModal({ title, description, uploadLabel, groups, previewMode, previewColor, testId, onClose, onSelect, onUpload }: EditorAssetModalProps) {
  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (file) {
      onUpload(file)
    }
  }

  return (
    <div className={cn(styles.backdrop, 'pointer-events-auto')} role="dialog" aria-modal="true" aria-label={`${title} selector`} data-testid={testId}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.description}>{description}</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={`Close ${title} selector`}
          >
            <X className={styles.closeIcon} aria-hidden />
          </button>
        </div>

        <div className={styles.uploadArea}>
          <label className={styles.uploadLabel}>
            <Upload className={styles.uploadIcon} aria-hidden />
            {uploadLabel}
            <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={handleUpload} />
          </label>
        </div>

        <div className={styles.assetList}>
          {groups.map(group => (
            <section key={group.id} aria-labelledby={`editor-assets-${group.id}`} className={styles.assetGroup}>
              <h4 id={`editor-assets-${group.id}`} className={styles.groupTitle}>
                {group.label}
              </h4>
              <div className={styles.assetGrid}>
                {group.assets.map(asset => (
                  <button
                    key={`${group.id}-${asset.path}`}
                    type="button"
                    className={cn(styles.assetButton, previewMode === 'image' && styles.imageAssetButton)}
                    aria-label={`Use ${asset.label}`}
                    onClick={() => onSelect(asset.path)}
                  >
                    <span
                      className={cn(
                        styles.assetPreview,
                        previewMode === 'image' ? styles.imagePreview : styles.maskPreview,
                      )}
                      aria-hidden="true"
                      style={getPreviewStyle(asset.path, previewMode, previewColor)}
                    />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
