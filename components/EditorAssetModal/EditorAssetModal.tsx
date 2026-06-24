'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { OurFileRouter } from '@/app/api/uploadthing/core'
import type { EditorAssetGroup } from '@/lib/editor-assets'
import { UploadButton } from '@/lib/uploadthing'
import cn from '@/lib/utilsd'

import styles from './EditorAssetModal.module.css'

type UploadEndpoint = keyof OurFileRouter

interface EditorAssetModalProps {
  title: string
  description: string
  uploadLabel?: string
  uploadEndpoint?: UploadEndpoint
  groups: EditorAssetGroup[]
  previewMode: 'mask' | 'image'
  previewColor?: string
  testId: string
  onClose: () => void
  onSelect: (assetPath: string) => void
  onUpload?: (url: string) => void
}

interface UploadedAsset {
  url?: string
  serverData?: {
    url?: string
  } | null
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

function getUploadedAssetUrl(uploadedAssets: UploadedAsset[]) {
  const uploadedAsset = uploadedAssets[0]

  return uploadedAsset?.serverData?.url ?? uploadedAsset?.url ?? null
}

export default function EditorAssetModal({ title, description, uploadLabel, uploadEndpoint, groups, previewMode, previewColor, testId, onClose, onSelect, onUpload }: EditorAssetModalProps) {
  const [uploadError, setUploadError] = useState<string | null>(null)
  const canUpload = Boolean(uploadLabel && uploadEndpoint && onUpload)

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

        {canUpload ? (
          <div className={styles.uploadArea}>
            <UploadButton
              endpoint={uploadEndpoint as UploadEndpoint}
              appearance={{
                container: styles.uploadThingContainer,
                button: styles.uploadThingButton,
                allowedContent: styles.uploadThingAllowed,
              }}
              content={{
                button: ({ isUploading }) => (isUploading ? 'Uploading...' : uploadLabel ?? 'Upload'),
                allowedContent: () => null,
              }}
              onUploadBegin={() => setUploadError(null)}
              onClientUploadComplete={uploadedAssets => {
                const uploadedUrl = getUploadedAssetUrl(uploadedAssets)

                if (!uploadedUrl) {
                  setUploadError('Upload completed without a file URL.')
                  return
                }

                onUpload?.(uploadedUrl)
              }}
              onUploadError={error => setUploadError(error.message || 'Upload failed.')}
            />
            {uploadError ? <p className={styles.uploadError} role="alert">{uploadError}</p> : null}
          </div>
        ) : null}

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
