'use client'

import { UserCheck, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { getNetworkRequestError, parseClientRequestError, readApiResponse, type ApiErrorPayload } from '@/lib/client-errors'
import { GUEST_ACTION_HREF } from '@/lib/public-page-utils'

import styles from './PublicUserProfile.module.css'

interface PublicProfileFollowButtonProps {
  userId: string
  username: string
  initialFollowing: boolean
  initialFollowerCount: number
  isSignedIn: boolean
}

interface FollowResponse extends ApiErrorPayload {
  follow?: { following: boolean; followerCount: number }
}

function formatFollowerCount(count: number) {
  return `${count} ${count === 1 ? 'follower' : 'followers'}`
}

export default function PublicProfileFollowButton({
  userId,
  username,
  initialFollowing,
  initialFollowerCount,
  isSignedIn,
}: PublicProfileFollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  if (!isSignedIn) {
    return (
      <div className={styles.followControl}>
        <span>{formatFollowerCount(followerCount)}</span>
        <Link href={GUEST_ACTION_HREF} aria-label={`Sign up to follow ${username}`}>
          <UserPlus aria-hidden="true" size={16} />
          Follow Creator
        </Link>
      </div>
    )
  }

  async function handleFollowToggle() {
    if (isPending) return

    setIsPending(true)
    setStatus(null)

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/follow`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      const body = await readApiResponse<FollowResponse>(response)

      if (!response.ok || !body?.follow) {
        const error = parseClientRequestError(response, body, `Follow request failed with ${response.status}`)

        setStatus(error.code === 'RATE_LIMITED'
          ? 'Too many requests. Wait a moment, then try again.'
          : error.isSessionExpired
            ? 'Your session expired. Sign in again to continue.'
            : error.message)
        return
      }

      setIsFollowing(body.follow.following)
      setFollowerCount(body.follow.followerCount)
    } catch (error) {
      setStatus(getNetworkRequestError(error, 'Unable to update follow status.').message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className={styles.followControl}>
      <span>{formatFollowerCount(followerCount)}</span>
      <button
        type="button"
        onClick={handleFollowToggle}
        aria-label={`${isFollowing ? 'Unfollow' : 'Follow'} ${username}`}
        aria-pressed={isFollowing}
        disabled={isPending}
      >
        {isFollowing ? <UserCheck aria-hidden="true" size={16} /> : <UserPlus aria-hidden="true" size={16} />}
        {isPending ? 'Updating...' : isFollowing ? 'Following' : 'Follow Creator'}
      </button>
      {status ? <small role="status">{status}</small> : null}
    </div>
  )
}
