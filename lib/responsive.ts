export const PHONE_MAX_WIDTH = 760
export const TABLET_MAX_WIDTH = 1024
export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`
export const TABLET_MEDIA_QUERY = `(max-width: ${TABLET_MAX_WIDTH}px)`
export const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)'
export const NO_HOVER_MEDIA_QUERY = '(hover: none)'

export function matchesMediaQuery(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(query).matches
}
