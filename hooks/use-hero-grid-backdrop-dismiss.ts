'use client'

import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

// Backdrop tap-to-close that works for mouse, touch and pen.
// The press must start on the backdrop itself (so a text selection dragged out of the dialog
// does not close it), and the close happens on the tap's click. Closing on pointerdown would
// remove the backdrop mid-tap, and the touch's click would then land on whatever sits behind
// it (a hero card, the bookmark button).
export function useHeroGridBackdropDismiss(onDismiss: () => void) {
  const pressStartedOnBackdropRef = useRef(false)

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      pressStartedOnBackdropRef.current = event.target === event.currentTarget
    },
    onClick(event: MouseEvent<HTMLElement>) {
      const pressStartedOnBackdrop = pressStartedOnBackdropRef.current

      pressStartedOnBackdropRef.current = false

      if (pressStartedOnBackdrop && event.target === event.currentTarget) {
        onDismiss()
      }
    },
  }
}
