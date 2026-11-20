'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PHONE_MEDIA_QUERY, matchesMediaQuery } from '@/lib/responsive'

// On phones the grid sits above the render stage, so a tapped hero would otherwise change
// off-screen. The scroll runs after commit so the stage is no longer `display: none`.
export function useHeroGridStageScroll<T extends HTMLElement>() {
  const stageRef = useRef<T>(null)
  const [scrollRequest, setScrollRequest] = useState(0)

  useEffect(() => {
    if (!scrollRequest || !matchesMediaQuery(PHONE_MEDIA_QUERY)) {
      return
    }

    const stage = stageRef.current

    if (stage && typeof stage.scrollIntoView === 'function') {
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [scrollRequest])

  const requestStageScroll = useCallback(() => {
    setScrollRequest(current => current + 1)
  }, [])

  return { stageRef, requestStageScroll }
}
