'use client'

import { useEffect, useRef } from 'react'

// Closes a tap-opened detail (for example the ability preview) on an outside press or Escape.
// Presses inside `ignoreSelector` are left to their own handlers, so a second tap on the
// trigger can toggle the detail closed instead of being closed and immediately reopened.
export function useHeroGridDismiss(active: boolean, onDismiss: () => void, ignoreSelector: string) {
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!active) {
      return undefined
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(ignoreSelector)) {
        return
      }

      onDismissRef.current()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onDismissRef.current()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [active, ignoreSelector])
}
