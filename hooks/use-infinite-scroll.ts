'use client'

import { useCallback, useEffect, useRef } from 'react'

interface UseInfiniteScrollOptions {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void | Promise<void>
  rootMargin?: string
}

const DEFAULT_ROOT_MARGIN = '0px 0px 300px 0px'

export function useInfiniteScroll({ hasMore, isLoading, onLoadMore, rootMargin = DEFAULT_ROOT_MARGIN }: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef(onLoadMore)
  const requestInFlightRef = useRef(false)

  useEffect(() => {
    loadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    if (!isLoading) requestInFlightRef.current = false
  }, [isLoading])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!node || !hasMore || isLoading || typeof IntersectionObserver === 'undefined') return

    observerRef.current = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || requestInFlightRef.current) return

      requestInFlightRef.current = true
      void loadMoreRef.current()
    }, { rootMargin, threshold: 0 })

    observerRef.current.observe(node)
  }, [hasMore, isLoading, rootMargin])
}
