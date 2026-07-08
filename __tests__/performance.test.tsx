// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { getThumbnailUrl } from '@/lib/image-optimization'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('performance utilities', () => {
  it('adds thumbnail dimensions only to Vercel Blob URLs', () => {
    expect(getThumbnailUrl('https://assets.public.blob.vercel-storage.com/hero.png?token=abc', 260, 420))
      .toBe('https://assets.public.blob.vercel-storage.com/hero.png?token=abc&w=260&h=420')
    expect(getThumbnailUrl('/panorama/images/heroes/abrams.png', 260, 420))
      .toBe('/panorama/images/heroes/abrams.png')
    expect(getThumbnailUrl('https://utfs.io/f/portrait.png', 260, 420))
      .toBe('https://utfs.io/f/portrait.png')
  })

  it('loads more when the sentinel enters the 300px prefetch margin', () => {
    const onLoadMore = vi.fn()
    let observerCallback: IntersectionObserverCallback | null = null
    let observerOptions: IntersectionObserverInit | undefined
    const observe = vi.fn()

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observerCallback = callback
        observerOptions = options
      }

      observe = observe
      disconnect = vi.fn()
      unobserve = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = ''
      thresholds = [0]
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    function Harness() {
      const sentinelRef = useInfiniteScroll({ hasMore: true, isLoading: false, onLoadMore })

      return <button ref={sentinelRef}>Load More</button>
    }

    render(<Harness />)

    expect(observe).toHaveBeenCalledTimes(1)
    expect(observerOptions).toMatchObject({ rootMargin: '0px 0px 300px 0px', threshold: 0 })

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})
