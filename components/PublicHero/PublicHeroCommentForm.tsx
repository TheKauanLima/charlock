'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { GUEST_ACTION_HREF } from '@/lib/public-page-utils'

import { getHeroActionErrorMessage, postHeroAction } from './public-hero-requests'
import styles from './PublicHero.module.css'

const COMMENT_MAX_LENGTH = 500

interface PublicHeroCommentFormProps {
  heroId: string
  isSignedIn: boolean
}

export default function PublicHeroCommentForm({ heroId, isSignedIn }: PublicHeroCommentFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  if (!isSignedIn) {
    return (
      <p className={styles.commentGuest}>
        <Link href={GUEST_ACTION_HREF} className={styles.actionButton}>Sign up to comment</Link>
      </p>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isPosting) return

    const trimmed = content.trim()

    if (!trimmed) {
      setStatus('Write a comment before posting.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()

    abortRef.current = controller
    setIsPosting(true)
    setStatus(null)

    const result = await postHeroAction<{ comment?: unknown }>(`/api/heroes/${encodeURIComponent(heroId)}/comments`, {
      body: { content: trimmed },
      signal: controller.signal,
      fallback: 'Unable to post the comment right now.',
    })

    if (controller.signal.aborted) return

    if (result.ok) {
      setContent('')
      setStatus('Comment posted.')
      router.refresh()
    } else {
      setStatus(getHeroActionErrorMessage(result.error, 'Unable to post the comment right now.'))
    }

    setIsPosting(false)
  }

  return (
    <form className={styles.commentForm} onSubmit={handleSubmit}>
      <label htmlFor="public-hero-comment">Add a comment</label>
      <textarea
        id="public-hero-comment"
        name="content"
        value={content}
        maxLength={COMMENT_MAX_LENGTH}
        rows={3}
        onChange={event => setContent(event.target.value)}
        placeholder="Share feedback on this hero concept"
      />
      <div className={styles.commentFormFooter}>
        <span>{content.length}/{COMMENT_MAX_LENGTH}</span>
        <button type="submit" className={styles.actionButton} disabled={isPosting}>
          {isPosting ? 'Posting...' : 'Post comment'}
        </button>
      </div>
      {status ? <p role="status" className={styles.actionStatus}>{status}</p> : null}
    </form>
  )
}
