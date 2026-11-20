'use client'

import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import type { RenderPosition } from '@/lib/editor-assets'
import { PHONE_MEDIA_QUERY, matchesMediaQuery } from '@/lib/responsive'

interface RenderDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startPosition: RenderPosition
}

interface UseRenderDragOptions {
  enabled: boolean
  getStartPosition: () => RenderPosition
  onDragPosition: (position: RenderPosition) => void
  shouldIgnoreTarget: (target: EventTarget | null) => boolean
}

// Touch presses on the page shell never start a render drag at phone width: the shell is
// the scroll surface there, so only the render frame (touch-action: none) drags. Tablets
// (761-1024px) keep the desktop behaviour, including shell drags with touch.
function isShellTouchPress(event: ReactPointerEvent<HTMLElement>) {
  return event.pointerType !== 'mouse' && matchesMediaQuery(PHONE_MEDIA_QUERY)
}

export function useRenderDrag({ enabled, getStartPosition, onDragPosition, shouldIgnoreTarget }: UseRenderDragOptions) {
  const dragStateRef = useRef<RenderDragState | null>(null)
  const onDragPositionRef = useRef(onDragPosition)

  useEffect(() => {
    onDragPositionRef.current = onDragPosition
  }, [onDragPosition])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return
      }

      onDragPositionRef.current({
        x: dragState.startPosition.x + event.clientX - dragState.startClientX,
        y: dragState.startPosition.y + event.clientY - dragState.startClientY,
      })
    }

    function handlePointerUp(event: PointerEvent) {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [])

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || event.button !== 0 || shouldIgnoreTarget(event.target)) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: getStartPosition(),
    }
    event.preventDefault()
  }

  function handleFramePointerDown(event: ReactPointerEvent<HTMLElement>) {
    startDrag(event)
  }

  function handleShellPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (isShellTouchPress(event)) {
      return
    }

    startDrag(event)
  }

  return { handleFramePointerDown, handleShellPointerDown }
}
