'use client'

import { Bookmark, BookmarkCheck, Copy, Heart, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { PublicHeroViewer, PublicHeroVisibility } from '@/lib/public-page-types'
import { GUEST_ACTION_HREF, getHeroTemplateHref } from '@/lib/public-page-utils'

import { getHeroActionErrorMessage, postHeroAction } from './public-hero-requests'
import { formatLikeCount } from './public-hero-utils'
import styles from './PublicHero.module.css'

interface PublicHeroActionsProps {
  heroId: string
  heroName: string
  likesCount: number
  allowCopies: boolean
  viewer: PublicHeroViewer
  visibility: PublicHeroVisibility
}

interface LikeResponse {
  hero?: { likesCount?: number; likedByCurrentUser?: boolean }
}

interface BookmarkResponse {
  bookmark?: { heroId: string; bookmarked: boolean }
}

type PendingAction = 'like' | 'bookmark' | null

export default function PublicHeroActions({
  heroId,
  heroName,
  likesCount: initialLikesCount,
  allowCopies,
  viewer,
  visibility,
}: PublicHeroActionsProps) {
  const [liked, setLiked] = useState(viewer.liked)
  const [likesCount, setLikesCount] = useState(initialLikesCount)
  const [bookmarked, setBookmarked] = useState(viewer.bookmarked)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [status, setStatus] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const isPublic = visibility === 'public'
  const isGuest = !viewer.isSignedIn
  const heroApiPath = `/api/heroes/${encodeURIComponent(heroId)}`

  useEffect(() => () => abortRef.current?.abort(), [])

  function startRequest() {
    abortRef.current?.abort()
    const controller = new AbortController()

    abortRef.current = controller

    return controller
  }

  async function handleLike() {
    if (pendingAction) return

    const previous = { liked, likesCount }
    const controller = startRequest()

    setPendingAction('like')
    setStatus(null)
    setLiked(!previous.liked)
    setLikesCount(Math.max(0, previous.likesCount + (previous.liked ? -1 : 1)))

    const result = await postHeroAction<LikeResponse>(`${heroApiPath}/like`, {
      signal: controller.signal,
      fallback: 'Unable to update the like right now.',
    })

    if (controller.signal.aborted) return

    if (result.ok && result.data.hero) {
      setLiked(Boolean(result.data.hero.likedByCurrentUser))
      setLikesCount(result.data.hero.likesCount ?? previous.likesCount)
    } else {
      setLiked(previous.liked)
      setLikesCount(previous.likesCount)
      setStatus(result.ok
        ? 'Unable to update the like right now.'
        : getHeroActionErrorMessage(result.error, 'Unable to update the like right now.'))
    }

    setPendingAction(null)
  }

  async function handleBookmark() {
    if (pendingAction) return

    const previous = bookmarked
    const controller = startRequest()

    setPendingAction('bookmark')
    setStatus(null)
    setBookmarked(!previous)

    const result = await postHeroAction<BookmarkResponse>(`${heroApiPath}/bookmark`, {
      signal: controller.signal,
      fallback: 'Unable to update the bookmark right now.',
    })

    if (controller.signal.aborted) return

    if (result.ok && result.data.bookmark) {
      setBookmarked(result.data.bookmark.bookmarked)
    } else {
      setBookmarked(previous)
      setStatus(result.ok
        ? 'Unable to update the bookmark right now.'
        : getHeroActionErrorMessage(result.error, 'Unable to update the bookmark right now.'))
    }

    setPendingAction(null)
  }

  const templateHref = isGuest ? GUEST_ACTION_HREF : getHeroTemplateHref(heroId)
  const templateLabel = isGuest ? `Sign up to use ${heroName} as a template` : `Use ${heroName} as a template`
  // Owners can always open their own hero; everyone else needs copies enabled.
  const templateLink = allowCopies || viewer.isOwner ? (
    <Link href={templateHref} className={styles.actionButton} aria-label={templateLabel}>
      <Copy aria-hidden="true" size={16} />
      Use as template
    </Link>
  ) : null

  return (
    <div className={styles.actions}>
      {isPublic ? (
        <p className={styles.likeCount} data-testid="public-hero-like-count">
          <Heart aria-hidden="true" size={15} />
          {formatLikeCount(likesCount)}
        </p>
      ) : null}

      <div className={styles.actionRow}>
        {isPublic && isGuest ? (
          <>
            <Link href={GUEST_ACTION_HREF} className={styles.actionButton} aria-label={`Sign up to like ${heroName}`}>
              <Heart aria-hidden="true" size={16} />
              Like
            </Link>
            <Link href={GUEST_ACTION_HREF} className={styles.actionButton} aria-label={`Sign up to bookmark ${heroName}`}>
              <Bookmark aria-hidden="true" size={16} />
              Bookmark
            </Link>
            <Link href={GUEST_ACTION_HREF} className={styles.actionButton} aria-label={`Sign up to comment on ${heroName}`}>
              <MessageSquare aria-hidden="true" size={16} />
              Comment
            </Link>
          </>
        ) : null}

        {isPublic && !isGuest ? (
          <>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleLike}
              aria-label={liked ? `Unlike ${heroName}` : `Like ${heroName}`}
              aria-pressed={liked}
              disabled={pendingAction !== null}
            >
              <Heart aria-hidden="true" size={16} fill={liked ? 'currentColor' : 'none'} />
              {liked ? 'Liked' : 'Like'}
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleBookmark}
              aria-label={bookmarked ? `Remove ${heroName} bookmark` : `Bookmark ${heroName}`}
              aria-pressed={bookmarked}
              disabled={pendingAction !== null}
            >
              {bookmarked ? <BookmarkCheck aria-hidden="true" size={16} /> : <Bookmark aria-hidden="true" size={16} />}
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
            <a href="#comments" className={styles.actionButton} aria-label={`Comment on ${heroName}`}>
              <MessageSquare aria-hidden="true" size={16} />
              Comment
            </a>
          </>
        ) : null}

        {templateLink}
      </div>

      {status ? <p role="status" className={styles.actionStatus}>{status}</p> : null}
    </div>
  )
}
