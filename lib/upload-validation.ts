import type { OurFileRouter } from '@/app/api/uploadthing/core'

export interface UploadPolicy {
  maxBytes: number
  maxSizeLabel: string
  acceptedTypes: readonly string[]
}

export interface UploadValidationResult {
  valid: boolean
  message: string | null
}

const MB = 1024 * 1024

export const UPLOAD_POLICIES: Record<keyof OurFileRouter, UploadPolicy> = {
  heroPortrait: { maxBytes: 4 * MB, maxSizeLabel: '4MB', acceptedTypes: ['image/'] },
  heroRender: { maxBytes: 8 * MB, maxSizeLabel: '8MB', acceptedTypes: ['image/'] },
  heroNameAsset: { maxBytes: 2 * MB, maxSizeLabel: '2MB', acceptedTypes: ['image/', 'application/octet-stream'] },
  weaponImage: { maxBytes: 4 * MB, maxSizeLabel: '4MB', acceptedTypes: ['image/'] },
}

export function validateUploadFiles(files: File[], policy: UploadPolicy): UploadValidationResult {
  const oversizedFile = files.find(file => file.size > policy.maxBytes)

  if (oversizedFile) {
    return { valid: false, message: `Asset payload exceeds ${policy.maxSizeLabel} limit.` }
  }

  const invalidType = files.find(file => !policy.acceptedTypes.some(type => file.type.startsWith(type)))

  if (invalidType) {
    return { valid: false, message: 'Asset type is not supported. Select a PNG, JPG, WEBP, or SVG file.' }
  }

  return { valid: true, message: null }
}
