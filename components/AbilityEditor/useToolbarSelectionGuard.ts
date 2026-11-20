import { useEffect, useRef } from 'react'

interface PreventableEvent {
  preventDefault: () => void
}

interface PreventablePointerEvent extends PreventableEvent {
  pointerType: string
}

/**
 * Props for rich-text toolbar buttons that must not steal the editor selection.
 * Mouse input keeps the original mechanism: cancelling mousedown. Cancelling a mouse
 * pointerdown would suppress the compatibility mousedown in Chromium and change desktop
 * focus behaviour, so pointerdown is only cancelled for touch and pen. It fires at
 * touchstart, which keeps touch browsers from moving focus (and the selection) off the
 * contenteditable before the button's click runs. Both handlers record the selection.
 */
export function getSelectionPreservingPressProps(onPress: () => void) {
  function handlePointerDown(event: PreventablePointerEvent) {
    if (event.pointerType !== 'mouse') {
      event.preventDefault()
    }

    onPress()
  }

  function handleMouseDown(event: PreventableEvent) {
    event.preventDefault()
    onPress()
  }

  return { onPointerDown: handlePointerDown, onMouseDown: handleMouseDown }
}

/**
 * Calls the latest callback on every document selectionchange. Touch selections made
 * with long-press handles never fire mouseup, so this is how they get remembered.
 */
export function useSelectionChangeListener(onSelectionChange: () => void) {
  const callbackRef = useRef(onSelectionChange)

  useEffect(() => {
    callbackRef.current = onSelectionChange
  })

  useEffect(() => {
    function handleSelectionChange() {
      callbackRef.current()
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])
}
