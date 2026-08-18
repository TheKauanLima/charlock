import { UserRound } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import type { CreatorProfileSummary } from '@/lib/custom-hero-types'
import cn from '@/lib/utilsd'

import styles from './CreatorProfileBadge.module.css'

interface CreatorProfileBadgeProps {
  creator?: CreatorProfileSummary | null
  compact?: boolean
  iconOnly?: boolean
  official?: boolean
  className?: string
}

function getInitials(username: string) {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C'
}

export default function CreatorProfileBadge({
  creator,
  compact = false,
  iconOnly = false,
  official = false,
  className,
}: CreatorProfileBadgeProps) {
  if (official) {
    return (
      <span className={cn(styles.badge, iconOnly && styles.iconBadge, styles.fallbackBadge, className)} aria-label="Official Roster creator">
        <span className={styles.fallbackAvatar} aria-hidden="true"><UserRound /></span>
        {!iconOnly ? (
          <span className={styles.copy}>
            <small>Created by</small>
            <strong>Official Roster</strong>
          </span>
        ) : null}
      </span>
    )
  }

  if (!creator) {
    return (
      <span className={cn(styles.badge, iconOnly && styles.iconBadge, styles.fallbackBadge, className)} aria-label="Creator profile unavailable">
        <span className={styles.fallbackAvatar} aria-hidden="true"><UserRound /></span>
        {!iconOnly ? (
          <span className={styles.copy}>
            <small>Created by</small>
            <strong>Creator unavailable</strong>
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <Link
      href={`/profile/${encodeURIComponent(creator.profileSlug)}`}
      className={cn(styles.badge, compact && styles.compactBadge, iconOnly && styles.iconBadge, className)}
      aria-label={`View ${creator.username} profile`}
      title={`View ${creator.username} profile`}
    >
      <span className={styles.avatar} aria-hidden="true">
        {creator.avatarUrl ? (
          <Image src={creator.avatarUrl} alt="" fill unoptimized sizes={compact || iconOnly ? '28px' : '36px'} />
        ) : (
          <span>{getInitials(creator.username)}</span>
        )}
      </span>
      {!iconOnly ? (
        <>
          <span className={styles.copy}>
            <small>Created by</small>
            <strong>{creator.username}</strong>
            {!compact ? <em>{creator.level}</em> : null}
          </span>
          <span className={styles.action}>{compact ? 'Profile' : 'View Creator Profile'}</span>
        </>
      ) : null}
    </Link>
  )
}
