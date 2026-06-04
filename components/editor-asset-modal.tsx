'use client'

import { Upload, X } from 'lucide-react'
import type { ChangeEvent, CSSProperties } from 'react'

import type { EditorAssetGroup } from '@/lib/editor-assets'
import cn from '@/lib/utilsd'

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
    <div className="pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${title} selector`} data-testid={testId}>
      <div className="flex max-h-[82vh] w-[min(92vw,760px)] flex-col overflow-hidden rounded border border-[#ffefd6]/16 bg-[#061d27] text-[#ffefd6] shadow-[0_24px_90px_rgba(0,0,0,0.62)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#ffefd6]/10 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.24em]">{title}</h3>
            <p className="mt-1 text-xs text-[#ffefd6]/56">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-[#ffefd6]/15 bg-black/25 transition hover:border-[#ffefd6]/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]"
            onClick={onClose}
            aria-label={`Close ${title} selector`}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="border-b border-[#ffefd6]/10 p-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-[#2fc890]/40 bg-[#2fc890]/10 px-4 py-4 text-[0.7rem] font-black uppercase tracking-[0.2em] text-[#bafbe0] transition hover:bg-[#2fc890]/16">
            <Upload className="size-4" aria-hidden />
            {uploadLabel}
            <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={handleUpload} />
          </label>
        </div>

        <div className="grid gap-4 overflow-y-auto p-4">
          {groups.map(group => (
            <section key={group.id} aria-labelledby={`editor-assets-${group.id}`} className="grid gap-2">
              <h4 id={`editor-assets-${group.id}`} className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[#ffefd6]/72">
                {group.label}
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {group.assets.map(asset => (
                  <button
                    key={`${group.id}-${asset.path}`}
                    type="button"
                    className={cn(
                      'flex aspect-square items-center justify-center rounded border border-[#ffefd6]/12 bg-black/28 transition hover:border-[#2fc890]/70 hover:bg-[#2fc890]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffefd6]',
                      previewMode === 'image' && 'aspect-[4/3] px-1',
                    )}
                    aria-label={`Use ${asset.label}`}
                    onClick={() => onSelect(asset.path)}
                  >
                    <span
                      className={cn(
                        'bg-center bg-contain bg-no-repeat',
                        previewMode === 'image' ? 'h-full w-full' : 'size-[62%] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]',
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
