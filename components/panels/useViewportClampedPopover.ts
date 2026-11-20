import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

const VIEWPORT_GUTTER = 8

/**
 * Nudges an open, absolutely positioned popover sideways so it stays inside the
 * viewport. The popover keeps its CSS anchor; only the `translate` property changes,
 * so this also works inside transformed or scrolling ancestors.
 */
export function useViewportClampedPopover(popoverRef: RefObject<HTMLElement | null>, isOpen: boolean) {
  useLayoutEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return undefined
    }

    function clampToViewport() {
      const popover = popoverRef.current

      if (!popover) {
        return
      }

      popover.style.removeProperty('translate')

      const rect = popover.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth

      if (!rect.width || !viewportWidth) {
        return
      }

      let shift = 0

      if (rect.right > viewportWidth - VIEWPORT_GUTTER) {
        shift = viewportWidth - VIEWPORT_GUTTER - rect.right
      }

      if (rect.left + shift < VIEWPORT_GUTTER) {
        shift = VIEWPORT_GUTTER - rect.left
      }

      if (shift) {
        popover.style.setProperty('translate', `${Math.round(shift)}px 0`)
      }
    }

    clampToViewport()
    window.addEventListener('resize', clampToViewport)

    return () => {
      window.removeEventListener('resize', clampToViewport)
    }
  }, [isOpen, popoverRef])
}
