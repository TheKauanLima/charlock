'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, LogOut, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useClerk, useUser } from '@clerk/nextjs'

import styles from './GlobalNav.module.css'

function getProfileSegment(user: NonNullable<ReturnType<typeof useUser>['user']>) {
  const metadataUsername = user.unsafeMetadata?.username
  const username = user.username || (typeof metadataUsername === 'string' ? metadataUsername : null)

  return encodeURIComponent(username || user.id)
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C'
}

export default function GlobalNav() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const [isOpen, setIsOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return undefined
    }

    const abortController = new AbortController()

    async function loadNotifications() {
      try {
        const response = await fetch('/api/notifications', {
          signal: abortController.signal,
        })
        const body = await response.json() as { notifications?: { hasNotifications: boolean; count: number } }

        if (response.ok && body.notifications?.hasNotifications) {
          setNotificationCount(body.notifications.count)
        }
      } catch {
        if (!abortController.signal.aborted) {
          setNotificationCount(0)
        }
      }
    }

    void loadNotifications()

    return () => abortController.abort()
  }, [isLoaded, isSignedIn])

  if (!isLoaded || !isSignedIn || !user) {
    return null
  }

  const displayName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || 'Charlock User'
  const profilePath = `/profile/${getProfileSegment(user)}`

  return (
    <div className={styles.nav} ref={menuRef}>
      <button
        type="button"
        className={styles.avatarButton}
        aria-label="Open profile navigation"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className={styles.avatarFrame}>
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              fill
              unoptimized
              sizes="56px"
              className={styles.avatarImage}
            />
          ) : (
            <span className={styles.avatarFallback}>{getInitials(displayName)}</span>
          )}
        </span>
        {notificationCount > 0 ? <span className={styles.avatarNotification} aria-label={`${notificationCount} new activity updates`} /> : null}
      </button>

      {isOpen ? (
        <div className={styles.menu} role="menu" aria-label="Profile navigation">
          <Link className={styles.menuItem} href="/?tab=bookmarks" role="menuitem" onClick={() => setIsOpen(false)}>
            <span className={styles.notificationIcon}>
              <Bell aria-hidden="true" size={17} />
              {notificationCount > 0 ? <span className={styles.notificationDot} aria-label={`${notificationCount} new activity updates`} /> : null}
            </span>
            <span>Bookmarks</span>
          </Link>
          <Link className={styles.menuItem} href={profilePath} role="menuitem" onClick={() => setIsOpen(false)}>
            <UserRound aria-hidden="true" size={17} />
            <span>View Profile</span>
          </Link>
          <Link className={styles.menuItem} href="/profile/settings" role="menuitem" onClick={() => setIsOpen(false)}>
            <Settings aria-hidden="true" size={17} />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.leaveItem}`}
            role="menuitem"
            onClick={() => {
              setIsOpen(false)
              void signOut({ redirectUrl: '/sign-in' })
            }}
          >
            <LogOut aria-hidden="true" size={17} />
            <span>Leave Precinct</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
