import type { RenderPosition } from '@/lib/editor-assets'
import { isSafeOgImageUrl } from '@/lib/public-page-utils'

const COMMENT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Only allowlisted or site-relative image paths go to next/image or CSS url(). */
export function getDisplayImageSrc(src: string | null | undefined) {
  return typeof src === 'string' && isSafeOgImageUrl(src) ? src : null
}

/** Mirrors the HeroGrid stage offset (right/top anchored, shifted by the saved position). */
export function getRenderObjectPosition(position: RenderPosition | null | undefined) {
  const x = Number.isFinite(position?.x) ? position?.x ?? 0 : 0
  const y = Number.isFinite(position?.y) ? position?.y ?? 0 : 0

  return `calc(100% + ${x}px) calc(0% + ${y}px)`
}

/** Strips the ability editor's rich-text tokens ([b], [c:spirit], [i:icon], ...) to plain text. */
export function toPlainAbilityText(value: string | null | undefined) {
  if (typeof value !== 'string') return ''

  return value
    .replace(/\[\[inline-icon-marker:[^\]]*\]\]/g, '')
    .replace(/\[i:[^\]]*\]/g, '')
    .replace(/\[\/?(?:b|i|dark)\]/g, '')
    .replace(/\[c:[^\]]*\]/g, '')
    .replace(/\[\/c\]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function formatCommentDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : COMMENT_DATE_FORMAT.format(date)
}

export function formatLikeCount(count: number) {
  return `${count} ${count === 1 ? 'like' : 'likes'}`
}
