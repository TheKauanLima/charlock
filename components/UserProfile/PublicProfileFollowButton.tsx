'use client'

import { UserCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'

import styles from './PublicUserProfile.module.css'

interface PublicProfileFollowButtonProps {
  userId: string
  username: string
  initialFollowing: boolean
  initialFollowerCount: number
}

export default function PublicProfileFollowButton({
  userId,
  username,
  initialFollowing,
  initialFollowerCount,
}: PublicProfileFollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

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
      const body = await response.json() as {
        follow?: { following: boolean; followerCount: number }
        error?: string
      }

      if (!response.ok || !body.follow) {
        throw new Error(body.error || `Follow request failed with ${response.status}`)
      }

      setIsFollowing(body.follow.following)
      setFollowerCount(body.follow.followerCount)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update follow status.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className={styles.followControl}>
      <span>{followerCount} {followerCount === 1 ? 'follower' : 'followers'}</span>
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
